/**
 * Base Adapter Class
 * Abstract interface that all adapters must implement
 * Enforces the adapter pattern contract
 */

class BaseAdapter {
  /**
   * Sync data from vendor platform
   * @param {Object} credentials - Vendor-specific auth credentials
   * @returns {Promise<NormalizedData>} - Normalized entities
   * @throws {AdapterError} - If API call fails or data invalid
   */
  async sync(credentials) {
    throw new Error('sync() must be implemented by subclass');
  }

  /**
   * Validate credentials structure
   * @param {Object} credentials - Credentials to validate
   * @param {Array<string>} requiredFields - Required credential fields
   * @throws {AdapterError} - If credentials are invalid
   */
  validateCredentials(credentials, requiredFields) {
    if (!credentials || typeof credentials !== 'object') {
      throw new AdapterError(
        'Invalid credentials',
        'Credentials must be an object',
        400
      );
    }

    const missing = requiredFields.filter(field => !credentials[field]);
    if (missing.length > 0) {
      throw new AdapterError(
        'Missing required credentials',
        `Missing fields: ${missing.join(', ')}`,
        400
      );
    }
  }
}

/**
 * Custom error class for adapter errors
 */
class AdapterError extends Error {
  constructor(message, details = null, statusCode = 500) {
    super(message);
    this.name = 'AdapterError';
    this.details = details;
    this.statusCode = statusCode;
  }
}

/**
 * Normalized data structure that all adapters must return
 * @typedef {Object} NormalizedData
 * @property {Array<Client>} clients
 * @property {Array<Site>} sites
 * @property {Array<Contact>} contacts
 * @property {Array<User>} users
 * @property {Array<Device>} devices
 * @property {Array<Agreement>} agreements
 * @property {Array<Ticket>} tickets
 * @property {Array<Control>} controls
 * @property {Array<Risk>} risks
 * @property {Array<Recommendation>} recommendations
 */

module.exports = { BaseAdapter, AdapterError };
