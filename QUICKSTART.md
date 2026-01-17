# ETop AM Intelligence System - Quick Start

## Prerequisites

✅ PostgreSQL running on port 5433 (via Docker)
✅ Node.js installed
✅ Dependencies installed (`npm install` already run)

## Database is Already Running

Your PostgreSQL container is running on port 5433:
```bash
docker ps | grep postgres
```

If it's not running:
```bash
docker-compose up -d postgres
```

## Common Tasks

### 1. Reset Database & Reseed Mock Data
```bash
./scripts/reset-and-start.sh
```

### 2. Generate Test QBR PDF
```bash
node scripts/generate-test-qbr.js
```

This creates a PDF in `outputs/` with:
- Executive summary
- Three scores (Standards/Risk/Experience)
- Top risks and wins
- Security posture
- Lifecycle forecast
- Roadmap

### 3. Start API Server
```bash
npm start
```

Server runs on http://localhost:3000

### 4. Test API Endpoints

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Get Client Scores:**
```bash
curl http://localhost:3000/clients/1/scores \
  -H "Authorization: Bearer your-api-key-here" | jq .
```

**Generate QBR (async):**
```bash
curl -X POST http://localhost:3000/clients/1/qbr/generate \
  -H "Authorization: Bearer your-api-key-here" \
  -H "Content-Type: application/json" | jq .
```

## Troubleshooting

### Port 3000 already in use
```bash
# Kill any running node processes
pkill -f "node src/server.js"
pkill -f "node src/worker.js"

# Then restart
npm start
```

### Database connection errors
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### "Duplicate key" error when seeding
```bash
# Clear the database first
./scripts/reset-and-start.sh
```

## Architecture

```
┌─────────────────────────────────────────────┐
│          Express API (Port 3000)            │
├─────────────────────────────────────────────┤
│  /health                                    │
│  /sync/{connectwise|immy|m365}              │
│  /clients/:id/scores                        │
│  /clients/:id/qbr/generate                  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│         Adapter Layer (Normalize)           │
├─────────────────────────────────────────────┤
│  • ConnectWise Manage Adapter               │
│  • Immy.Bot Adapter                         │
│  • Microsoft 365/Security Adapter           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    PostgreSQL (Normalized Data Model)       │
├─────────────────────────────────────────────┤
│  Clients, Sites, Contacts, Users            │
│  Devices, Agreements, Tickets               │
│  Controls, Risks, Recommendations           │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│          Scoring Engine (Pure Logic)        │
├─────────────────────────────────────────────┤
│  • Standards Compliance (0-100)             │
│  • Risk Score (0-100)                       │
│  • Experience Score (0-100)                 │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│      Output Layer (OpenAI + PDFKit)         │
├─────────────────────────────────────────────┤
│  • Narrative Generator (GPT-4)              │
│  • PDF Generator (9 sections)               │
│  • Background Jobs (pg-boss)                │
└─────────────────────────────────────────────┘
```

## Mock Data

The seed script creates:
- 1 client (Acme Corporation)
- 1 site (Headquarters)
- 2 contacts (CEO, IT Manager)
- 2 users (john@acmecorp.com, jane@acmecorp.com)
- 3 devices (2 workstations, 1 server)
- 1 agreement ($5K MRR)
- 3 tickets (closed)
- 3 controls (2 passing, 1 failing)
- 2 risks (MFA gap, device health)
- 3 recommendations (Q1-Q2 roadmap)

## Scores Breakdown

**Standards: 69/100**
- Device coverage: 100% (all managed)
- Immy compliance: 67% (2/3 controls passing)
- Patch compliance: 67% (2/3 devices healthy)
- EDR health: 100% (all covered)
- M365 Secure Score: 0% (no data)

**Risk: 22/100** (lower is better)
- Identity risk: 35 (50% MFA coverage)
- Email risk: 10 (no alerts)
- Endpoint risk: 5 (1 open risk)
- Business modifier: 40 (standard)

**Experience: 50/100**
- Baseline (no historical ticket data yet)

## Next Steps

1. **Add real API credentials** in `.env`:
   - ConnectWise Manage
   - Immy.Bot
   - Microsoft 365
   - OpenAI

2. **Sync real data** from integrations

3. **Generate production QBRs** with AI narratives

4. **Build Phase 2 features**:
   - Multi-PSA support
   - Additional RMM adapters
   - Automation workflows
   - Client portal UI
