# Architecture: ETop AM Intelligence System

## Problem Statement
We're building a vendor-neutral Account Manager intelligence platform for MSPs that automates quarterly business reviews (QBRs), lifecycle planning, security posture reporting, and outcome planning. The system must pull data from multiple vendor platforms (ConnectWise Manage, Immy.Bot, Microsoft 365), normalize it into a unified model, calculate three composite health scores (Standards Compliance, Risk, Experience), and generate AI-powered narrative QBR PDFs with strict evidence-based guardrails. 

The architecture must support the Sea-Level Ops methodology where AMs focus on business outcomes, not technical details, and must be extensible via an adapter pattern so future PSA/RMM integrations don't require core engine changes.

## Constraints
- **Adapter pattern is non-negotiable**: New integrations must plug in without modifying core engine code
- **Human approval gate**: QBRs must be draft status, never auto-published to clients
- **No hallucinations**: OpenAI must cite evidence (ticket IDs, device lists, policy states) from normalized data
- **Normalized relational model**: PostgreSQL with proper indexing for multi-vendor data correlation
- **Phase 1 scope**: ConnectWise Manage, Immy.Bot, M365 only (no traditional RMM, no multi-PSA)
- **Node.js runtime**: Express API, PostgreSQL database
- **Three composite scores**: Each 0-100, weighted aggregates with documented formulas

## Options Considered

### Option A: Monolithic Express App with Adapter Layer

**Description:** Single Node.js/Express application with:
- Adapter modules that implement a common interface (`sync(credentials) → normalized data`)
- PostgreSQL database with normalized entity schema
- Three scoring engine modules that read from normalized tables
- OpenAI integration layer with strict prompt templates
- PDFKit-based generator

**Pros:**
- Simple deployment (single process)
- Direct database access eliminates network latency between components
- Easier to reason about data flow and debug
- Lower operational complexity (no service mesh, no inter-service auth)
- Adapter pattern isolates vendor-specific logic without microservice overhead

**Cons:**
- Single point of failure (entire system down if Express crashes)
- Harder to scale individual components (can't scale PDF generation separately from API)
- Mixing sync jobs with API requests in same process could cause resource contention

**Complexity:** Medium  
**Risk:** Low (proven pattern for LOB apps)

---

### Option B: Event-Driven Microservices with Message Queue

**Description:** Separate services for:
- API Gateway (Express)
- Sync Worker Pool (consumes jobs from queue)
- Scoring Engine Service
- Narrative Generator Service (OpenAI wrapper)
- PDF Generator Service
- Shared PostgreSQL database
- RabbitMQ or Redis Streams for job orchestration

**Pros:**
- Independent scaling (can add PDF workers during high load)
- Fault isolation (sync failure doesn't crash API)
- Natural async processing (QBR generation is inherently async)
- Better observability boundaries (per-service metrics)

**Cons:**
- Operational complexity: need to run/monitor 5+ services + message broker
- Network latency between services
- Distributed transaction complexity (sync → normalize → score spans multiple services)
- Debugging harder (trace requests across service boundaries)
- Over-engineered for Phase 1 scope (3 clients? 10 clients?)

**Complexity:** High  
**Risk:** Medium (introduces infrastructure dependencies before proving product-market fit)

---

### Option C: Serverless Functions (AWS Lambda / Vercel Functions)

**Description:**
- API routes as serverless functions
- Adapter sync jobs as long-running Lambda functions
- PostgreSQL on RDS/Neon
- OpenAI + PDFKit in Lambda
- Step Functions for QBR generation orchestration

**Pros:**
- Auto-scaling per function
- Pay-per-execution pricing
- No server management

**Cons:**
- Cold start latency (PDF generation could timeout)
- Lambda execution limits (15min max, PDF generation with large datasets risky)
- Vendor lock-in (hard to migrate off AWS Step Functions)
- Local development harder (need SAM/Serverless Framework)
- PostgreSQL connection pooling complexity (Lambda spins up many connections)
- Immy.Bot/CW Manage sync could exceed execution limits

**Complexity:** High  
**Risk:** High (execution time limits are a blocker for sync jobs and PDF generation)

---

## Recommended Approach

**Choice:** Option A — Monolithic Express App with Adapter Layer

**Rationale:**
This is a **Phase 1 proof-of-concept** for a vendor-neutral MSP intelligence platform. The primary risk is validating the adapter pattern and scoring algorithm quality, not scale. Option A delivers:

1. **Fastest path to validating the core hypothesis**: Does the adapter pattern work? Do the scores correlate with real business outcomes? Is OpenAI output trustworthy?
2. **Acceptable technical risk**: A well-architected Express monolith can handle 100+ MSP clients with proper indexing and caching
3. **Defer scaling complexity**: If Phase 1 succeeds, we can extract bottleneck components (PDF generation, sync workers) into services later—but we ship faster now
4. **Operational simplicity**: One Docker container, one database, standard Node.js monitoring tools

**Tradeoffs we're accepting:**
- Can't independently scale PDF generation (mitigated by making it async with job queue table)
- Single process failure takes down API (mitigated by process manager like PM2 and container restart policies)

**What we're NOT accepting:**
- We maintain strict adapter boundaries (adapters have zero knowledge of each other)
- Scoring engine modules are pure functions (easy to extract later)
- Database schema is normalized and vendor-agnostic (no CW-specific columns in core tables)

---

## Decision Log

| Decision | Choice | Alternatives Rejected | Rationale |
|----------|--------|----------------------|-----------|
| Architecture Pattern | Monolithic Express app | Microservices, Serverless | Simplicity for Phase 1; can extract services later if needed |
| Database | PostgreSQL (relational) | MongoDB, DynamoDB | Normalized vendor-agnostic schema requires relational integrity; complex joins for scoring |
| PDF Generation | PDFKit (in-process) | External service, headless Chrome | Lightweight, declarative API; no browser overhead |
| AI Provider | OpenAI GPT-4 | Claude, self-hosted LLM | Best-in-class narrative quality; JSON mode for structured output |
| Async Jobs | Database-backed queue (pg-boss) | Redis Queue, RabbitMQ | Reuses PostgreSQL; no extra infrastructure; ACID guarantees |
| ORM | Knex.js (query builder) | Prisma, TypeORM | Lightweight; direct SQL control; easier to optimize complex scoring queries |
| API Auth | API key per integration | OAuth, JWT | Simpler for server-to-server; can add OAuth for future portal |

---

## Technology Stack
- **Language:** Node.js 20 LTS (JavaScript)
- **Framework:** Express 4.x
- **Database:** PostgreSQL 15+
- **Query Builder:** Knex.js (with migrations)
- **Job Queue:** pg-boss (PostgreSQL-backed)
- **AI/LLM:** OpenAI API (GPT-4)
- **PDF Generation:** PDFKit
- **Testing:** Jest + Supertest (API tests)
- **Validation:** Joi (request/config validation)
- **Logging:** Winston (structured JSON logs)

---

## System Architecture

**Pattern:** Layered monolith with adapter-based integration layer

```
┌─────────────────────────────────────────────────────────────────────┐
│                        API Layer (Express)                           │
│  /sync/connectwise  /sync/immy  /sync/m365                          │
│  /clients/:id/scores  /clients/:id/qbr/generate                     │
│  [Handles auth, validation, response formatting]                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Adapter Layer                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  ConnectWise    │  │    Immy.Bot     │  │      M365       │     │
│  │    Adapter      │  │     Adapter     │  │     Adapter     │     │
│  │ sync(creds) →   │  │  sync(creds) →  │  │  sync(creds) →  │     │
│  │ normalized[]    │  │  normalized[]   │  │  normalized[]   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│  [Each adapter: fetch vendor data → transform → return normalized]  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│               Normalized Data Layer (PostgreSQL + Knex)              │
│  clients │ sites │ contacts │ users │ devices │ agreements │        │
│  tickets │ controls │ risks │ recommendations                       │
│  [Relational schema, indexed for scoring queries]                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Insights Engine (Pure Functions)                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Standards Score  │  │   Risk Score     │  │ Experience Score │  │
│  │  calculateStd()  │  │  calculateRisk() │  │  calculateExp()  │  │
│  │  → 0-100 + breakdown │  → 0-100 + breakdown │ → 0-100 + breakdown │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│  [Reads normalized data, applies weighted formulas, returns scores] │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Output Layer                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐             │
│  │  Narrative Generator │      │   PDF Generator      │             │
│  │  (OpenAI GPT-4)      │  →   │   (PDFKit)           │             │
│  │  - Trend spotting    │      │   9 sections:        │             │
│  │  - Executive summary │      │   1. Executive       │             │
│  │  - Action synthesis  │      │   2. Score Dashboard │             │
│  │  - QBR prep notes    │      │   3. Top 5 Risks     │             │
│  │  [Strict prompts,    │      │   4. Top 5 Wins      │             │
│  │   citation required] │      │   5. Service Story   │             │
│  └──────────────────────┘      │   6. Security Story  │             │
│                                │   7. Lifecycle       │             │
│                                │   8. Roadmap         │             │
│                                │   9. Outcome Plan    │             │
│                                └──────────────────────┘             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Job Queue (pg-boss)                             │
│  qbr_generation_jobs (client_id, status, result_url, created_at)    │
│  [Async QBR generation, retry logic, human approval workflow]       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
etop-am-system-1282/
├── src/
│   ├── adapters/
│   │   ├── base-adapter.js           # Abstract interface all adapters implement
│   │   ├── connectwise-adapter.js    # CW Manage: agreements, tickets, clients, configs
│   │   ├── immy-adapter.js           # Immy.Bot: baselines, drift, compliance
│   │   └── m365-adapter.js           # M365: Entra ID, Defender, Secure Score
│   ├── engine/
│   │   ├── standards-score.js        # Pure function: data → 0-100 + breakdown
│   │   ├── risk-score.js             # Pure function: data → 0-100 + breakdown
│   │   └── experience-score.js       # Pure function: data → 0-100 + breakdown
│   ├── qbr/
│   │   ├── narrative-generator.js    # OpenAI integration with strict prompts
│   │   └── pdf-generator.js          # PDFKit: scores + narratives → 9-section PDF
│   ├── routes/
│   │   ├── sync.js                   # POST /sync/connectwise, /sync/immy, /sync/m365
│   │   ├── clients.js                # GET /clients/:id/scores
│   │   └── qbr.js                    # POST /clients/:id/qbr/generate, GET /clients/:id/qbr/:jobId
│   ├── models/
│   │   ├── client.js                 # Knex query helpers for clients table
│   │   ├── device.js                 # Knex query helpers for devices table
│   │   ├── ticket.js                 # Knex query helpers for tickets table
│   │   └── ...                       # (one per entity type)
│   ├── db/
│   │   ├── knexfile.js               # Knex configuration
│   │   └── migrations/               # Timestamped migration files
│   │       ├── 001_create_clients.js
│   │       ├── 002_create_sites.js
│   │       ├── 003_create_devices.js
│   │       └── ...
│   ├── middleware/
│   │   ├── auth.js                   # API key validation
│   │   ├── error-handler.js          # Centralized error responses
│   │   └── validation.js             # Joi schema validation
│   ├── utils/
│   │   ├── logger.js                 # Winston configuration
│   │   └── cache.js                  # Simple in-memory cache for scores
│   ├── config.js                     # Centralized config (reads from .env)
│   ├── app.js                        # Express app setup (routes, middleware)
│   ├── server.js                     # HTTP server + graceful shutdown
│   └── worker.js                     # pg-boss worker (processes QBR jobs)
├── tests/
│   ├── unit/
│   │   ├── engine/                   # Test scoring formulas with known inputs
│   │   └── adapters/                 # Test adapter normalization logic
│   ├── integration/
│   │   └── api/                      # Test API endpoints with test DB
│   ├── e2e/
│   │   └── qbr-generation.test.js    # Full flow: mock data → PDF output
│   └── mocks/
│       ├── connectwise-response.json # Sample CW Manage API response
│       ├── immy-response.json        # Sample Immy.Bot API response
│       └── m365-response.json        # Sample Microsoft Graph response
├── .env.example                      # Template for required env vars
├── .gitignore
├── package.json
├── package-lock.json
├── Dockerfile                        # Production container image
├── docker-compose.yml                # Local dev: app + PostgreSQL
├── jest.config.js                    # Jest configuration
└── README.md                         # Setup guide, API docs, architecture overview
```

---

## Component Interfaces

### API Layer → Adapter Layer

**Method:** Direct function call  
**Contract:**
```javascript
// All adapters must implement this interface
interface BaseAdapter {
  /**
   * Sync data from vendor platform
   * @param {Object} credentials - Vendor-specific auth credentials
   * @returns {Promise<NormalizedData>} - Normalized entities
   * @throws {AdapterError} - If API call fails or data invalid
   */
  async sync(credentials): Promise<{
    clients: Client[],
    sites: Site[],
    contacts: Contact[],
    users: User[],
    devices: Device[],
    agreements: Agreement[],
    tickets: Ticket[],
    controls: Control[],
    risks: Risk[],
    recommendations: Recommendation[]
  }>
}
```

**Errors:**
- `AdapterError` (401: auth failure, 429: rate limit, 500: vendor API down)

---

### Adapter Layer → Database Layer

**Method:** Knex.js transaction (batch insert/upsert)  
**Contract:**
```javascript
// After adapter returns normalized data, persist to DB
async function persistNormalizedData(normalizedData, trx) {
  // Upsert clients (keyed by external vendor ID)
  await trx('clients').insert(normalizedData.clients).onConflict('external_id').merge();
  
  // Cascade inserts for related entities
  await trx('sites').insert(normalizedData.sites).onConflict('external_id').merge();
  // ... repeat for all entities
  
  return { synced_at: new Date(), record_counts: {...} };
}
```

**Errors:**
- `DatabaseError` (constraint violation, connection timeout)

---

### API Layer → Insights Engine

**Method:** Direct function call (pure function, no side effects)  
**Contract:**
```javascript
/**
 * Calculate Standards Compliance score
 * @param {number} clientId - Client database ID
 * @returns {Promise<ScoreResult>}
 */
async function calculateStandardsScore(clientId): Promise<{
  score: number,              // 0-100
  breakdown: {
    device_coverage: { score: number, weight: number, evidence: {...} },
    immy_compliance: { score: number, weight: number, evidence: {...} },
    patch_compliance: { score: number, weight: number, evidence: {...} },
    edr_health: { score: number, weight: number, evidence: {...} },
    m365_secure_score: { score: number, weight: number, evidence: {...} }
  },
  computed_at: Date
}>
```

**Errors:**
- `InsufficientDataError` (not enough data to calculate score)

---

### Insights Engine → Narrative Generator

**Method:** Direct function call (passes scores + evidence)  
**Contract:**
```javascript
/**
 * Generate AI narrative from scores and evidence
 * @param {Object} input - Scores + normalized data excerpts
 * @returns {Promise<Narrative>}
 */
async function generateNarrative(input): Promise<{
  trends: string,               // "Ticket volume decreased 15% QoQ..."
  executive_summary: string,    // Plain English, business outcomes
  recommendations: Array<{
    title: string,
    description: string,
    priority: 'high' | 'medium' | 'low',
    evidence: string[]          // REQUIRED: ticket IDs, device names, etc.
  }>,
  discussion_points: string[]   // Topics for QBR meeting
}>
```

**Errors:**
- `OpenAIError` (API failure, token limit exceeded, content filter triggered)
- `HallucinationDetectedError` (validation finds claims without evidence)

---

### Narrative Generator → PDF Generator

**Method:** Direct function call  
**Contract:**
```javascript
/**
 * Generate QBR PDF
 * @param {Object} data - Scores + narratives + client metadata
 * @returns {Promise<Buffer>} - PDF binary
 */
async function generateQBR(data): Promise<Buffer>
```

**Errors:**
- `PDFGenerationError` (template error, data formatting issue)

---

### API Layer → Job Queue

**Method:** pg-boss publish/subscribe  
**Contract:**
```javascript
// Publish QBR generation job
await boss.publish('qbr-generation', {
  client_id: 123,
  requested_by: 'user@msp.com',
  options: { include_lifecycle: true }
});

// Worker subscribes and processes
boss.subscribe('qbr-generation', async (job) => {
  const { client_id, options } = job.data;
  
  // Execute: scores → narrative → PDF
  const result = await generateFullQBR(client_id, options);
  
  return result; // pg-boss stores in job result field
});
```

**Errors:**
- Job retry (3 attempts with exponential backoff)
- Dead letter queue after max retries

---

## Module Specifications

### Module: ConnectWise Adapter
**Responsibility:** Fetch and normalize ConnectWise Manage data  
**Key Files:** `src/adapters/connectwise-adapter.js`  
**Dependencies:** axios (HTTP), date-fns (date parsing)  
**Public Interface:**
```javascript
class ConnectWiseAdapter extends BaseAdapter {
  async sync(credentials): Promise<NormalizedData>
  
  // Internal methods (not exported)
  private async fetchClients()
  private async fetchAgreements()
  private async fetchTickets()
  private async fetchConfigurations()
  private normalizeClient(cwClient): Client
  private normalizeTicket(cwTicket): Ticket
}
```

---

### Module: Immy.Bot Adapter
**Responsibility:** Fetch and normalize Immy.Bot compliance data  
**Key Files:** `src/adapters/immy-adapter.js`  
**Dependencies:** axios  
**Public Interface:**
```javascript
class ImmyAdapter extends BaseAdapter {
  async sync(credentials): Promise<NormalizedData>
  
  private async fetchComputers()
  private async fetchBaselines()
  private async fetchDriftReports()
  private normalizeDevice(immyComputer): Device
  private normalizeControl(immyBaseline): Control
}
```

---

### Module: M365 Adapter
**Responsibility:** Fetch and normalize Microsoft 365 security data  
**Key Files:** `src/adapters/m365-adapter.js`  
**Dependencies:** @microsoft/microsoft-graph-client  
**Public Interface:**
```javascript
class M365Adapter extends BaseAdapter {
  async sync(credentials): Promise<NormalizedData>
  
  private async fetchUsers()           // Entra ID users
  private async fetchSecureScore()     // Microsoft Secure Score
  private async fetchDefenderAlerts()  // Defender for Endpoint
  private normalizeUser(graphUser): User
  private normalizeRisk(defenderAlert): Risk
  private normalizeControl(secureScoreControl): Control
}
```

---

### Module: Standards Score Engine
**Responsibility:** Calculate Standards Compliance (0-100)  
**Key Files:** `src/engine/standards-score.js`  
**Dependencies:** Knex (database queries)  
**Public Interface:**
```javascript
export async function calculateStandardsScore(clientId): Promise<ScoreResult>

// Weighted components (internal)
- deviceCoverageScore()      // 20%: % devices under management
- immyComplianceScore()      // 30%: % devices passing Immy baselines
- patchComplianceScore()     // 20%: % devices patched (30-day window)
- edrHealthScore()           // 15%: EDR installed + reporting
- m365SecureScore()          // 15%: Microsoft Secure Score normalized
```

---

### Module: Risk Score Engine
**Responsibility:** Calculate Risk score (0-100, inverse: higher = more risk)  
**Key Files:** `src/engine/risk-score.js`  
**Dependencies:** Knex  
**Public Interface:**
```javascript
export async function calculateRiskScore(clientId): Promise<ScoreResult>

// Weighted components
- identityRiskScore()        // 30%: MFA coverage, risky users, stale accounts
- emailRiskScore()           // 25%: Defender for Office alerts, phishing simulations
- endpointRiskScore()        // 25%: Unpatched devices, missing EDR, high-risk detections
- businessModifierScore()    // 20%: Industry (healthcare +10 risk), compliance requirements
```

---

### Module: Experience Score Engine
**Responsibility:** Calculate Experience score (0-100)  
**Key Files:** `src/engine/experience-score.js`  
**Dependencies:** Knex  
**Public Interface:**
```javascript
export async function calculateExperienceScore(clientId): Promise<ScoreResult>

// Weighted components
- ticketsPerUserTrend()      // 25%: Trending down = higher score
- repeatIssueRate()          // 20%: Same issue recurring = lower score
- slaPerformance()           // 25%: % tickets meeting SLA
- reopenRate()               // 15%: % tickets reopened
- afterHoursIncidents()      // 15%: Fewer = higher score
```

---

### Module: Narrative Generator
**Responsibility:** Generate AI narrative with citations  
**Key Files:** `src/qbr/narrative-generator.js`  
**Dependencies:** openai (OpenAI SDK)  
**Public Interface:**
```javascript
export async function generateNarrative(input: {
  client: Client,
  scores: { standards: ScoreResult, risk: ScoreResult, experience: ScoreResult },
  recent_tickets: Ticket[],
  top_risks: Risk[],
  lifecycle_items: Device[]
}): Promise<Narrative>

// Internal: four OpenAI jobs
- spotTrends()               // Analyze quarter-over-quarter movement
- writeExecutiveSummary()    // Plain English business outcomes
- synthesizeActions()        // Recommendations with effort/cost
- prepareDiscussionPoints()  // Topics for live QBR meeting
```

**Prompt Template (Example for Executive Summary):**
```
You are an Account Manager writing a quarterly business review for {client.name}.

STRICT RULES:
1. Only use facts from the PROVIDED DATA below. Never invent ticket IDs, device names, or metrics.
2. Every claim must cite evidence: [Ticket #12345], [Device: WS-ACCT-01], [Policy: MFA Enforcement].
3. Write in plain English for a non-technical executive audience.
4. Focus on business outcomes (user productivity, risk reduction, cost avoidance), not technical details.

PROVIDED DATA:
{JSON.stringify(input, null, 2)}

Write a 3-paragraph executive summary:
1. Overall health this quarter (reference the three scores)
2. Biggest win (with evidence)
3. Top priority for next quarter (with business justification)
```

---

### Module: PDF Generator
**Responsibility:** Render 9-section QBR PDF  
**Key Files:** `src/qbr/pdf-generator.js`  
**Dependencies:** pdfkit, pdfkit-table (tables)  
**Public Interface:**
```javascript
export async function generateQBR(data: {
  client: Client,
  scores: ScoreResults,
  narrative: Narrative,
  risks: Risk[],
  wins: string[],
  lifecycle: Device[],
  roadmap: Recommendation[]
}): Promise<Buffer>

// Internal: one function per section
- renderExecutiveSummary()
- renderScoreDashboard()      // Gauge charts for 3 scores
- renderTopRisks()            // Table with business impact
- renderTopWins()             // Bulleted list
- renderServiceStory()        // Ticket trend charts
- renderSecurityStory()       // Identity/Email/Endpoint breakdown
- renderLifecycleForecast()   // Aging device table + 12-36mo budget
- renderRoadmap()             // Now/Next/Later columns
- renderOutcomePlan()         // Action items with owners + dates
```

---

## Data Models

### PostgreSQL Schema (Normalized)

```sql
-- Core entities
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL, -- Vendor-specific ID
  source VARCHAR(50) NOT NULL,              -- 'connectwise', 'immy', 'm365'
  name VARCHAR(255) NOT NULL,
  segment CHAR(1) CHECK (segment IN ('A', 'B', 'C', 'D')),
  mrr DECIMAL(10,2),
  agreement_start DATE,
  agreement_end DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_clients_external ON clients(external_id, source);

CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  name VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_sites_client ON sites(client_id);

CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  role VARCHAR(100),                        -- 'CEO', 'CFO', 'IT Manager', etc.
  email VARCHAR(255),
  phone VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_contacts_client ON contacts(client_id);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  email VARCHAR(255),
  upn VARCHAR(255),                         -- User Principal Name (M365)
  mfa_enabled BOOLEAN DEFAULT FALSE,
  risk_level VARCHAR(20),                   -- 'none', 'low', 'medium', 'high'
  last_sign_in TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_users_client ON users(client_id);
CREATE INDEX idx_users_risk ON users(risk_level);

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
  external_id VARCHAR(255),
  name VARCHAR(255),
  type VARCHAR(50),                         -- 'endpoint', 'server', 'network'
  os VARCHAR(100),
  managed BOOLEAN DEFAULT FALSE,
  health_status VARCHAR(20),                -- 'healthy', 'warning', 'critical'
  last_seen TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_devices_client ON devices(client_id);
CREATE INDEX idx_devices_health ON devices(health_status);

CREATE TABLE agreements (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  mrr DECIMAL(10,2),
  effective_rate DECIMAL(10,2),
  term_months INTEGER,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  category VARCHAR(100),
  priority VARCHAR(20),
  status VARCHAR(50),
  hours_spent DECIMAL(5,2),
  sla_met BOOLEAN,
  reopen_count INTEGER DEFAULT 0,
  csat_score INTEGER,                       -- 1-5 or NULL
  created_date TIMESTAMP,
  closed_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_tickets_client ON tickets(client_id);
CREATE INDEX idx_tickets_created ON tickets(created_date);

CREATE TABLE controls (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  control_type VARCHAR(100),                -- 'immy_baseline', 'm365_secure_score', etc.
  status VARCHAR(20),                       -- 'pass', 'fail', 'unknown'
  evidence JSONB,                           -- Vendor-specific proof
  last_checked TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_controls_client ON controls(client_id);
CREATE INDEX idx_controls_status ON controls(status);

CREATE TABLE risks (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  risk_type VARCHAR(100),                   -- 'identity', 'email', 'endpoint', 'business'
  title VARCHAR(255),
  description TEXT,
  likelihood VARCHAR(20),                   -- 'low', 'medium', 'high'
  impact VARCHAR(20),                       -- 'low', 'medium', 'high'
  status VARCHAR(20),                       -- 'open', 'mitigated', 'accepted'
  detected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_risks_client ON risks(client_id);
CREATE INDEX idx_risks_status ON risks(status);

CREATE TABLE recommendations (
  id SERIAL PRIMARY KEY,
  client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
  title VARCHAR(255),
  description TEXT,
  effort VARCHAR(20),                       -- 'low', 'medium', 'high'
  cost_range VARCHAR(50),                   -- '$1-5K', '$5-10K', etc.
  priority VARCHAR(20),                     -- 'high', 'medium', 'low'
  quarter VARCHAR(10),                      -- 'Q1 2026', 'Q2 2026', etc.
  status VARCHAR(20) DEFAULT 'pending',     -- 'pending', 'approved', 'completed'
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_recommendations_client ON recommendations(client_id);

-- Job queue (pg-boss auto-creates tables, but documenting schema)
-- pg-boss manages: job, archive, version, schedule tables
```

---

## Implementation Steps

1. **Project Setup**
   - Initialize Node.js project (`npm init`)
   - Install dependencies (Express, Knex, PostgreSQL driver, PDFKit, OpenAI, pg-boss)
   - Create `.env.example` with required environment variables
   - Set up ESLint + Prettier

2. **Database Layer**
   - Configure Knex (`knexfile.js`)
   - Write migrations for all 10 entity tables
   - Create model files (query helpers for each table)
   - Seed test database with mock data

3. **Adapter Layer (Critical Path)**
   - Implement `BaseAdapter` abstract class
   - Build ConnectWise adapter (clients, agreements, tickets, devices)
   - Build Immy adapter (devices, controls)
   - Build M365 adapter (users, risks, controls)
   - Write unit tests with mocked API responses

4. **API Routes (Sync)**
   - `POST /sync/connectwise` → calls adapter → persists to DB
   - `POST /sync/immy` → calls adapter → persists to DB
   - `POST /sync/m365` → calls adapter → persists to DB
   - Add API key auth middleware
   - Add request validation (Joi schemas)

5. **Scoring Engine**
   - Implement `calculateStandardsScore()` with weighted components
   - Implement `calculateRiskScore()` with weighted components
   - Implement `calculateExperienceScore()` with weighted components
   - Write unit tests with known input/output pairs
   - Create `GET /clients/:id/scores` endpoint

6. **Narrative Generator**
   - Create OpenAI prompt templates (4 jobs: trends, summary, actions, prep)
   - Implement citation validation (regex check for ticket IDs, device names)
   - Add retry logic for OpenAI API failures
   - Write tests with mocked OpenAI responses

7. **PDF Generator**
   - Scaffold 9-section PDF structure with PDFKit
   - Implement gauge charts for score dashboard
   - Implement tables for risks, lifecycle, roadmap
   - Test with various data volumes (edge case: client with 500 devices)

8. **Job Queue (Async QBR Generation)**
   - Set up pg-boss
   - Create `qbr-generation` job handler (scores → narrative → PDF)
   - Implement `POST /clients/:id/qbr/generate` (publishes job, returns job ID)
   - Implement `GET /clients/:id/qbr/:jobId` (checks job status, returns PDF URL)
   - Add retry logic (3 attempts)

9. **End-to-End Testing**
   - Seed test DB with mock data from all 3 adapters
   - Trigger full QBR generation flow
   - Validate PDF output contains all 9 sections with real data
   - Verify OpenAI citations reference actual ticket IDs

10. **Deployment Prep**
    - Create Dockerfile (multi-stage build)
    - Create `docker-compose.yml` (app + PostgreSQL)
    - Document environment variables in README
    - Add health check endpoint (`GET /health`)

---

## Testing Strategy

### Unit Tests
- **Adapters**: Test normalization logic with mocked vendor API responses
  - Input: `connectwise-response.json` → Output: `Client[]` with correct fields
  - Validate error handling (401, 429, 500 from vendor API)
- **Scoring Engine**: Test formulas with known inputs
  - Example: 80% devices managed, 90% Immy compliance → Standards score = 85
  - Test edge cases: zero devices, missing data
- **Narrative Generator**: Test prompt construction and citation extraction
  - Mock OpenAI response → validate citations match provided ticket IDs
  - Test hallucination detection (claim without evidence → error)

### Integration Tests
- **API Endpoints**: Test routes with test database
  - `POST /sync/connectwise` → verify DB tables populated
  - `GET /clients/:id/scores` → verify scores calculated from DB data
  - `POST /clients/:id/qbr/generate` → verify job created in queue
- **Database**: Test migrations run cleanly (up/down)
- **Job Queue**: Test pg-boss job processing with mocked QBR generation

### End-to-End Tests
- **Full QBR Flow**:
  1. Seed DB with mock data from `tests/mocks/`
  2. Trigger `POST /clients/1/qbr/generate`
  3. Wait for job completion
  4. Download PDF
  5. Validate PDF contains:
     - All 9 sections
     - Real data (ticket IDs, device names from mocked data)
     - OpenAI narratives with citations
     - Charts render correctly

### Performance Tests (Future)
- Sync 1000 tickets from ConnectWise → measure DB insert time
- Generate QBR for client with 500 devices → measure total time (target: <60s)

---

## Success Criteria

Phase 1 is **DONE** when:

1. ✅ **Adapter Pattern Proven**
   - All 3 adapters sync mock data → normalized DB tables populated
   - Adding a 4th adapter requires zero changes to engine/qbr modules

2. ✅ **Scores Calculate Correctly**
   - Standards, Risk, Experience scores return 0-100 values
   - Breakdown explains weighted components with evidence
   - Edge case: insufficient data → returns error, not invalid score

3. ✅ **OpenAI Generates Trustworthy Narratives**
   - Every recommendation cites evidence (ticket IDs, device names)
   - Hallucination validation catches claims without evidence
   - Narratives are plain English suitable for non-technical executives

4. ✅ **PDF Contains All 9 Sections with Real Data**
   - Executive Summary (narratives)
   - Score Dashboard (3 gauges with movement explanation)
   - Top 5 Risks (table with business impact)
   - Top 5 Wins (list)
   - Service Experience Story (ticket trends)
   - Security Posture Story (identity/email/endpoint)
   - Lifecycle Forecast (aging devices + budget)
   - Roadmap (Now/Next/Later)
   - Outcome Plan (actions with owners/dates)

5. ✅ **End-to-End Test Passes**
   - Mock data → sync → score → QBR PDF generation succeeds
   - PDF visually reviewed for correctness
   - No errors in logs

6. ✅ **Documentation Complete**
   - README explains setup, API usage, environment variables
   - Architecture decision log documented
   - Code comments explain scoring formulas and weights

---

## Acceptance Criteria (Gherkin)

### Feature: ConnectWise Adapter Sync

Syncs clients, agreements, tickets, and devices from ConnectWise Manage and normalizes them into the database.

**Background:**
```gherkin
Given the database is empty
And I have valid ConnectWise Manage credentials in environment variables
And ConnectWise Manage contains:
  | Entity      | Count |
  | Clients     | 5     |
  | Agreements  | 8     |
  | Tickets     | 150   |
  | Devices     | 47    |
```

**Scenario: Successfully sync all ConnectWise data**
```gherkin
When I POST to "/sync/connectwise" with valid credentials
Then the response status should be 200
And the response body should contain:
  """
  {
    "synced_at": "<timestamp>",
    "record_counts": {
      "clients": 5,
      "agreements": 8,
      "tickets": 150,
      "devices": 47
    }
  }
  """
And the "clients" table should contain 5 records
And the "agreements" table should contain 8 records
And the "tickets" table should contain 150 records
And the "devices" table should contain 47 records
And each client record should have a valid "external_id" from ConnectWise
And each client record should have "source" = "connectwise"
```

**Scenario: Handle ConnectWise API authentication failure**
```gherkin
Given I have invalid ConnectWise credentials
When I POST to "/sync/connectwise" with invalid credentials
Then the response status should be 401
And the response body should contain:
  """
  {
    "error": "ConnectWise authentication failed",
    "details": "Invalid API credentials"
  }
  """
And no records should be inserted into the database
```

**Scenario: Handle ConnectWise API rate limit**
```gherkin
Given ConnectWise API returns 429 status (rate limit exceeded)
When I POST to "/sync/connectwise"
Then the adapter should retry with exponential backoff
And after 3 retries, the response status should be 429
And the response body should contain:
  """
  {
    "error": "ConnectWise rate limit exceeded",
    "retry_after": 60
  }
  """
```

---

### Feature: Immy.Bot Adapter Sync

Syncs device compliance data from Immy.Bot and normalizes it into devices and controls tables.

**Background:**
```gherkin
Given the database contains 5 clients from ConnectWise sync
And I have valid Immy.Bot credentials
And Immy.Bot contains:
  | Entity          | Count |
  | Computers       | 47    |
  | Baselines       | 3     |
  | Drift Reports   | 12    |
```

**Scenario: Successfully sync Immy.Bot compliance data**
```gherkin
When I POST to "/sync/immy" with valid credentials
Then the response status should be 200
And the "devices" table should be updated with 47 records (upsert by external_id)
And the "controls" table should contain 12 records with control_type = "immy_baseline"
And each control record should have:
  | Field         | Value                      |
  | status        | "pass", "fail", or "unknown" |
  | evidence      | Valid JSON object          |
  | last_checked  | Timestamp within last 24h  |
```

**Scenario: Immy.Bot device maps to existing ConnectWise device**
```gherkin
Given a ConnectWise device exists with external_id = "CW-DEVICE-123"
And an Immy.Bot computer has the same serial number mapping to "CW-DEVICE-123"
When I POST to "/sync/immy"
Then the device record should be updated (not duplicated)
And the device should have data from both ConnectWise and Immy.Bot sources
And the "managed" field should be set to true
```

---

### Feature: Microsoft 365 Adapter Sync

Syncs users, security controls, and risks from Microsoft Graph API.

**Background:**
```gherkin
Given the database contains 5 clients
And I have valid Microsoft 365 credentials (tenant ID, client ID, client secret)
And Microsoft Graph API contains:
  | Entity               | Count |
  | Entra ID Users       | 73    |
  | Secure Score Controls| 28    |
  | Defender Alerts      | 5     |
```

**Scenario: Successfully sync Microsoft 365 data**
```gherkin
When I POST to "/sync/m365" with valid credentials
Then the response status should be 200
And the "users" table should contain 73 records
And the "controls" table should contain 28 records with control_type = "m365_secure_score"
And the "risks" table should contain 5 records with risk_type = "endpoint"
And each user record should have:
  | Field        | Constraint                     |
  | email        | Valid email format             |
  | upn          | Matches Microsoft UPN format   |
  | mfa_enabled  | Boolean (true/false)           |
  | risk_level   | "none", "low", "medium", or "high" |
```

**Scenario: Microsoft Graph API permission error**
```gherkin
Given the Microsoft 365 credentials lack required Graph API scopes
When I POST to "/sync/m365"
Then the response status should be 403
And the response body should contain:
  """
  {
    "error": "Microsoft Graph permission denied",
    "required_scopes": ["User.Read.All", "SecurityEvents.Read.All", "SecurityActions.Read.All"]
  }
  """
```

---

### Feature: Calculate Standards Compliance Score

Calculates a 0-100 score based on device coverage, Immy compliance, patch status, EDR health, and M365 Secure Score.

**Background:**
```gherkin
Given client ID 1 has the following data:
  | Metric                  | Value |
  | Total devices           | 50    |
  | Managed devices         | 45    |
  | Devices passing Immy    | 40    |
  | Devices patched (30d)   | 42    |
  | Devices with EDR        | 48    |
  | M365 Secure Score       | 72%   |
```

**Scenario: Calculate Standards score with all data present**
```gherkin
When I GET "/clients/1/scores"
Then the response status should be 200
And the response body should contain a "standards" object with:
  | Field | Value Range |
  | score | 80-85       |
And the "standards.breakdown" should include:
  | Component         | Weight | Score Range |
  | device_coverage   | 20%    | 90-100      |
  | immy_compliance   | 30%    | 80-90       |
  | patch_compliance  | 20%    | 84-90       |
  | edr_health        | 15%    | 96-100      |
  | m365_secure_score | 15%    | 72-72       |
And each breakdown component should have an "evidence" object with source data
```

**Scenario: Insufficient data for Standards score**
```gherkin
Given client ID 2 has zero devices in the database
When I GET "/clients/2/scores"
Then the response status should be 200
And the "standards" object should have:
  """
  {
    "score": null,
    "error": "Insufficient data: no devices found",
    "breakdown": {}
  }
  """
```

---

### Feature: Calculate Risk Score

Calculates a 0-100 score (inverse: higher = more risk) based on identity, email, endpoint, and business risks.

**Background:**
```gherkin
Given client ID 1 has the following data:
  | Metric                     | Value |
  | Total users                | 50    |
  | Users with MFA enabled     | 45    |
  | Users with high risk level | 2     |
  | Defender email alerts      | 3     |
  | Devices missing EDR        | 2     |
  | Open critical risks        | 1     |
```

**Scenario: Calculate Risk score with good security posture**
```gherkin
When I GET "/clients/1/scores"
Then the response status should be 200
And the "risk" object should have a score between 10-20 (low risk)
And the "risk.breakdown" should include:
  | Component           | Weight | Risk Level |
  | identity_risk       | 30%    | Low        |
  | email_risk          | 25%    | Low        |
  | endpoint_risk       | 25%    | Low        |
  | business_modifier   | 20%    | Medium     |
And the "risk.breakdown.identity_risk.evidence" should cite:
  - "45/50 users (90%) have MFA enabled"
  - "2 users flagged as high risk by Entra ID"
```

**Scenario: Calculate Risk score with poor MFA coverage**
```gherkin
Given client ID 3 has:
  | Metric                 | Value |
  | Total users            | 100   |
  | Users with MFA enabled | 30    |
When I GET "/clients/3/scores"
Then the "risk.breakdown.identity_risk" should have a score >= 50 (high risk)
And the evidence should cite "30/100 users (30%) have MFA enabled"
```

---

### Feature: Calculate Experience Score

Calculates a 0-100 score based on ticket volume, repeat issues, SLA performance, reopen rate, and after-hours incidents.

**Background:**
```gherkin
Given client ID 1 has the following ticket data for Q4 2025:
  | Metric                     | Value |
  | Total tickets              | 120   |
  | Total users                | 50    |
  | Tickets meeting SLA        | 108   |
  | Tickets reopened           | 5     |
  | Repeat issues (same cat.)  | 8     |
  | After-hours tickets        | 12    |
And client ID 1 had 150 tickets in Q3 2025
```

**Scenario: Calculate Experience score with improving trend**
```gherkin
When I GET "/clients/1/scores"
Then the response status should be 200
And the "experience" object should have a score between 75-85
And the "experience.breakdown.tickets_per_user_trend" should cite:
  - "Q3 2025: 3.0 tickets/user"
  - "Q4 2025: 2.4 tickets/user"
  - "Improvement: -20%"
And the "experience.breakdown.sla_performance" should have a score >= 85
And the evidence should cite "108/120 tickets (90%) met SLA"
```

**Scenario: High reopen rate lowers Experience score**
```gherkin
Given client ID 2 has 40 tickets with 15 reopens (37.5% reopen rate)
When I GET "/clients/2/scores"
Then the "experience.breakdown.reopen_rate" should have a score <= 30
And the evidence should cite "15/40 tickets (37.5%) were reopened"
```

---

### Feature: Generate QBR Narrative with OpenAI

Uses OpenAI GPT-4 to generate executive summary, trends, recommendations, and discussion points with mandatory citations.

**Background:**
```gherkin
Given client ID 1 has scores:
  | Score      | Value |
  | Standards  | 83    |
  | Risk       | 15    |
  | Experience | 78    |
And the database contains:
  - 120 tickets for Q4 2025
  - 3 open risks with risk_type = "identity"
  - 5 devices flagged for lifecycle replacement
```

**Scenario: Generate narrative with valid citations**
```gherkin
When I POST to "/clients/1/qbr/generate"
Then a job should be created in the queue
And when the job completes, the narrative should include:
  - "executive_summary" (3 paragraphs, plain English, business outcomes)
  - "trends" (quarter-over-quarter analysis)
  - "recommendations" (array of 3-7 items)
  - "discussion_points" (array of 3-5 topics)
And every recommendation should have an "evidence" array with at least 1 citation
And citations should match one of these formats:
  - "[Ticket #12345]"
  - "[Device: WS-ACCT-01]"
  - "[Policy: MFA Enforcement]"
  - "[Risk: Unpatched Exchange Server]"
And no recommendation should contain invented data (e.g., ticket IDs not in database)
```

**Scenario: Detect hallucination in OpenAI output**
```gherkin
Given the OpenAI response contains a recommendation:
  """
  {
    "title": "Replace aging firewall",
    "description": "Device FW-MAIN-99 is end-of-life",
    "evidence": ["[Device: FW-MAIN-99]"]
  }
  """
But the database does not contain a device with name "FW-MAIN-99"
When the narrative validation runs
Then the validation should fail with error:
  """
  Hallucination detected: Device "FW-MAIN-99" cited in evidence but not found in database
  """
And the job status should be "failed"
And a human review flag should be set
```

**Scenario: OpenAI API timeout**
```gherkin
Given the OpenAI API takes longer than 60 seconds to respond
When the narrative generation job runs
Then the job should retry up to 3 times with exponential backoff
And if all retries fail, the job status should be "failed"
And the error message should be "OpenAI API timeout after 3 retries"
```

---

### Feature: Generate QBR PDF

Produces a 9-section PDF with scores, narratives, risks, wins, lifecycle forecast, and roadmap.

**Background:**
```gherkin
Given client ID 1 has:
  - Scores: Standards 83, Risk 15, Experience 78
  - Narrative generated by OpenAI (all sections present)
  - 5 open risks in database
  - 8 recommendations for next quarter
  - 12 devices flagged for lifecycle replacement
```

**Scenario: Generate complete QBR PDF**
```gherkin
When the QBR generation job for client ID 1 completes
Then a PDF file should be created
And the PDF should contain exactly 9 sections in this order:
  1. Executive Summary
  2. Score Dashboard (3 gauge charts)
  3. Top 5 Risks
  4. Top 5 Wins
  5. Service Experience Story
  6. Security Posture Story
  7. Lifecycle Forecast
  8. Roadmap (Now/Next/Later)
  9. Outcome Plan
And the "Score Dashboard" section should display:
  - Standards score: 83 (with visual gauge)
  - Risk score: 15 (with visual gauge)
  - Experience score: 78 (with visual gauge)
  - Movement explanation (e.g., "Standards +5 vs. Q3")
And the "Top 5 Risks" section should display a table with columns:
  - Risk Title
  - Business Impact
  - Status
  - Mitigation Action
And the table should contain exactly 5 rows (top risks by likelihood × impact)
And the "Lifecycle Forecast" section should display:
  - Table of devices aged 4+ years
  - 12-month refresh budget estimate
  - 24-month refresh budget estimate
  - 36-month refresh budget estimate
```

**Scenario: PDF renders correctly with large dataset**
```gherkin
Given client ID 2 has 500 devices and 1000 tickets
When the QBR PDF is generated
Then the PDF should be created without errors
And the file size should be less than 10 MB
And all sections should render completely (no truncation)
```

**Scenario: Missing data in PDF**
```gherkin
Given client ID 3 has no recommendations in the database
When the QBR PDF is generated
Then the "Roadmap" section should display:
  """
  No recommendations available for this quarter.
  """
And the PDF should still contain all 9 sections
```

---

### Feature: Async QBR Generation with Job Queue

QBR generation is asynchronous using pg-boss. Client receives a job ID and can poll for status.

**Background:**
```gherkin
Given client ID 1 exists with all required data
And the pg-boss worker is running
```

**Scenario: Submit QBR generation job**
```gherkin
When I POST to "/clients/1/qbr/generate"
Then the response status should be 202 (Accepted)
And the response body should contain:
  """
  {
    "job_id": "<uuid>",
    "status": "queued",
    "message": "QBR generation started. Poll /clients/1/qbr/<job_id> for status."
  }
  """
```

**Scenario: Poll job status (in progress)**
```gherkin
Given a QBR generation job exists with ID "abc-123"
And the job status is "active"
When I GET "/clients/1/qbr/abc-123"
Then the response status should be 200
And the response body should contain:
  """
  {
    "job_id": "abc-123",
    "status": "active",
    "progress": "Generating narrative (step 2/4)"
  }
  """
```

**Scenario: Poll job status (completed)**
```gherkin
Given a QBR generation job exists with ID "abc-123"
And the job status is "completed"
And the PDF file is stored at "/outputs/qbr-client-1-abc-123.pdf"
When I GET "/clients/1/qbr/abc-123"
Then the response status should be 200
And the response body should contain:
  """
  {
    "job_id": "abc-123",
    "status": "completed",
    "pdf_url": "/outputs/qbr-client-1-abc-123.pdf",
    "completed_at": "<timestamp>"
  }
  """
```

**Scenario: Job fails and retries**
```gherkin
Given the OpenAI API is temporarily down
When a QBR generation job is processed
Then the job should fail with status "retry"
And the job should be retried after 30 seconds (exponential backoff)
And after 3 failed attempts, the job status should be "failed"
And the error message should be logged
```

---

### Feature: Client Segmentation for QBR Cadence

Clients are segmented (A/B/C/D) to determine QBR frequency. Segment affects cadence, not content.

**Background:**
```gherkin
Given the database contains clients with segments:
  | Client ID | Segment | Last QBR Date |
  | 1         | A       | 2025-10-01    |
  | 2         | B       | 2025-10-01    |
  | 3         | C       | 2025-07-01    |
  | 4         | D       | 2024-10-01    |
And today is 2026-01-15
```

**Scenario: Segment A/B clients are due for quarterly QBR**
```gherkin
When I GET "/clients/due-for-qbr"
Then the response should include clients 1 and 2
And the response should explain:
  - Client 1 (Segment A): Last QBR 2025-10-01, due quarterly, next due 2026-01-01
  - Client 2 (Segment B): Last QBR 2025-10-01, due quarterly, next due 2026-01-01
```

**Scenario: Segment C clients are due for semiannual QBR**
```gherkin
When I GET "/clients/due-for-qbr"
Then the response should include client 3
And the response should explain:
  - Client 3 (Segment C): Last QBR 2025-07-01, due semiannually, next due 2026-01-01
```

**Scenario: Segment D clients are due for annual QBR**
```gherkin
When I GET "/clients/due-for-qbr"
Then the response should include client 4
And the response should explain:
  - Client 4 (Segment D): Last QBR 2024-10-01, due annually, next due 2025-10-01 (overdue)
```

**Scenario: All segments receive same QBR quality**
```gherkin
Given I generate QBRs for client 1 (Segment A) and client 4 (Segment D)
Then both PDFs should contain all 9 sections
And both PDFs should have OpenAI-generated narratives with citations
And both PDFs should have the same level of detail and formatting
```