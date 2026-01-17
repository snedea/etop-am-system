#!/bin/bash

# ETop AM System - Reset and Start Script
# This script stops all running processes, resets the database, and starts fresh

set -e

echo "🛑 Stopping any running processes..."
pkill -f "node src/server.js" 2>/dev/null || true
pkill -f "node src/worker.js" 2>/dev/null || true
sleep 1

echo "🗄️  Clearing database..."
cd "$(dirname "$0")/.."
node -e "
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const db = require('./src/db');
(async () => {
  try {
    await db.raw('TRUNCATE clients, sites, contacts, users, devices, agreements, tickets, controls, risks, recommendations RESTART IDENTITY CASCADE');
    console.log('✅ Database cleared');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
"

echo "🌱 Seeding mock data..."
node scripts/seed-mock-data.js

echo ""
echo "✅ Reset complete!"
echo ""
echo "Next steps:"
echo "  1. Start server:  npm start"
echo "  2. Start worker:  npm run worker  (in another terminal)"
echo "  3. Generate QBR:  node scripts/generate-test-qbr.js"
echo ""
