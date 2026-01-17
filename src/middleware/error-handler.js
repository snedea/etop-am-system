const logger = require('../utils/logger');

/**
 * Centralized error handling middleware
 * Catches all errors and formats them consistently
 */
function errorHandler(err, req, res, next) {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Default error response
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Handle specific error types
  if (err.name === 'ValidationError') {
    // Joi validation error
    status = 400;
    message = 'Validation error';
    details = err.details?.map(d => ({
      field: d.path.join('.'),
      message: d.message
    }));
  } else if (err.name === 'AdapterError') {
    // Custom adapter error
    status = err.statusCode || 500;
    message = err.message;
    details = err.details;
  } else if (err.name === 'InsufficientDataError') {
    // Scoring engine error
    status = 200; // Not an error, just insufficient data
    message = err.message;
  } else if (err.name === 'OpenAIError') {
    // OpenAI API error
    status = 500;
    message = 'AI generation failed';
    details = err.message;
  } else if (err.name === 'PDFGenerationError') {
    // PDF generation error
    status = 500;
    message = 'PDF generation failed';
    details = err.message;
  } else if (err.code === 'ECONNREFUSED') {
    // Database connection error
    status = 503;
    message = 'Database connection failed';
    details = 'Unable to connect to the database';
  }

  // Send error response
  res.status(status).json({
    error: message,
    ...(details && { details })
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    details: `Route ${req.method} ${req.path} not found`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
