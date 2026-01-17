const Joi = require('joi');

/**
 * Validation middleware factory
 * Creates middleware that validates request data against a Joi schema
 * @param {Object} schema - Joi schema object with optional body, query, params keys
 * @returns {Function} Express middleware
 */
function validate(schema) {
  return (req, res, next) => {
    const toValidate = {};

    if (schema.body) {
      toValidate.body = req.body;
    }
    if (schema.query) {
      toValidate.query = req.query;
    }
    if (schema.params) {
      toValidate.params = req.params;
    }

    const schemaToValidate = Joi.object(schema);
    const { error, value } = schemaToValidate.validate(toValidate, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      });
    }

    // Replace request data with validated/sanitized values
    if (value.body) req.body = value.body;
    if (value.query) req.query = value.query;
    if (value.params) req.params = value.params;

    next();
  };
}

/**
 * Common validation schemas
 */
const schemas = {
  // Client ID parameter
  clientId: Joi.object({
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    })
  }),

  // Sync request body (credentials)
  syncCredentials: Joi.object({
    body: Joi.object({
      credentials: Joi.object().required()
    })
  }),

  // QBR generation request
  qbrGenerate: Joi.object({
    params: Joi.object({
      id: Joi.number().integer().positive().required()
    }),
    body: Joi.object({
      options: Joi.object({
        include_lifecycle: Joi.boolean().default(true)
      }).default({})
    })
  }),

  // Job ID parameter
  jobId: Joi.object({
    params: Joi.object({
      id: Joi.number().integer().positive().required(),
      jobId: Joi.string().uuid().required()
    })
  })
};

module.exports = {
  validate,
  schemas
};
