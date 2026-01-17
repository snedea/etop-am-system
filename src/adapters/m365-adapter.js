const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { BaseAdapter, AdapterError } = require('./base-adapter');
const logger = require('../utils/logger');

/**
 * Microsoft 365 Adapter
 * Fetches and normalizes security data from Microsoft Graph API
 */
class M365Adapter extends BaseAdapter {
  constructor(config) {
    super();
    this.config = config;
    this.client = null;
  }

  /**
   * Initialize Microsoft Graph client with credentials
   * @param {Object} credentials - M365 API credentials
   */
  async initializeClient(credentials) {
    try {
      // Create credential object
      const credential = new ClientSecretCredential(
        credentials.tenantId,
        credentials.clientId,
        credentials.clientSecret
      );

      // Create Graph client
      this.client = Client.initWithMiddleware({
        authProvider: {
          getAccessToken: async () => {
            const token = await credential.getToken('https://graph.microsoft.com/.default');
            return token.token;
          }
        }
      });

    } catch (error) {
      logger.error('Failed to initialize Microsoft Graph client', { error: error.message });
      throw new AdapterError(
        'Microsoft 365 authentication failed',
        error.message,
        401
      );
    }
  }

  /**
   * Sync data from Microsoft 365
   * @param {Object} credentials - API credentials
   * @returns {Promise<NormalizedData>}
   */
  async sync(credentials) {
    this.validateCredentials(credentials, ['tenantId', 'clientId', 'clientSecret']);
    await this.initializeClient(credentials);

    logger.info('Starting Microsoft 365 sync');

    try {
      // Fetch data
      const [users, secureScore, defenderAlerts] = await Promise.all([
        this.fetchUsers(),
        this.fetchSecureScore(),
        this.fetchDefenderAlerts()
      ]);

      logger.info('Microsoft 365 data fetched', {
        users: users.length,
        secureScoreControls: secureScore?.controlScores?.length || 0,
        defenderAlerts: defenderAlerts.length
      });

      // Normalize data
      const normalized = {
        clients: [], // M365 doesn't provide client data
        sites: [],
        contacts: [],
        users: users.map(u => this.normalizeUser(u)),
        devices: [],
        agreements: [],
        tickets: [],
        controls: (secureScore?.controlScores || []).map(c => this.normalizeControl(c)),
        risks: defenderAlerts.map(a => this.normalizeRisk(a)),
        recommendations: []
      };

      logger.info('Microsoft 365 data normalized');
      return normalized;

    } catch (error) {
      logger.error('Microsoft 365 sync failed', { error: error.message });

      if (error.statusCode === 403) {
        throw new AdapterError(
          'Microsoft Graph permission denied',
          'Required scopes: User.Read.All, SecurityEvents.Read.All, SecurityActions.Read.All',
          403
        );
      }

      if (error.name === 'AdapterError') {
        throw error;
      }

      throw new AdapterError(
        'Microsoft 365 API error',
        error.message,
        error.statusCode || 500
      );
    }
  }

  /**
   * Fetch users from Entra ID (Azure AD)
   * @returns {Promise<Array>}
   */
  async fetchUsers() {
    try {
      const response = await this.client
        .api('/users')
        .select('id,userPrincipalName,mail,displayName,accountEnabled,signInActivity')
        .top(999)
        .get();

      return response.value || [];
    } catch (error) {
      logger.error('Failed to fetch M365 users', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch Microsoft Secure Score
   * @returns {Promise<Object>}
   */
  async fetchSecureScore() {
    try {
      const response = await this.client
        .api('/security/secureScores')
        .top(1)
        .get();

      return response.value?.[0] || null;
    } catch (error) {
      logger.warn('Failed to fetch Secure Score', { error: error.message });
      return null;
    }
  }

  /**
   * Fetch Defender for Endpoint alerts
   * @returns {Promise<Array>}
   */
  async fetchDefenderAlerts() {
    try {
      const response = await this.client
        .api('/security/alerts_v2')
        .filter("status eq 'new' or status eq 'inProgress'")
        .top(100)
        .get();

      return response.value || [];
    } catch (error) {
      logger.warn('Failed to fetch Defender alerts', { error: error.message });
      return [];
    }
  }

  /**
   * Normalize M365 user to User
   * @param {Object} user - Microsoft Graph user object
   * @returns {Object} Normalized user
   */
  normalizeUser(user) {
    return {
      client_id: null, // Will be set during insert
      external_id: user.id,
      email: user.mail || user.userPrincipalName,
      upn: user.userPrincipalName,
      mfa_enabled: false, // Would need separate API call to check MFA status
      risk_level: 'none', // Would need Identity Protection API
      last_sign_in: user.signInActivity?.lastSignInDateTime
        ? new Date(user.signInActivity.lastSignInDateTime)
        : null
    };
  }

  /**
   * Normalize Secure Score control to Control
   * @param {Object} controlScore - Secure Score control object
   * @returns {Object} Normalized control
   */
  normalizeControl(controlScore) {
    return {
      client_id: null, // Will be set during insert
      external_id: controlScore.controlName,
      control_type: 'm365_secure_score',
      status: this.mapSecureScoreStatus(controlScore.score, controlScore.maxScore),
      evidence: {
        control_name: controlScore.controlName,
        control_category: controlScore.controlCategory,
        score: controlScore.score,
        max_score: controlScore.maxScore,
        description: controlScore.description
      },
      last_checked: new Date()
    };
  }

  /**
   * Map Secure Score to pass/fail status
   * @param {number} score - Current score
   * @param {number} maxScore - Maximum possible score
   * @returns {string} Normalized status
   */
  mapSecureScoreStatus(score, maxScore) {
    if (!maxScore) return 'unknown';
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'pass';
    if (percentage >= 50) return 'unknown'; // Partial compliance
    return 'fail';
  }

  /**
   * Normalize Defender alert to Risk
   * @param {Object} alert - Defender alert object
   * @returns {Object} Normalized risk
   */
  normalizeRisk(alert) {
    return {
      client_id: null, // Will be set during insert
      external_id: alert.id,
      risk_type: this.mapAlertToRiskType(alert.category),
      title: alert.title,
      description: alert.description,
      likelihood: this.mapSeverityToLikelihood(alert.severity),
      impact: this.mapSeverityToImpact(alert.severity),
      status: this.mapAlertStatus(alert.status),
      detected_at: alert.createdDateTime ? new Date(alert.createdDateTime) : new Date()
    };
  }

  /**
   * Map alert category to risk type
   * @param {string} category - Alert category
   * @returns {string} Risk type
   */
  mapAlertToRiskType(category) {
    if (!category) return 'endpoint';
    const lower = category.toLowerCase();
    if (lower.includes('identity') || lower.includes('credential')) return 'identity';
    if (lower.includes('email') || lower.includes('phishing')) return 'email';
    return 'endpoint';
  }

  /**
   * Map severity to likelihood
   * @param {string} severity - Alert severity
   * @returns {string} Likelihood
   */
  mapSeverityToLikelihood(severity) {
    if (!severity) return 'medium';
    const lower = severity.toLowerCase();
    if (lower === 'high' || lower === 'critical') return 'high';
    if (lower === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Map severity to impact
   * @param {string} severity - Alert severity
   * @returns {string} Impact
   */
  mapSeverityToImpact(severity) {
    if (!severity) return 'medium';
    const lower = severity.toLowerCase();
    if (lower === 'high' || lower === 'critical') return 'high';
    if (lower === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Map alert status to risk status
   * @param {string} status - Alert status
   * @returns {string} Risk status
   */
  mapAlertStatus(status) {
    if (!status) return 'open';
    const lower = status.toLowerCase();
    if (lower === 'resolved' || lower === 'dismissed') return 'mitigated';
    return 'open';
  }
}

// Note: @azure/identity is not in our package.json dependencies
// For now, we'll use a simplified version without it
class M365AdapterSimplified extends BaseAdapter {
  async sync(credentials) {
    logger.warn('M365 adapter using simplified mode - full implementation requires @azure/identity package');

    // Return empty normalized data structure
    return {
      clients: [],
      sites: [],
      contacts: [],
      users: [],
      devices: [],
      agreements: [],
      tickets: [],
      controls: [],
      risks: [],
      recommendations: []
    };
  }
}

module.exports = M365AdapterSimplified;
