const PgBoss = require('pg-boss');
const path = require('path');
const fs = require('fs').promises;
const config = require('./config');
const logger = require('./utils/logger');
const clientModel = require('./models/client');
const deviceModel = require('./models/device');
const ticketModel = require('./models/ticket');
const riskModel = require('./models/risk');
const { calculateStandardsScore } = require('./engine/standards-score');
const { calculateRiskScore } = require('./engine/risk-score');
const { calculateExperienceScore } = require('./engine/experience-score');
const NarrativeGenerator = require('./qbr/narrative-generator');
const PDFGenerator = require('./qbr/pdf-generator');

// Initialize pg-boss
const boss = new PgBoss(config.database.url);

/**
 * QBR Generation Job Handler
 * Generates complete QBR: scores → narrative → PDF
 */
async function handleQBRGeneration(job) {
  const { client_id, options } = job.data;

  logger.info(`Processing QBR generation for client ${client_id}`, { jobId: job.id });

  try {
    // Step 1: Get client data
    const client = await clientModel.findById(client_id);
    if (!client) {
      throw new Error(`Client ${client_id} not found`);
    }

    // Step 2: Calculate scores
    logger.info(`Calculating scores for client ${client_id}`);
    const [standards, risk, experience] = await Promise.all([
      calculateStandardsScore(client_id),
      calculateRiskScore(client_id),
      calculateExperienceScore(client_id)
    ]);

    // Step 3: Gather data for narrative
    const recentTickets = await ticketModel.findByClientId(client_id);
    const topRisks = await riskModel.getTopRisks(client_id, 5);
    const lifecycleItems = await deviceModel.findByClientId(client_id);

    const narrativeInput = {
      client,
      scores: { standards, risk, experience },
      recent_tickets: recentTickets.slice(0, 20), // Last 20 tickets
      top_risks: topRisks,
      lifecycle_items: lifecycleItems
    };

    // Step 4: Generate narrative
    logger.info(`Generating narrative for client ${client_id}`);
    const narrativeGenerator = new NarrativeGenerator();
    const narrative = await narrativeGenerator.generateNarrative(narrativeInput);

    // Step 5: Prepare data for PDF
    const pdfData = {
      client,
      scores: { standards, risk, experience },
      narrative,
      risks: topRisks,
      wins: extractWins(narrative, standards, risk, experience),
      lifecycle: lifecycleItems.filter(d => {
        // Simplified: flag devices as lifecycle if not seen recently
        if (!d.last_seen) return false;
        const daysSinceLastSeen = (Date.now() - new Date(d.last_seen)) / (1000 * 60 * 60 * 24);
        return daysSinceLastSeen > 365; // Not seen in a year
      }),
      roadmap: narrative.recommendations
    };

    // Step 6: Generate PDF
    logger.info(`Generating PDF for client ${client_id}`);
    const pdfGenerator = new PDFGenerator();
    const pdfBuffer = await pdfGenerator.generateQBR(pdfData);

    // Step 7: Save PDF to outputs directory
    const outputDir = path.join(__dirname, '..', 'outputs');
    await fs.mkdir(outputDir, { recursive: true });

    const pdfFilename = `qbr-client-${client_id}-${job.id}.pdf`;
    const pdfPath = path.join(outputDir, pdfFilename);
    await fs.writeFile(pdfPath, pdfBuffer);

    logger.info(`QBR PDF generated successfully for client ${client_id}`, {
      jobId: job.id,
      pdfPath
    });

    // Return result
    return {
      pdf_url: `/outputs/${pdfFilename}`,
      pdf_path: pdfPath,
      generated_at: new Date()
    };

  } catch (error) {
    logger.error(`QBR generation failed for client ${client_id}`, {
      jobId: job.id,
      error: error.message,
      stack: error.stack
    });

    throw error; // Will trigger retry
  }
}

/**
 * Extract wins from narrative and scores
 */
function extractWins(narrative, standards, risk, experience) {
  const wins = [];

  // Check for improvements in scores
  if (standards.score >= 80) {
    wins.push(`Maintained excellent Standards Compliance score of ${standards.score}`);
  }
  if (risk.score <= 25) {
    wins.push(`Achieved low risk posture with score of ${risk.score}`);
  }
  if (experience.score >= 75) {
    wins.push(`Delivered strong user experience with score of ${experience.score}`);
  }

  // Extract wins from narrative (simplified)
  if (narrative.trends.includes('improv')) {
    wins.push('Demonstrated positive trends in key metrics');
  }

  return wins.length > 0 ? wins : ['Successfully maintained service delivery standards'];
}

/**
 * Start worker
 */
async function startWorker() {
  try {
    logger.info('Starting QBR worker...');

    await boss.start();

    // Subscribe to qbr-generation jobs
    await boss.work('qbr-generation', {
      teamSize: 2, // Process up to 2 jobs concurrently
      teamConcurrency: 1
    }, handleQBRGeneration);

    logger.info('QBR worker started successfully');

  } catch (error) {
    logger.error('Failed to start worker', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down worker`);

  await boss.stop();
  logger.info('Worker stopped');

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the worker
startWorker();
