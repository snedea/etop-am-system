const express = require('express');
const router = express.Router();
const ConnectWiseAdapter = require('../adapters/connectwise-adapter');
const ImmyAdapter = require('../adapters/immy-adapter');
const M365Adapter = require('../adapters/m365-adapter');
const config = require('../config');
const db = require('../db');
const clientModel = require('../models/client');
const deviceModel = require('../models/device');
const ticketModel = require('../models/ticket');
const userModel = require('../models/user');
const controlModel = require('../models/control');
const riskModel = require('../models/risk');
const logger = require('../utils/logger');

/**
 * POST /sync/connectwise
 * Sync data from ConnectWise Manage
 */
router.post('/connectwise', async (req, res, next) => {
  try {
    const credentials = req.body.credentials || config.connectwise;

    // Initialize adapter and sync
    const adapter = new ConnectWiseAdapter(config);
    const normalizedData = await adapter.sync(credentials);

    // Persist to database in transaction
    const result = await db.transaction(async (trx) => {
      // Insert/update clients
      const clients = await clientModel.batchUpsert(normalizedData.clients, trx);

      // Insert/update related entities
      // Note: We need to map external IDs to database IDs
      const clientIdMap = {};
      clients.forEach(client => {
        clientIdMap[client.external_id] = client.id;
      });

      // Insert tickets (assuming they have company ID that maps to client external_id)
      const ticketsToInsert = normalizedData.tickets.map(ticket => ({
        ...ticket,
        client_id: clientIdMap[ticket.external_id] || clients[0]?.id // Simplified mapping
      }));
      await ticketModel.batchUpsert(ticketsToInsert.filter(t => t.client_id), trx);

      // Insert devices
      const devicesToInsert = normalizedData.devices.map(device => ({
        ...device,
        client_id: clients[0]?.id // Simplified: assign to first client
      }));
      await deviceModel.batchUpsert(devicesToInsert.filter(d => d.client_id), trx);

      return {
        synced_at: new Date(),
        record_counts: {
          clients: clients.length,
          agreements: normalizedData.agreements.length,
          tickets: ticketsToInsert.filter(t => t.client_id).length,
          devices: devicesToInsert.filter(d => d.client_id).length
        }
      };
    });

    logger.info('ConnectWise sync completed', result.record_counts);

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /sync/immy
 * Sync data from Immy.Bot
 */
router.post('/immy', async (req, res, next) => {
  try {
    const credentials = req.body.credentials || config.immy;

    // Initialize adapter and sync
    const adapter = new ImmyAdapter(config);
    const normalizedData = await adapter.sync(credentials);

    // Persist to database in transaction
    const result = await db.transaction(async (trx) => {
      // Get existing clients
      const clients = await clientModel.findAll();

      if (clients.length === 0) {
        throw new Error('No clients found. Please sync ConnectWise first.');
      }

      // Insert/update devices (map to first client for simplification)
      const devicesToInsert = normalizedData.devices.map(device => ({
        ...device,
        client_id: clients[0].id
      }));
      await deviceModel.batchUpsert(devicesToInsert, trx);

      // Insert controls
      const controlsToInsert = normalizedData.controls.map(control => ({
        ...control,
        client_id: clients[0].id
      }));
      await controlModel.batchUpsert(controlsToInsert, trx);

      return {
        synced_at: new Date(),
        record_counts: {
          devices: devicesToInsert.length,
          controls: controlsToInsert.length
        }
      };
    });

    logger.info('Immy.Bot sync completed', result.record_counts);

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * POST /sync/m365
 * Sync data from Microsoft 365
 */
router.post('/m365', async (req, res, next) => {
  try {
    const credentials = req.body.credentials || config.m365;

    // Initialize adapter and sync
    const adapter = new M365Adapter(config);
    const normalizedData = await adapter.sync(credentials);

    // Persist to database in transaction
    const result = await db.transaction(async (trx) => {
      // Get existing clients
      const clients = await clientModel.findAll();

      if (clients.length === 0) {
        throw new Error('No clients found. Please sync ConnectWise first.');
      }

      // Insert users
      const usersToInsert = normalizedData.users.map(user => ({
        ...user,
        client_id: clients[0].id
      }));
      await userModel.batchUpsert(usersToInsert, trx);

      // Insert controls
      const controlsToInsert = normalizedData.controls.map(control => ({
        ...control,
        client_id: clients[0].id
      }));
      await controlModel.batchUpsert(controlsToInsert, trx);

      // Insert risks
      const risksToInsert = normalizedData.risks.map(risk => ({
        ...risk,
        client_id: clients[0].id
      }));
      await riskModel.batchUpsert(risksToInsert, trx);

      return {
        synced_at: new Date(),
        record_counts: {
          users: usersToInsert.length,
          controls: controlsToInsert.length,
          risks: risksToInsert.length
        }
      };
    });

    logger.info('M365 sync completed', result.record_counts);

    res.json(result);

  } catch (error) {
    next(error);
  }
});

module.exports = router;
