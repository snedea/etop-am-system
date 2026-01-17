const db = require('../db');

/**
 * Ticket model - Query helpers for tickets table
 */

/**
 * Find tickets by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<Array>}
 */
async function findByClientId(clientId) {
  return db('tickets').where({ client_id: clientId }).orderBy('created_date', 'desc');
}

/**
 * Find tickets by client ID and date range
 * @param {number} clientId - Client ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>}
 */
async function findByDateRange(clientId, startDate, endDate) {
  return db('tickets')
    .where({ client_id: clientId })
    .whereBetween('created_date', [startDate, endDate])
    .orderBy('created_date', 'desc');
}

/**
 * Count tickets by client ID
 * @param {number} clientId - Client ID
 * @returns {Promise<number>}
 */
async function countByClientId(clientId) {
  const result = await db('tickets').where({ client_id: clientId }).count('id as count').first();
  return parseInt(result.count, 10);
}

/**
 * Count tickets that met SLA
 * @param {number} clientId - Client ID
 * @param {Date} startDate - Optional start date
 * @param {Date} endDate - Optional end date
 * @returns {Promise<number>}
 */
async function countSLAMet(clientId, startDate = null, endDate = null) {
  let query = db('tickets').where({ client_id: clientId, sla_met: true });

  if (startDate && endDate) {
    query = query.whereBetween('created_date', [startDate, endDate]);
  }

  const result = await query.count('id as count').first();
  return parseInt(result.count, 10);
}

/**
 * Count tickets that were reopened
 * @param {number} clientId - Client ID
 * @param {Date} startDate - Optional start date
 * @param {Date} endDate - Optional end date
 * @returns {Promise<number>}
 */
async function countReopened(clientId, startDate = null, endDate = null) {
  let query = db('tickets').where({ client_id: clientId }).where('reopen_count', '>', 0);

  if (startDate && endDate) {
    query = query.whereBetween('created_date', [startDate, endDate]);
  }

  const result = await query.count('id as count').first();
  return parseInt(result.count, 10);
}

/**
 * Get average CSAT score for client
 * @param {number} clientId - Client ID
 * @param {Date} startDate - Optional start date
 * @param {Date} endDate - Optional end date
 * @returns {Promise<number>}
 */
async function getAverageCSAT(clientId, startDate = null, endDate = null) {
  let query = db('tickets').where({ client_id: clientId }).whereNotNull('csat_score');

  if (startDate && endDate) {
    query = query.whereBetween('created_date', [startDate, endDate]);
  }

  const result = await query.avg('csat_score as avg').first();
  return result.avg ? parseFloat(result.avg) : 0;
}

/**
 * Batch upsert tickets
 * @param {Array} tickets - Array of ticket objects
 * @param {Object} trx - Optional transaction
 * @returns {Promise<Array>}
 */
async function batchUpsert(tickets, trx = db) {
  const results = [];
  for (const ticket of tickets) {
    const existing = await trx('tickets')
      .where({ external_id: ticket.external_id, client_id: ticket.client_id })
      .first();

    if (existing) {
      await trx('tickets').where({ id: existing.id }).update(ticket);
      results.push(await trx('tickets').where({ id: existing.id }).first());
    } else {
      const [id] = await trx('tickets').insert(ticket).returning('id');
      results.push(await trx('tickets').where({ id }).first());
    }
  }
  return results;
}

module.exports = {
  findByClientId,
  findByDateRange,
  countByClientId,
  countSLAMet,
  countReopened,
  getAverageCSAT,
  batchUpsert,
};
