const userModel = require('../models/user');
const riskModel = require('../models/risk');
const deviceModel = require('../models/device');
const logger = require('../utils/logger');

/**
 * Calculate Risk Score (0-100, inverse: higher = more risk)
 * Weighted components:
 * - Identity risk: 30%
 * - Email risk: 25%
 * - Endpoint risk: 25%
 * - Business modifier: 20%
 *
 * @param {number} clientId - Client ID
 * @returns {Promise<ScoreResult>}
 */
async function calculateRiskScore(clientId) {
  try {
    logger.debug(`Calculating risk score for client ${clientId}`);

    // Calculate component scores
    const identityRisk = await calculateIdentityRisk(clientId);
    const emailRisk = await calculateEmailRisk(clientId);
    const endpointRisk = await calculateEndpointRisk(clientId);
    const businessModifier = await calculateBusinessModifier(clientId);

    // Calculate weighted total
    const components = [
      { ...identityRisk, weight: 0.30 },
      { ...emailRisk, weight: 0.25 },
      { ...endpointRisk, weight: 0.25 },
      { ...businessModifier, weight: 0.20 }
    ];

    const totalScore = components.reduce((sum, component) => {
      return sum + (component.score * component.weight);
    }, 0);

    const breakdown = {
      identity_risk: { ...identityRisk, weight: '30%' },
      email_risk: { ...emailRisk, weight: '25%' },
      endpoint_risk: { ...endpointRisk, weight: '25%' },
      business_modifier: { ...businessModifier, weight: '20%' }
    };

    logger.info(`Risk score calculated for client ${clientId}: ${Math.round(totalScore)}`);

    return {
      score: Math.round(totalScore),
      breakdown,
      computed_at: new Date()
    };

  } catch (error) {
    logger.error(`Error calculating risk score for client ${clientId}`, { error: error.message });
    throw error;
  }
}

/**
 * Calculate identity risk score
 * Based on MFA coverage, risky users, stale accounts
 */
async function calculateIdentityRisk(clientId) {
  const totalUsers = await userModel.countByClientId(clientId);

  if (totalUsers === 0) {
    return {
      score: 50, // Medium risk if no data
      risk_level: 'Medium',
      evidence: {
        description: 'No user data available for identity risk assessment'
      }
    };
  }

  const mfaEnabled = await userModel.countMFAEnabled(clientId);
  const highRiskUsers = await userModel.countByRiskLevel(clientId, 'high');
  const mediumRiskUsers = await userModel.countByRiskLevel(clientId, 'medium');

  // Calculate MFA coverage
  const mfaCoverage = (mfaEnabled / totalUsers) * 100;

  // Calculate risk score (inverse: low MFA coverage = high risk)
  let riskScore = 0;

  // MFA coverage contributes 60% of identity risk
  riskScore += (100 - mfaCoverage) * 0.6;

  // High-risk users contribute 30%
  const highRiskPercentage = (highRiskUsers / totalUsers) * 100;
  riskScore += highRiskPercentage * 0.3;

  // Medium-risk users contribute 10%
  const mediumRiskPercentage = (mediumRiskUsers / totalUsers) * 100;
  riskScore += mediumRiskPercentage * 0.1;

  const riskLevel = riskScore < 25 ? 'Low' : riskScore < 50 ? 'Medium' : 'High';

  return {
    score: Math.round(riskScore),
    risk_level: riskLevel,
    evidence: {
      total_users: totalUsers,
      mfa_enabled: mfaEnabled,
      mfa_coverage: Math.round(mfaCoverage),
      high_risk_users: highRiskUsers,
      medium_risk_users: mediumRiskUsers,
      description: `${mfaEnabled}/${totalUsers} users (${Math.round(mfaCoverage)}%) have MFA enabled, ${highRiskUsers} users flagged as high risk by Entra ID`
    }
  };
}

/**
 * Calculate email risk score
 * Based on Defender for Office alerts and phishing simulations
 */
async function calculateEmailRisk(clientId) {
  const emailRisks = await riskModel.findByType(clientId, 'email');
  const openEmailRisks = emailRisks.filter(r => r.status === 'open');

  // Simplified: Score based on number of open email-related risks
  let riskScore = 0;

  if (openEmailRisks.length === 0) {
    riskScore = 10; // Low baseline risk
  } else if (openEmailRisks.length <= 3) {
    riskScore = 30;
  } else if (openEmailRisks.length <= 10) {
    riskScore = 60;
  } else {
    riskScore = 90;
  }

  const riskLevel = riskScore < 25 ? 'Low' : riskScore < 50 ? 'Medium' : 'High';

  return {
    score: riskScore,
    risk_level: riskLevel,
    evidence: {
      total_email_alerts: emailRisks.length,
      open_email_alerts: openEmailRisks.length,
      description: `${openEmailRisks.length} open email-related security alerts`
    }
  };
}

/**
 * Calculate endpoint risk score
 * Based on unpatched devices, missing EDR, high-risk detections
 */
async function calculateEndpointRisk(clientId) {
  const totalDevices = await deviceModel.countByClientId(clientId);

  if (totalDevices === 0) {
    return {
      score: 50,
      risk_level: 'Medium',
      evidence: {
        description: 'No device data available for endpoint risk assessment'
      }
    };
  }

  const managedDevices = await deviceModel.countManagedByClientId(clientId);
  const criticalDevices = (await deviceModel.findByHealthStatus(clientId, 'critical')).length;
  const endpointRisks = await riskModel.findByType(clientId, 'endpoint');
  const openEndpointRisks = endpointRisks.filter(r => r.status === 'open');

  // Calculate risk components
  const unmanagedPercentage = ((totalDevices - managedDevices) / totalDevices) * 100;
  const criticalPercentage = (criticalDevices / totalDevices) * 100;

  // Calculate risk score
  let riskScore = 0;
  riskScore += unmanagedPercentage * 0.4; // Unmanaged devices: 40%
  riskScore += criticalPercentage * 0.3; // Critical health: 30%
  riskScore += Math.min(openEndpointRisks.length * 5, 30); // Open risks: up to 30%

  const riskLevel = riskScore < 25 ? 'Low' : riskScore < 50 ? 'Medium' : 'High';

  return {
    score: Math.round(riskScore),
    risk_level: riskLevel,
    evidence: {
      total_devices: totalDevices,
      unmanaged_devices: totalDevices - managedDevices,
      critical_health_devices: criticalDevices,
      open_endpoint_risks: openEndpointRisks.length,
      description: `${totalDevices - managedDevices} devices missing EDR, ${criticalDevices} devices in critical health, ${openEndpointRisks.length} open endpoint risks`
    }
  };
}

/**
 * Calculate business modifier score
 * Based on industry and compliance requirements
 * Simplified: Returns medium risk baseline
 */
async function calculateBusinessModifier(clientId) {
  // Simplified: Would check client industry, compliance requirements, etc.
  // For now, return medium baseline

  return {
    score: 40, // Medium baseline
    risk_level: 'Medium',
    evidence: {
      description: 'Standard business risk profile'
    }
  };
}

module.exports = {
  calculateRiskScore
};
