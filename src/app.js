const express = require('express');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');
const authenticate = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

// Import routes
const syncRoutes = require('./routes/sync');
const clientRoutes = require('./routes/clients');
const qbrRoutes = require('./routes/qbr');

// Create Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (no auth required for dashboard)
app.use(express.static(path.join(__dirname, '../public')));

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes (with authentication)
app.use('/sync', authenticate, syncRoutes);
app.use('/clients', authenticate, clientRoutes);
app.use('/clients', authenticate, qbrRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
