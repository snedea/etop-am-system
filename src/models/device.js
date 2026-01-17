const db = require('../db');

/**
 * Device model - Query helpers for devices table
 */

/**
 * Find devices by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findByClientId(clientId) {
  return db('devices').where({ client_id: clientId });
}

/**
 * Find managed devices by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findManagedByClientId(clientId) {
  return db('devices').where({ client_id: clientId, managed: true });
}

/**
 * Find devices by health status
 * @param {number} clientId - Client ID
 * @param {string} healthStatus - Health status ('healthy', 'warning', 'critical')
 * @returns {Promise<Array>}
 */
async function findByHealthStatus(clientId, healthStatus) {
  return db('devices').where({ client_id: clientId, health_status: healthStatus });
}

/**
 * Count devices by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countByClientId(clientId) {
  const result = await db('devices').where({ client_id: clientId }).count('id as count').first();
  return parseInt(result.count, 10);
}

/**
 * Count managed devices by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countManagedByClientId(clientId) {
  const result = await db('devices')
    .where({ client_id: clientId, managed: true })
    .count('id as count')
    .first();
  return parseInt(result.count, 10);
}

/**
 * Create or update device (upsert by external_id)
 * @param {Object} deviceData - Device data
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Object>}
 */
async function upsert(deviceData, trx = db) {
  const existing = await trx('devices')
    .where({ external_id: deviceData.external_id, client_id: deviceData.client_id })
    .first();

  if (existing) {
    // Update
    await trx('devices')
      .where({ id: existing.id })
      .update(deviceData);
    return trx('devices').where({ id: existing.id }).first();
  } else {
    // Insert
    const [id] = await trx('devices').insert(deviceData).returning('id');
    return trx('devices').where({ id }).first();
  }
}

/**
 * Batch upsert devices
 * @param {Array} devices - Array of device objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>}
 */
async function batchUpsert(devices, trx = db) {
  const results = [];
  for (const device of devices) {
    const result = await upsert(device, trx);
    results.push(result);
  }
  return results;
}

module.exports = {
  findByClientId,
  findManagedByClientId,
  findByHealthStatus,
  countByClientId,
  countManagedByClientId,
  upsert,
  batchUpsert,
};
