const db = require('../db');

/**
 * User model - Query helpers for users table
 */

/**
 * Find users by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findByClientId(clientId) {
  return db('users').where({ client_id: clientId });
}

/**
 * Count users by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countByClientId(clientId) {
  const result = await db('users').where({ client_id: clientId }).count('id as count').first();
  return parseInt(result.count, 10);
}

/**
 * Count users with MFA enabled
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countMFAEnabled(clientId) {
  const result = await db('users')
    .where({ client_id: clientId, mfa_enabled: true })
    .count('id as count')
    .first();
  return parseInt(result.count, 10);
}

/**
 * Count users by risk level
 * @param {number} clientId - Client ID
 * @param {string} riskLevel - Risk level ('none', 'low', 'medium', 'high')
 * @returns {Promise<number>}
 */
async function countByRiskLevel(clientId, riskLevel) {
  const result = await db('users')
    .where({ client_id: clientId, risk_level: riskLevel })
    .count('id as count')
    .first();
  return parseInt(result.count, 10);
}

/**
 * Find high-risk users
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findHighRiskUsers(clientId) {
  return db('users')
    .where({ client_id: clientId, risk_level: 'high' })
    .orWhere({ client_id: clientId, risk_level: 'medium' });
}

/**
 * Batch upsert users
 * @param {Array} users - Array of user objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>}
 */
async function batchUpsert(users, trx = db) {
  const results = [];
  for (const user of users) {
    const existing = await trx('users')
      .where({ external_id: user.external_id, client_id: user.client_id })
      .first();

    if (existing) {
      await trx('users').where({ id: existing.id }).update(user);
      results.push(await trx('users').where({ id: existing.id }).first());
    } else {
      const [id] = await trx('users').insert(user).returning('id');
      results.push(await trx('users').where({ id }).first());
    }
  }
  return results;
}

module.exports = {
  findByClientId,
  countByClientId,
  countMFAEnabled,
  countByRiskLevel,
  findHighRiskUsers,
  batchUpsert,
};
