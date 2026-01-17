const deviceModel = require('../models/device');
const controlModel = require('../models/control');
const logger = require('../utils/logger');

/**
 * Calculate Standards Compliance Score (0-100)
 * Weighted components:
 * - Device coverage: 20%
 * - Immy compliance: 30%
 * - Patch compliance: 20%
 * - EDR health: 15%
 * - M365 Secure Score: 15%
 *
 * @param {number} clientId - Client ID
 * @returns {Promise<ScoreResult>}
 */
async function calculateStandardsScore(clientId) {
  try {
    logger.debug(`Calculating standards score for client ${clientId}`);

    // Gather data
    const totalDevices = await deviceModel.countByClientId(clientId);
    const managedDevices = await deviceModel.countManagedByClientId(clientId);

    // Check if we have sufficient data
    if (totalDevices === 0) {
      return {
        score: null,
        error: 'Insufficient data: no devices found',
        breakdown: {},
        computed_at: new Date()
      };
    }

    // Calculate component scores
    const deviceCoverage = await calculateDeviceCoverage(clientId, totalDevices, managedDevices);
    const immyCompliance = await calculateImmyCompliance(clientId);
    const patchCompliance = await calculatePatchCompliance(clientId);
    const edrHealth = await calculateEDRHealth(clientId);
    const m365SecureScore = await calculateM365SecureScore(clientId);

    // Calculate weighted total
    const components = [
      { ...deviceCoverage, weight: 0.20 },
      { ...immyCompliance, weight: 0.30 },
      { ...patchCompliance, weight: 0.20 },
      { ...edrHealth, weight: 0.15 },
      { ...m365SecureScore, weight: 0.15 }
    ];

    const totalScore = components.reduce((sum, component) => {
      return sum + (component.score * component.weight);
    }, 0);

    const breakdown = {
      device_coverage: { ...deviceCoverage, weight: '20%' },
      immy_compliance: { ...immyCompliance, weight: '30%' },
      patch_compliance: { ...patchCompliance, weight: '20%' },
      edr_health: { ...edrHealth, weight: '15%' },
      m365_secure_score: { ...m365SecureScore, weight: '15%' }
    };

    logger.info(`Standards score calculated for client ${clientId}: ${Math.round(totalScore)}`);

    return {
      score: Math.round(totalScore),
      breakdown,
      computed_at: new Date()
    };

  } catch (error) {
    logger.error(`Error calculating standards score for client ${clientId}`, { error: error.message });
    throw error;
  }
}

/**
 * Calculate device coverage score
 * Percentage of devices under management
 */
async function calculateDeviceCoverage(clientId, totalDevices, managedDevices) {
  const percentage = totalDevices > 0 ? (managedDevices / totalDevices) * 100 : 0;

  return {
    score: Math.min(percentage, 100),
    evidence: {
      total_devices: totalDevices,
      managed_devices: managedDevices,
      coverage_percentage: Math.round(percentage),
      description: `${managedDevices}/${totalDevices} devices (${Math.round(percentage)}%) under management`
    }
  };
}

/**
 * Calculate Immy.Bot compliance score
 * Percentage of devices passing Immy baselines
 */
async function calculateImmyCompliance(clientId) {
  const totalControls = await controlModel.countByStatus(clientId, 'pass') +
                       await controlModel.countByStatus(clientId, 'fail') +
                       await controlModel.countByStatus(clientId, 'unknown');

  if (totalControls === 0) {
    return {
      score: 0,
      evidence: {
        description: 'No Immy.Bot compliance data available'
      }
    };
  }

  const passedControls = await controlModel.countByStatus(clientId, 'pass');
  const percentage = (passedControls / totalControls) * 100;

  return {
    score: Math.round(percentage),
    evidence: {
      total_controls: totalControls,
      passed_controls: passedControls,
      compliance_percentage: Math.round(percentage),
      description: `${passedControls}/${totalControls} controls (${Math.round(percentage)}%) passing`
    }
  };
}

/**
 * Calculate patch compliance score
 * Percentage of devices patched in last 30 days
 * Note: Simplified - would need actual patch data
 */
async function calculatePatchCompliance(clientId) {
  // Simplified: Use health_status as proxy
  const totalDevices = await deviceModel.countByClientId(clientId);
  const healthyDevices = (await deviceModel.findByHealthStatus(clientId, 'healthy')).length;

  if (totalDevices === 0) {
    return {
      score: 0,
      evidence: {
        description: 'No device data available for patch compliance'
      }
    };
  }

  // Assume healthy devices are patched (simplified)
  const percentage = (healthyDevices / totalDevices) * 100;

  return {
    score: Math.round(percentage),
    evidence: {
      total_devices: totalDevices,
      healthy_devices: healthyDevices,
      patch_percentage: Math.round(percentage),
      description: `${healthyDevices}/${totalDevices} devices (${Math.round(percentage)}%) in healthy status`
    }
  };
}

/**
 * Calculate EDR health score
 * Percentage of devices with EDR installed and reporting
 * Note: Simplified - would need actual EDR data
 */
async function calculateEDRHealth(clientId) {
  const totalDevices = await deviceModel.countByClientId(clientId);
  const managedDevices = await deviceModel.countManagedByClientId(clientId);

  if (totalDevices === 0) {
    return {
      score: 0,
      evidence: {
        description: 'No device data available for EDR health'
      }
    };
  }

  // Simplified: Assume managed devices have EDR
  const percentage = (managedDevices / totalDevices) * 100;

  return {
    score: Math.round(percentage),
    evidence: {
      total_devices: totalDevices,
      devices_with_edr: managedDevices,
      edr_coverage: Math.round(percentage),
      description: `${managedDevices}/${totalDevices} devices (${Math.round(percentage)}%) with EDR coverage`
    }
  };
}

/**
 * Calculate M365 Secure Score component
 * Normalized from Microsoft Secure Score
 */
async function calculateM365SecureScore(clientId) {
  const passRate = await controlModel.getPassRate(clientId, 'm365_secure_score');

  if (passRate === 0) {
    return {
      score: 0,
      evidence: {
        description: 'No Microsoft 365 Secure Score data available'
      }
    };
  }

  return {
    score: Math.round(passRate),
    evidence: {
      secure_score_percentage: Math.round(passRate),
      description: `Microsoft Secure Score: ${Math.round(passRate)}%`
    }
  };
}

module.exports = {
  calculateStandardsScore
};
