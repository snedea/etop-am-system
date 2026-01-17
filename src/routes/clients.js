const express = require('express');
const router = express.Router();
const { calculateStandardsScore } = require('../engine/standards-score');
const { calculateRiskScore } = require('../engine/risk-score');
const { calculateExperienceScore } = require('../engine/experience-score');
const cache = require('../utils/cache');
const logger = require('../utils/logger');
const db = require('../db');

/**
 * GET /clients/:id/scores
 * Calculate and return all three scores for a client
 */
router.get('/:id/scores', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    // Check cache first
    const cacheKey = `scores:${clientId}`;
    const cachedScores = cache.get(cacheKey);

    if (cachedScores) {
      logger.debug(`Returning cached scores for client ${clientId}`);
      return res.json(cachedScores);
    }

    // Calculate all scores in parallel
    logger.info(`Calculating scores for client ${clientId}`);

    const [standards, risk, experience] = await Promise.all([
      calculateStandardsScore(clientId),
      calculateRiskScore(clientId),
      calculateExperienceScore(clientId)
    ]);

    const result = {
      client_id: clientId,
      standards,
      risk,
      experience,
      calculated_at: new Date()
    };

    // Cache results for 5 minutes
    cache.set(cacheKey, result, 300000);

    logger.info(`Scores calculated for client ${clientId}`, {
      standards: standards.score,
      risk: risk.score,
      experience: experience.score
    });

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:id
 * Get client details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    const client = await db('clients').where({ id: clientId }).first();

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:id/risks
 * Get risks for a client
 */
router.get('/:id/risks', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    const risks = await db('risks')
      .where({ client_id: clientId })
      .orderBy('impact', 'desc')
      .orderBy('likelihood', 'desc');

    res.json(risks);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:id/recommendations
 * Get recommendations for a client
 */
router.get('/:id/recommendations', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);

    const recommendations = await db('recommendations')
      .where({ client_id: clientId })
      .orderBy('priority', 'desc')
      .orderBy('quarter', 'asc');

    res.json(recommendations);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/due-for-qbr
 * Find clients due for QBR based on segment
 */
router.get('/due-for-qbr', async (req, res, next) => {
  try {
    // Simplified implementation
    // Would need to track last QBR date and calculate based on segment

    res.json({
      message: 'QBR cadence tracking not yet implemented',
      clients: []
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
