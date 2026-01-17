const axios = require('axios');
const { BaseAdapter, AdapterError } = require('./base-adapter');
const logger = require('../utils/logger');

/**
 * Immy.Bot Adapter
 * Fetches and normalizes compliance data from Immy.Bot API
 */
class ImmyAdapter extends BaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
  }

  /**
   * Initialize axios client with Immy.Bot credentials
   * @param {Object} credentials - Immy.Bot API credentials
   */
  initializeClient(credentials) {
    this.client = axios.create({
      baseURL: credentials.baseUrl,
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Sync data from Immy.Bot
   * @param {Object} credentials - API credentials
   * @returns {Promise<NormalizedData>}
   */
  async sync(credentials) {
    this.validateCredentials(credentials, ['apiKey', 'baseUrl']);
    this.initializeClient(credentials);

    logger.info('Starting Immy.Bot sync');

    try {
      // Fetch data
      const [computers, baselines, complianceReports] = await Promise.all([
        this.fetchComputers(),
        this.fetchBaselines(),
        this.fetchComplianceReports()
      ]);

      logger.info('Immy.Bot data fetched', {
        computers: computers.length,
        baselines: baselines.length,
        complianceReports: complianceReports.length
      });

      // Normalize data
      const normalized = {
        clients: [], // Immy doesn't provide client data, devices will be matched to existing clients
        sites: [],
        contacts: [],
        users: [],
        devices: computers.map(c => this.normalizeDevice(c)),
        agreements: [],
        tickets: [],
        controls: complianceReports.map(r => this.normalizeControl(r)),
        risks: [],
        recommendations: []
      };

      logger.info('Immy.Bot data normalized');
      return normalized;

    } catch (error) {
      logger.error('Immy.Bot sync failed', { error: error.message });

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new AdapterError(
          'Immy.Bot authentication failed',
          'Invalid API key',
          401
        );
      }

      if (error.name === 'AdapterError') {
        throw error;
      }

      throw new AdapterError(
        'Immy.Bot API error',
        error.message,
        error.response?.status || 500
      );
    }
  }

  /**
   * Fetch computers from Immy.Bot
   * @returns {Promise<Array>}
   */
  async fetchComputers() {
    try {
      const response = await this.client.get('/computers');
      return response.data;
    } catch (error) {
      // If endpoint doesn't exist, try alternative
      logger.warn('Immy.Bot /computers endpoint failed, trying /devices');
      const response = await this.client.get('/devices');
      return response.data;
    }
  }

  /**
   * Fetch baselines from Immy.Bot
   * @returns {Promise<Array>}
   */
  async fetchBaselines() {
    try {
      const response = await this.client.get('/baselines');
      return response.data;
    } catch (error) {
      logger.warn('Immy.Bot baselines endpoint failed', { error: error.message });
      return [];
    }
  }

  /**
   * Fetch compliance reports from Immy.Bot
   * @returns {Promise<Array>}
   */
  async fetchComplianceReports() {
    try {
      const response = await this.client.get('/compliance/reports');
      return response.data;
    } catch (error) {
      // Try alternative endpoint
      logger.warn('Immy.Bot compliance reports endpoint failed, trying /drift-reports');
      try {
        const response = await this.client.get('/drift-reports');
        return response.data;
      } catch (error2) {
        logger.warn('Immy.Bot drift reports also failed', { error: error2.message });
        return [];
      }
    }
  }

  /**
   * Normalize Immy.Bot computer to Device
   * @param {Object} computer - Immy.Bot computer object
   * @returns {Object} Normalized device
   */
  normalizeDevice(computer) {
    return {
      client_id: null, // Will be matched by serial number or name
      site_id: null,
      external_id: computer.id?.toString() || computer.computerId?.toString(),
      name: computer.name || computer.computerName,
      type: this.mapImmyTypeToDeviceType(computer.type),
      os: computer.operatingSystem || computer.os,
      managed: true, // Immy.Bot only tracks managed devices
      health_status: this.mapImmyHealthStatus(computer.status || computer.health),
      last_seen: computer.lastSeen ? new Date(computer.lastSeen) : null
    };
  }

  /**
   * Map Immy.Bot type to normalized device type
   * @param {string} immyType - Immy.Bot type
   * @returns {string} Normalized type
   */
  mapImmyTypeToDeviceType(immyType) {
    if (!immyType) return 'endpoint';
    const lower = immyType.toLowerCase();
    if (lower.includes('server')) return 'server';
    if (lower.includes('workstation') || lower.includes('laptop') || lower.includes('desktop')) return 'endpoint';
    return 'endpoint';
  }

  /**
   * Map Immy.Bot health status to normalized health status
   * @param {string} immyStatus - Immy.Bot status
   * @returns {string} Normalized status
   */
  mapImmyHealthStatus(immyStatus) {
    if (!immyStatus) return 'unknown';
    const lower = immyStatus.toLowerCase();
    if (lower.includes('healthy') || lower.includes('compliant') || lower.includes('pass')) return 'healthy';
    if (lower.includes('warning') || lower.includes('drift')) return 'warning';
    if (lower.includes('critical') || lower.includes('fail') || lower.includes('non-compliant')) return 'critical';
    return 'healthy';
  }

  /**
   * Normalize Immy.Bot compliance report to Control
   * @param {Object} report - Immy.Bot compliance report
   * @returns {Object} Normalized control
   */
  normalizeControl(report) {
    return {
      client_id: null, // Will be matched to device's client
      external_id: report.id?.toString() || `${report.computerId}-${report.baselineId}`,
      control_type: 'immy_baseline',
      status: this.mapComplianceStatus(report.status || report.compliant),
      evidence: {
        baseline_name: report.baselineName,
        computer_name: report.computerName,
        drift_items: report.driftItems || [],
        details: report.details
      },
      last_checked: report.lastChecked ? new Date(report.lastChecked) : new Date()
    };
  }

  /**
   * Map Immy.Bot compliance status to normalized status
   * @param {string|boolean} status - Immy.Bot status
   * @returns {string} Normalized status
   */
  mapComplianceStatus(status) {
    if (typeof status === 'boolean') {
      return status ? 'pass' : 'fail';
    }
    if (!status) return 'unknown';
    const lower = status.toLowerCase();
    if (lower.includes('pass') || lower.includes('compliant')) return 'pass';
    if (lower.includes('fail') || lower.includes('non-compliant')) return 'fail';
    return 'unknown';
  }
}

module.exports = ImmyAdapter;
