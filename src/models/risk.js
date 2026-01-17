const db = require('../db');

/**
 * Risk model - Query helpers for risks table
 */

/**
 * Find risks by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findByClientId(clientId) {
  return db('risks').where({ client_id: clientId }).orderBy('detected_at', 'desc');
}

/**
 * Find open risks by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findOpenRisks(clientId) {
  return db('risks').where({ client_id: clientId, status: 'open' }).orderBy('detected_at', 'desc');
}

/**
 * Find risks by type
 * @param {number} clientId - Client ID
 * @param {string} riskType - Risk type ('identity', 'email', 'endpoint', 'business')
 * @returns {Promise<Array>}
 */
async function findByType(clientId, riskType) {
  return db('risks').where({ client_id: clientId, risk_type: riskType });
}

/**
 * Count open risks
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countOpenRisks(clientId) {
  const result = await db('risks')
    .where({ client_id: clientId, status: 'open' })
    .count('id as count')
    .first();
  return parseInt(result.count, 10);
}

/**
 * Get top risks by likelihood and impact
 * @param {number} clientId - Client ID
 * @param {number} limit - Number of risks to return
 * @returns {Promise<Array>}
 */
async function getTopRisks(clientId, limit = 5) {
  // Score: high=3, medium=2, low=1
  const riskScoreMap = { high: 3, medium: 2, low: 1 };

  const risks = await db('risks')
    .where({ client_id: clientId, status: 'open' })
    .select('*');

  // Calculate risk score (likelihood × impact) and sort
  const scoredRisks = risks.map(risk => ({
    ...risk,
    risk_score: (riskScoreMap[risk.likelihood] || 1) * (riskScoreMap[risk.impact] || 1)
  }));

  return scoredRisks
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, limit);
}

/**
 * Batch upsert risks
 * @param {Array} risks - Array of risk objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>}
 */
async function batchUpsert(risks, trx = db) {
  const results = [];
  for (const risk of risks) {
    const existing = await trx('risks')
      .where({ external_id: risk.external_id, client_id: risk.client_id })
      .first();

    if (existing) {
      await trx('risks').where({ id: existing.id }).update(risk);
      results.push(await trx('risks').where({ id: existing.id }).first());
    } else {
      const [id] = await trx('risks').insert(risk).returning('id');
      results.push(await trx('risks').where({ id }).first());
    }
  }
  return results;
}

module.exports = {
  findByClientId,
  findOpenRisks,
  findByType,
  countOpenRisks,
  getTopRisks,
  batchUpsert,
};
