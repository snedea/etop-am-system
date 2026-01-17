const db = require('../db');

/**
 * Control model - Query helpers for controls table
 */

/**
 * Find controls by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findByClientId(clientId) {
  return db('controls').where({ client_id: clientId });
}

/**
 * Find controls by type
 * @param {number} clientId - Client ID
 * @param {string} controlType - Control type ('immy_baseline', 'm365_secure_score', etc.)
 * @returns {Promise<Array>}
 */
async function findByType(clientId, controlType) {
  return db('controls').where({ client_id: clientId, control_type: controlType });
}

/**
 * Count controls by status
 * @param {number} clientId - Client ID
 * @param {string} status - Status ('pass', 'fail', 'unknown')
 * @returns {Promise<number>}
 */
async function countByStatus(clientId, status) {
  const result = await db('controls')
    .where({ client_id: clientId, status })
    .count('id as count')
    .first();
  return parseInt(result.count, 10);
}

/**
 * Get control pass rate
 * @param {number} clientId - Client ID
 * @param {string} controlType - Optional control type filter
 * @returns {Promise<number>} Percentage (0-100)
 */
async function getPassRate(clientId, controlType = null) {
  let query = db('controls').where({ client_id: clientId });

  if (controlType) {
    query = query.where({ control_type: controlType });
  }

  const total = await query.clone().count('id as count').first();
  const passed = await query.clone().where({ status: 'pass' }).count('id as count').first();

  const totalCount = parseInt(total.count, 10);
  const passedCount = parseInt(passed.count, 10);

  if (totalCount === 0) return 0;
  return (passedCount / totalCount) * 100;
}

/**
 * Batch upsert controls
 * @param {Array} controls - Array of control objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>}
 */
async function batchUpsert(controls, trx = db) {
  const results = [];
  for (const control of controls) {
    const existing = await trx('controls')
      .where({ external_id: control.external_id, client_id: control.client_id })
      .first();

    if (existing) {
      await trx('controls').where({ id: existing.id }).update(control);
      results.push(await trx('controls').where({ id: existing.id }).first());
    } else {
      const [id] = await trx('controls').insert(control).returning('id');
      results.push(await trx('controls').where({ id }).first());
    }
  }
  return results;
}

module.exports = {
  findByClientId,
  findByType,
  countByStatus,
  getPassRate,
  batchUpsert,
};
