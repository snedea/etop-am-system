const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./db');

// Graceful shutdown handler
let server;

async function startServer() {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    await db.raw('SELECT 1');
    logger.info('Database connection successful');

    // Start HTTP server
    server = app.listen(config.port, () => {
      logger.info(`ETop AM System started`, {
        port: config.port,
        env: config.env,
        nodeVersion: process.version
      });
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal) {
  logger.info(`${signal} received, shutting down gracefully`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close database connection
  await db.destroy();
  logger.info('Database connection closed');

  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  shutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();
