# Scout Report: ETop AM Intelligence System

## Overview
A vendor-neutral Account Manager intelligence platform for MSPs that generates quarterly business reviews (QBRs), lifecycle plans, security posture reports, and outcome plans. Built with an adapter pattern to be PSA/RMM-agnostic—Phase 1 proves the pattern with ConnectWise Manage, Immy.Bot, and Microsoft 365.

Aligned to Sea-Level Ops methodology: AM handles relationship/business outcomes, TAM/Lead Tech handles standards/technical hygiene, vCIO handles roadmap/risk/lifecycle.

## Requirements

### Functional
- Pull and normalize data from ConnectWise Manage (agreements, tickets, clients, configs)
- Pull and normalize data from Immy.Bot (baselines, drift, compliance)
- Pull and normalize data from Microsoft 365/Security (Entra ID, Defender, Secure Score)
- Calculate three composite scores: Standards Compliance, Risk, Experience (each 0-100)
- Generate AI-powered narratives via OpenAI with strict guardrails
- Produce 9-section QBR PDF output
- Support client segmentation (A/B/C/D) for QBR cadence

### Non-Functional
- Adapter pattern: new integrations must plug in without touching core engine
- Human approval required before client publish
- OpenAI must cite evidence (ticket IDs, device lists, policy states)—no hallucinations
- Database must handle normalized entities with proper indexing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API Layer (Express)                        │
│  POST /sync/connectwise  POST /sync/immy  POST /sync/m365           │
│  GET /clients/:id/scores  POST /clients/:id/qbr/generate            │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Adapter Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ ConnectWise │  │   Immy.Bot  │  │    M365     │                  │
│  │   Adapter   │  │   Adapter   │  │   Adapter   │                  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                  │
│         │                │                │                          │
│         ▼                ▼                ▼                          │
│    [Normalize]      [Normalize]      [Normalize]                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Normalized Data Layer (PostgreSQL)                │
│  Client | Site | Contact | User | Device | Agreement | Ticket       │
│  Control | Risk | Recommendation                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Insights Engine                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │  Standards  │  │    Risk     │  │ Experience  │                  │
│  │   Score     │  │   Score     │  │   Score     │                  │
│  │  (0-100)    │  │  (0-100)    │  │  (0-100)    │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Output Layer                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐                   │
│  │  OpenAI Narrative   │  │   PDF Generator     │                   │
│  │  (4 jobs only)      │  │   (9 sections)      │                   │
│  └─────────────────────┘  └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech Stack
- **Runtime**: Node.js
- **API Framework**: Express
- **Database**: PostgreSQL (normalized relational model)
- **AI/LLM**: OpenAI API (GPT-4 recommended for narrative quality)
- **PDF Generation**: PDFKit or similar
- **Testing**: Jest (implied, standard for Node.js)

## Project Structure

```
etop-am-system-1282/
├── src/
│   ├── adapters/
│   │   ├── connectwise-adapter.js    # CW Manage: agreements, tickets, clients, configs
│   │   ├── immy-adapter.js           # Immy.Bot: baselines, drift, compliance
│   │   └── m365-adapter.js           # M365: Entra ID, Defender, Secure Score
│   ├── engine/
│   │   ├── standards-score.js        # Device coverage, Immy compliance, patch/EDR
│   │   ├── risk-score.js             # Identity, email, endpoint, business risk
│   │   └── experience-score.js       # Tickets/user, repeats, SLA, reopen rate
│   ├── qbr/
│   │   ├── openai-narrative.js       # 4 jobs: trends, narrative, actions, prep
│   │   └── pdf-generator.js          # 9-section QBR PDF
│   ├── routes/
│   │   ├── sync.js                   # POST /sync/* endpoints
│   │   ├── clients.js                # GET /clients/:id/scores
│   │   └── qbr.js                    # POST /clients/:id/qbr/generate
│   ├── models/                       # Database models/ORM
│   ├── db/
│   │   └── migrations/               # PostgreSQL schema migrations
│   ├── config.js                     # App configuration
│   └── index.js                      # Express app entry point
├── tests/
│   ├── mocks/                        # Sample data for each adapter
│   └── e2e/                          # Full flow: mock → normalize → score → PDF
├── .env.example                      # Required API keys template
├── package.json
└── README.md
```

## Conventions

### Adapter Pattern (CRITICAL)
- Each adapter MUST export: `sync(credentials)` → returns normalized data
- Adapters MUST NOT know about other adapters
- Adapters MUST map vendor-specific fields to normalized schema
- New adapters plug into `src/adapters/` without modifying engine code

### Normalized Schema Fields
| Entity | Required Fields |
|--------|-----------------|
| Client | id, name, segment (A/B/C/D), mrr, agreement_start, agreement_end |
| Site | id, client_id, name, address |
| Contact | id, client_id, role (CEO/CFO/IT/Office Manager), email, phone |
| User | id, client_id, email, upn, mfa_enabled, risk_level |
| Device | id, client_id, site_id, type (endpoint/server/network), os, managed, health_status |
| Agreement | id, client_id, mrr, effective_rate, term |
| Ticket | id, client_id, category, priority, status, hours, sla_met, reopen_count, csat |
| Control | id, client_id, control_type, status (pass/fail/unknown), evidence, last_checked |
| Risk | id, client_id, risk_type, likelihood, impact, status |
| Recommendation | id, client_id, title, description, effort, cost_range, priority, quarter |

### OpenAI Guardrails (CRITICAL)
- Use retrieval pattern only—summarize normalized data, never invent
- Force citations: ticket IDs, device lists, policy states
- Four jobs only: trend spotting, narrative reporting, action synthesis, QBR prep
- Human approval required before client publish

### Scoring Formulas
- Standards Compliance (0-100): Device coverage + Immy compliance + Patch compliance + EDR health + M365 Secure Score
- Risk Score (0-100): Identity risk + Email risk + Endpoint risk + Business modifiers
- Experience Score (0-100): Tickets/user trend + Repeat issues + SLA performance + Reopen rate + After-hours incidents

## Entry Points

1. **API Server**: `src/index.js` — Express app bootstrap
2. **Sync Flow**: `POST /sync/*` → adapter → normalize → database
3. **Scoring Flow**: `GET /clients/:id/scores` → engine modules → aggregated response
4. **QBR Flow**: `POST /clients/:id/qbr/generate` → scores + openai-narrative + pdf-generator

## Data Flow for QBR Generation

```
1. Sync Phase (can be triggered separately)
   POST /sync/connectwise → connectwise-adapter → DB (Client, Site, Contact, Agreement, Ticket, Device)
   POST /sync/immy → immy-adapter → DB (Device, Control)
   POST /sync/m365 → m365-adapter → DB (User, Risk, Control)

2. Score Phase
   Read normalized data → standards-score.js → 0-100
   Read normalized data → risk-score.js → 0-100
   Read normalized data → experience-score.js → 0-100

3. Narrative Phase
   Scores + normalized data → openai-narrative.js → {
     trends: "...",
     executive_summary: "...",
     recommendations: [...],
     discussion_points: [...]
   }

4. PDF Phase
   Scores + narratives → pdf-generator.js → QBR PDF (9 sections)
```

## QBR PDF Structure (9 Sections)

1. Executive Summary (1 page, plain English, business outcomes)
2. Three Scores dashboard (Standards/Risk/Experience + movement explanation)
3. Top 5 Risks (with business impact explanation)
4. Top 5 Wins (this quarter's achievements)
5. Service Experience Story (ticket trends, recurring pain points)
6. Security Posture Story (identity/email/endpoint unified view)
7. Lifecycle Forecast (aging gear, refresh schedule, 12-36 month budget)
8. Roadmap (Now/Next/Later format)
9. Outcome Plan (action items → owners → due dates)

## Client Segmentation

| Segment | QBR Cadence | Criteria |
|---------|-------------|----------|
| A/B | Quarterly | Higher % of agreement revenue |
| C | Semiannual | Medium revenue |
| D | Annual | Lower revenue |

Follows Sea-Level Ops "5% rule": AM time investment proportional to agreement revenue.

## Gotchas

1. **Immy.Bot is "desired state truth"** — Standards compliance heavily weighted toward Immy data, not traditional RMM
2. **No traditional RMM adapter** — Phase 1 uses Immy.Bot as the device management source
3. **OpenAI must not hallucinate** — Every claim needs evidence from normalized data; system prompt must enforce citations
4. **Scores are composites** — Each 0-100 score aggregates multiple weighted inputs; document weights explicitly
5. **Segment affects cadence, not content** — All clients get same QBR quality, just different frequency
6. **Human approval gate** — QBR generation should produce draft status, not auto-publish

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ConnectWise API rate limits | Medium | High | Implement exponential backoff, cache aggressively, batch requests |
| Immy.Bot API documentation gaps | Medium | Medium | Build adapter against actual API responses, maintain mock data |
| Microsoft Graph permission complexity | High | Medium | Document exact Graph API scopes needed, provide setup guide |
| OpenAI output inconsistency | Medium | High | Strict system prompts, JSON mode, validation layer before PDF |
| PDF formatting complexity | Low | Medium | Use PDFKit's declarative API, test with various data volumes |
| Scoring formula tuning | High | Medium | Make weights configurable, document baseline assumptions |

## Out of Scope (Phase 1)

- Multi-PSA support (only ConnectWise Manage)
- Traditional RMM adapters (only Immy.Bot)
- Automation workflows (pre/post QBR)
- Client portal UI
- Project/ticket auto-creation in PSA
- Full lifecycle warranty tracking

## Environment Variables Required

```
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/etop_am

# ConnectWise Manage
CW_COMPANY_ID=
CW_PUBLIC_KEY=
CW_PRIVATE_KEY=
CW_CLIENT_ID=
CW_BASE_URL=

# Immy.Bot
IMMY_API_KEY=
IMMY_BASE_URL=

# Microsoft 365 / Graph API
M365_TENANT_ID=
M365_CLIENT_ID=
M365_CLIENT_SECRET=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4

# App Settings
NODE_ENV=development
PORT=3000
```

## Success Criteria (Phase 1)

1. Mock data syncs through all three adapters → normalized DB tables populated
2. Scores calculate correctly from normalized data
3. OpenAI generates narratives with citations (no hallucinations)
4. PDF contains all 9 sections with real data
5. End-to-end test passes: mock data → normalize → score → generate QBR PDF
