const config = require('../config');
const logger = require('../utils/logger');

/**
 * API Key authentication middleware
 * Validates API key from Authorization header
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn('Missing Authorization header', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Missing Authorization header',
      details: 'Please provide an API key in the Authorization header'
    });
  }

  // Extract API key from "Bearer <key>" or just "<key>"
  const apiKey = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : authHeader;

  if (!config.apiKey) {
    logger.error('API_KEY not configured in environment');
    return res.status(500).json({
      error: 'Server configuration error',
      details: 'API authentication not properly configured'
    });
  }

  if (apiKey !== config.apiKey) {
    logger.warn('Invalid API key attempted', { ip: req.ip, path: req.path });
    return res.status(401).json({
      error: 'Invalid API key',
      details: 'The provided API key is not valid'
    });
  }

  // API key is valid
  next();
}

module.exports = authenticate;
