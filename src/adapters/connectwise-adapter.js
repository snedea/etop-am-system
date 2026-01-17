const axios = require('axios');
const { parseISO, subDays } = require('date-fns');
const { BaseAdapter, AdapterError } = require('./base-adapter');
const logger = require('../utils/logger');

/**
 * ConnectWise Manage Adapter
 * Fetches and normalizes data from ConnectWise Manage API
 */
class ConnectWiseAdapter extends BaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
  }

  /**
   * Initialize axios client with ConnectWise credentials
   * @param {Object} credentials - ConnectWise API credentials
   */
  initializeClient(credentials) {
    const auth = Buffer.from(
      `${credentials.companyId}+${credentials.publicKey}:${credentials.privateKey}`
    ).toString('base64');

    this.client = axios.create({
      baseURL: credentials.baseUrl,
      headers: {
        'Authorization': `Basic ${auth}`,
        'clientId': credentials.clientId,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add retry logic for rate limits
    this.client.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '60', 10);
          logger.warn(`ConnectWise rate limit hit, retry after ${retryAfter}s`);
          throw new AdapterError(
            'ConnectWise rate limit exceeded',
            error.response.data,
            429
          );
        }
        throw error;
      }
    );
  }

  /**
   * Sync data from ConnectWise Manage
   * @param {Object} credentials - API credentials
   * @returns {Promise<NormalizedData>}
   */
  async sync(credentials) {
    this.validateCredentials(credentials, ['companyId', 'publicKey', 'privateKey', 'clientId', 'baseUrl']);
    this.initializeClient(credentials);

    logger.info('Starting ConnectWise sync');

    try {
      // Fetch data in parallel
      const [companies, agreements, tickets, configurations] = await Promise.all([
        this.fetchCompanies(),
        this.fetchAgreements(),
        this.fetchTickets(),
        this.fetchConfigurations()
      ]);

      logger.info('ConnectWise data fetched', {
        companies: companies.length,
        agreements: agreements.length,
        tickets: tickets.length,
        configurations: configurations.length
      });

      // Normalize data
      const normalized = {
        clients: companies.map(c => this.normalizeClient(c)),
        sites: companies.flatMap(c => this.normalizeSites(c)),
        contacts: companies.flatMap(c => this.normalizeContacts(c)),
        users: [], // ConnectWise doesn't provide M365 users
        devices: configurations.map(c => this.normalizeDevice(c)),
        agreements: agreements.map(a => this.normalizeAgreement(a)),
        tickets: tickets.map(t => this.normalizeTicket(t)),
        controls: [], // ConnectWise doesn't provide compliance controls
        risks: [], // ConnectWise doesn't directly provide risks
        recommendations: []
      };

      logger.info('ConnectWise data normalized');
      return normalized;

    } catch (error) {
      logger.error('ConnectWise sync failed', { error: error.message });

      if (error.response?.status === 401) {
        throw new AdapterError(
          'ConnectWise authentication failed',
          'Invalid API credentials',
          401
        );
      }

      if (error.name === 'AdapterError') {
        throw error;
      }

      throw new AdapterError(
        'ConnectWise API error',
        error.message,
        error.response?.status || 500
      );
    }
  }

  /**
   * Fetch companies (clients) from ConnectWise
   * @returns {Promise<Array>}
   */
  async fetchCompanies() {
    const response = await this.client.get('/company/companies', {
      params: {
        pageSize: 1000,
        conditions: 'deletedFlag=false'
      }
    });
    return response.data;
  }

  /**
   * Fetch agreements from ConnectWise
   * @returns {Promise<Array>}
   */
  async fetchAgreements() {
    const response = await this.client.get('/finance/agreements', {
      params: {
        pageSize: 1000,
        conditions: 'cancelledFlag=false'
      }
    });
    return response.data;
  }

  /**
   * Fetch tickets from ConnectWise (last 90 days)
   * @returns {Promise<Array>}
   */
  async fetchTickets() {
    const startDate = subDays(new Date(), 90).toISOString();
    const response = await this.client.get('/service/tickets', {
      params: {
        pageSize: 1000,
        conditions: `dateEntered>=[${startDate}]`
      }
    });
    return response.data;
  }

  /**
   * Fetch configurations (devices) from ConnectWise
   * @returns {Promise<Array>}
   */
  async fetchConfigurations() {
    const response = await this.client.get('/company/configurations', {
      params: {
        pageSize: 1000,
        conditions: 'inactiveFlag=false'
      }
    });
    return response.data;
  }

  /**
   * Normalize ConnectWise company to Client
   * @param {Object} company - ConnectWise company object
   * @returns {Object} Normalized client
   */
  normalizeClient(company) {
    return {
      external_id: company.id.toString(),
      source: 'connectwise',
      name: company.name || company.identifier,
      segment: null, // Will be set manually
      mrr: null, // Calculate from agreements
      agreement_start: null,
      agreement_end: null
    };
  }

  /**
   * Normalize ConnectWise company sites
   * @param {Object} company - ConnectWise company object
   * @returns {Array} Normalized sites
   */
  normalizeSites(company) {
    // ConnectWise companies have a default site
    return [{
      client_id: null, // Will be set during insert
      external_id: `${company.id}-main`,
      name: company.name,
      address: [
        company.addressLine1,
        company.addressLine2,
        company.city,
        company.state,
        company.zip
      ].filter(Boolean).join(', ')
    }];
  }

  /**
   * Normalize ConnectWise contacts
   * @param {Object} company - ConnectWise company object
   * @returns {Array} Normalized contacts
   */
  normalizeContacts(company) {
    // Would need separate API call to fetch contacts
    // Simplified for now
    return [];
  }

  /**
   * Normalize ConnectWise configuration to Device
   * @param {Object} config - ConnectWise configuration object
   * @returns {Object} Normalized device
   */
  normalizeDevice(config) {
    return {
      client_id: null, // Will be set during insert
      site_id: null,
      external_id: config.id.toString(),
      name: config.name,
      type: this.mapConfigTypeToDeviceType(config.type?.name),
      os: config.osInfo || null,
      managed: true, // Assume managed if in ConnectWise
      health_status: 'healthy', // Default, would need more data
      last_seen: config.lastUpdate ? new Date(config.lastUpdate) : null
    };
  }

  /**
   * Map ConnectWise config type to normalized device type
   * @param {string} cwType - ConnectWise type
   * @returns {string} Normalized type
   */
  mapConfigTypeToDeviceType(cwType) {
    if (!cwType) return 'endpoint';
    const lower = cwType.toLowerCase();
    if (lower.includes('server')) return 'server';
    if (lower.includes('switch') || lower.includes('router') || lower.includes('firewall')) return 'network';
    return 'endpoint';
  }

  /**
   * Normalize ConnectWise agreement
   * @param {Object} agreement - ConnectWise agreement object
   * @returns {Object} Normalized agreement
   */
  normalizeAgreement(agreement) {
    return {
      client_id: null, // Will be set during insert
      external_id: agreement.id.toString(),
      mrr: agreement.billAmount || 0,
      effective_rate: null,
      term_months: null,
      start_date: agreement.startDate ? new Date(agreement.startDate) : null,
      end_date: agreement.endDate ? new Date(agreement.endDate) : null
    };
  }

  /**
   * Normalize ConnectWise ticket
   * @param {Object} ticket - ConnectWise ticket object
   * @returns {Object} Normalized ticket
   */
  normalizeTicket(ticket) {
    return {
      client_id: null, // Will be set during insert
      external_id: ticket.id.toString(),
      category: ticket.type?.name || 'Unknown',
      priority: ticket.priority?.name || 'Normal',
      status: ticket.status?.name || 'Unknown',
      hours_spent: ticket.actualHours || 0,
      sla_met: ticket.respondedSkippedMinutes === 0 && ticket.resolveSlaMinutes >= 0,
      reopen_count: 0, // Would need to track this
      csat_score: null, // Not directly available
      created_date: ticket.dateEntered ? new Date(ticket.dateEntered) : null,
      closed_date: ticket.closedDate ? new Date(ticket.closedDate) : null
    };
  }
}

module.exports = ConnectWiseAdapter;
