const db = require('../db');

/**
 * Client model - Query helpers for clients table
 */

/**
 * Find client by ID
 * @param {number} id - Client ID
 * @returns {Promise<Object|null>}
 */
async function findById(id) {
  return db('clients').where({ id }).first();
}

/**
 * Find client by external ID and source
 * @param {string} externalId - Vendor-specific ID
 * @param {string} source - Source system ('connectwise', 'immy', 'm365')
 * @returns {Promise<Object|null>}
 */
async function findByExternalId(externalId, source) {
  return db('clients').where({ external_id: externalId, source }).first();
}

/**
 * Find all clients
 * @returns {Promise<Array>}
 */
async function findAll() {
  return db('clients').select('*');
}

/**
 * Find clients by segment
 * @param {string} segment - Segment (A, B, C, or D)
 * @returns {Promise<Array>}
 */
async function findBySegment(segment) {
  return db('clients').where({ segment });
}

/**
 * Create or update client (upsert)
 * @param {Object} clientData - Client data
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Object>}
 */
async function upsert(clientData, trx = db) {
  const existing = await trx('clients')
    .where({ external_id: clientData.external_id, source: clientData.source })
    .first();

  if (existing) {
    // Update
    await trx('clients')
      .where({ id: existing.id })
      .update({ ...clientData, updated_at: trx.fn.now() });
    return trx('clients').where({ id: existing.id }).first();
  } else {
    // Insert
    const [id] = await trx('clients').insert(clientData).returning('id');
    return trx('clients').where({ id }).first();
  }
}

/**
 * Batch upsert clients
 * @param {Array} clients - Array of client objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>} Inserted/updated IDs
 */
async function batchUpsert(clients, trx = db) {
  const results = [];
  for (const client of clients) {
    const result = await upsert(client, trx);
    results.push(result);
  }
  return results;
}

module.exports = {
  findById,
  findByExternalId,
  findAll,
  findBySegment,
  upsert,
  batchUpsert,
};
