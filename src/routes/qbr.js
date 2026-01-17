const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const PgBoss = require('pg-boss');
const config = require('../config');
const clientModel = require('../models/client');
const logger = require('../utils/logger');

// Initialize pg-boss (will be started in worker)
const boss = new PgBoss(config.database.url);

/**
 * POST /clients/:id/qbr/generate
 * Submit QBR generation job to queue
 */
router.post('/:id/qbr/generate', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const options = req.body.options || {};

    // Verify client exists
    const client = await clientModel.findById(clientId);
    if (!client) {
      return res.status(404).json({
        error: 'Client not found',
        details: `Client with ID ${clientId} does not exist`
      });
    }

    // Start boss if not started
    if (!boss.isStarted) {
      await boss.start();
    }

    // Publish job to queue
    const jobId = await boss.send('qbr-generation', {
      client_id: clientId,
      requested_by: req.headers['x-user-email'] || 'system',
      options
    });

    logger.info(`QBR generation job queued for client ${clientId}`, { jobId });

    res.status(202).json({
      job_id: jobId,
      status: 'queued',
      message: `QBR generation started. Poll /clients/${clientId}/qbr/${jobId} for status.`
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /clients/:id/qbr/:jobId
 * Get QBR generation job status
 */
router.get('/:id/qbr/:jobId', async (req, res, next) => {
  try {
    const clientId = parseInt(req.params.id, 10);
    const jobId = req.params.jobId;

    // Start boss if not started
    if (!boss.isStarted) {
      await boss.start();
    }

    // Get job status
    const job = await boss.getJobById(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        details: `Job with ID ${jobId} does not exist`
      });
    }

    // Map pg-boss state to our status
    let status = 'unknown';
    if (job.state === 'created' || job.state === 'retry') {
      status = 'queued';
    } else if (job.state === 'active') {
      status = 'active';
    } else if (job.state === 'completed') {
      status = 'completed';
    } else if (job.state === 'failed') {
      status = 'failed';
    }

    const response = {
      job_id: jobId,
      status,
      created_at: job.createdon
    };

    // If completed, include PDF URL
    if (status === 'completed' && job.output) {
      response.pdf_url = job.output.pdf_url;
      response.completed_at = job.completedon;
    }

    // If active, include progress
    if (status === 'active') {
      response.progress = 'Generating QBR...';
    }

    // If failed, include error
    if (status === 'failed' && job.output) {
      response.error = job.output.error;
    }

    res.json(response);

  } catch (error) {
    next(error);
  }
});

module.exports = router;
