# Architecture Fix 1

## Test Failures Summary

**Root Issue:** No tests were written during the Build phase.

The test runner reports:
```
No tests found, exiting with code 1
Pattern: **/tests/**/*.test.js - 0 matches
```

While the Builder created:
- All source code files (adapters, engines, routes, models, middleware, QBR generation)
- Test infrastructure (jest.config.js, tests/setup.js)
- Mock data files (tests/mocks/*.json)
- Test directory structure

**The Builder did NOT create:**
- Any actual test files (*.test.js or *.spec.js)
- Unit tests for adapters, scoring engines, or QBR generation
- Integration tests for API endpoints
- End-to-end tests for the full QBR flow

## Root Cause Analysis

**Why did this happen?**

The architecture document specified comprehensive testing requirements in the "Testing Strategy" section and detailed behavioral contracts in "Acceptance Criteria (Gherkin)" — but the Builder interpreted its role as implementing the **application code only**, not the **test code**.

This is a phase coordination issue:
1. The architecture assumed tests would be written by Builder
2. The Builder focused on production code, leaving test implementation incomplete
3. The Test phase expected to **run** existing tests, not **write** them

**What assumption was wrong?**

The architecture spec's "Implementation Steps" section listed:
- "Write unit tests with mocked API responses" (Step 3, Adapter Layer)
- "Write unit tests with known input/output pairs" (Step 5, Scoring Engine)
- "Write tests with mocked OpenAI responses" (Step 6, Narrative Generator)

But the Builder **did not execute these test-writing steps** — it created only the production code and test scaffolding.

## Required Changes

The Builder must create comprehensive test files covering all critical paths defined in the Gherkin acceptance criteria. Below are the specific test files that must be created, with clear guidance on what each should validate.

---

### File: tests/unit/adapters/connectwise-adapter.test.js
**Problem:** Missing unit tests for ConnectWise adapter normalization logic
**Fix:** Builder should create a test file that:

1. **Tests successful data normalization:**
   - Imports `tests/mocks/connectwise-response.json`
   - Mocks `axios` to return the mock response
   - Calls `ConnectWiseAdapter.sync()`
   - Validates returned normalized data structure matches schema:
     ```javascript
     expect(result.clients).toHaveLength(5);
     expect(result.clients[0]).toHaveProperty('external_id');
     expect(result.clients[0]).toHaveProperty('source', 'connectwise');
     expect(result.clients[0]).toHaveProperty('name');
     expect(result.agreements).toHaveLength(8);
     expect(result.tickets).toHaveLength(150);
     expect(result.devices).toHaveLength(47);
     ```

2. **Tests authentication failure (Gherkin: "Handle ConnectWise API authentication failure"):**
   - Mocks `axios` to throw 401 error
   - Expects adapter to throw `AdapterError` with message containing "authentication failed"
   - Validates no database writes occurred (via mock/spy)

3. **Tests rate limit handling (Gherkin: "Handle ConnectWise API rate limit"):**
   - Mocks `axios` to return 429 status
   - Expects adapter to retry with exponential backoff (validate retry count = 3)
   - After 3 retries, expects `AdapterError` with "rate limit exceeded"

4. **Tests malformed API response:**
   - Mocks `axios` to return response missing required fields
   - Expects adapter to throw validation error (not crash with undefined)

---

### File: tests/unit/adapters/immy-adapter.test.js
**Problem:** Missing unit tests for Immy.Bot adapter
**Fix:** Builder should create a test file that:

1. **Tests device compliance normalization (Gherkin: "Successfully sync Immy.Bot compliance data"):**
   - Imports `tests/mocks/immy-response.json`
   - Mocks Immy API calls
   - Validates 47 devices returned with `managed: true`
   - Validates 12 controls with `control_type: "immy_baseline"`
   - Validates each control has `status` in `["pass", "fail", "unknown"]`
   - Validates each control has `evidence` as valid JSON object
   - Validates `last_checked` timestamp is present

2. **Tests device mapping to existing ConnectWise devices (Gherkin: "Immy.Bot device maps to existing ConnectWise device"):**
   - **Note:** This test may require database integration (see integration tests section)
   - Unit test should validate that adapter's normalization logic **includes** the external_id mapping field

---

### File: tests/unit/adapters/m365-adapter.test.js
**Problem:** Missing unit tests for Microsoft 365 adapter
**Fix:** Builder should create a test file that:

1. **Tests user/control/risk normalization (Gherkin: "Successfully sync Microsoft 365 data"):**
   - Imports `tests/mocks/m365-response.json`
   - Mocks Microsoft Graph API client
   - Validates 73 users returned
   - Validates each user has:
     - `email` in valid email format
     - `upn` matching Microsoft UPN format
     - `mfa_enabled` as boolean
     - `risk_level` in `["none", "low", "medium", "high"]`
   - Validates 28 controls with `control_type: "m365_secure_score"`
   - Validates 5 risks with `risk_type: "endpoint"`

2. **Tests permission error (Gherkin: "Microsoft Graph API permission error"):**
   - Mocks Graph API to throw 403 Forbidden
   - Expects `AdapterError` with message containing "permission denied"
   - Error should include `required_scopes` array

---

### File: tests/unit/engine/standards-score.test.js
**Problem:** Missing unit tests for Standards Compliance scoring
**Fix:** Builder should create a test file that:

1. **Tests score calculation with full data (Gherkin: "Calculate Standards score with all data present"):**
   - **Setup:** Create test database client with known metrics:
     ```javascript
     {
       total_devices: 50,
       managed_devices: 45,      // 90% coverage
       immy_passing: 40,         // 80% compliance
       patched_30d: 42,          // 84% patched
       edr_installed: 48,        // 96% EDR
       m365_secure_score: 72     // 72%
     }
     ```
   - Mocks database queries to return this data
   - Calls `calculateStandardsScore(clientId)`
   - Validates:
     ```javascript
     expect(result.score).toBeGreaterThanOrEqual(80);
     expect(result.score).toBeLessThanOrEqual(85);
     expect(result.breakdown.device_coverage.score).toBeGreaterThanOrEqual(90);
     expect(result.breakdown.immy_compliance.weight).toBe(0.30);
     expect(result.breakdown.edr_health.evidence).toHaveProperty('devices_with_edr');
     ```

2. **Tests insufficient data handling (Gherkin: "Insufficient data for Standards score"):**
   - Mocks database to return zero devices
   - Calls `calculateStandardsScore(clientId)`
   - Validates:
     ```javascript
     expect(result.score).toBeNull();
     expect(result.error).toContain("Insufficient data");
     expect(result.breakdown).toEqual({});
     ```

3. **Tests weighted formula accuracy:**
   - Create scenarios with known inputs and calculate expected weighted average
   - Validate `result.score` matches expected value within ±1 point tolerance

---

### File: tests/unit/engine/risk-score.test.js
**Problem:** Missing unit tests for Risk scoring
**Fix:** Builder should create a test file that:

1. **Tests low-risk scenario (Gherkin: "Calculate Risk score with good security posture"):**
   - Mock data: 90% MFA coverage, 2 high-risk users, 3 email alerts, 2 missing EDR
   - Validate `result.score` between 10-20 (low risk)
   - Validate breakdown components cite evidence correctly
   - Validate `identity_risk.evidence` contains "45/50 users (90%) have MFA enabled"

2. **Tests high-risk scenario (Gherkin: "Calculate Risk score with poor MFA coverage"):**
   - Mock data: 30% MFA coverage (30/100 users)
   - Validate `result.breakdown.identity_risk.score >= 50` (high risk)
   - Validate evidence cites "30/100 users (30%) have MFA enabled"

---

### File: tests/unit/engine/experience-score.test.js
**Problem:** Missing unit tests for Experience scoring
**Fix:** Builder should create a test file that:

1. **Tests improving trend scenario (Gherkin: "Calculate Experience score with improving trend"):**
   - Mock Q3 2025 tickets: 150 tickets, 50 users (3.0 tickets/user)
   - Mock Q4 2025 tickets: 120 tickets, 50 users (2.4 tickets/user), 108 met SLA, 5 reopened
   - Validate `result.score` between 75-85
   - Validate `tickets_per_user_trend` evidence cites improvement: "-20%"
   - Validate `sla_performance.score >= 85`

2. **Tests high reopen rate (Gherkin: "High reopen rate lowers Experience score"):**
   - Mock data: 40 tickets, 15 reopened (37.5% reopen rate)
   - Validate `result.breakdown.reopen_rate.score <= 30`
   - Validate evidence cites "15/40 tickets (37.5%) were reopened"

---

### File: tests/unit/qbr/narrative-generator.test.js
**Problem:** Missing unit tests for OpenAI narrative generation
**Fix:** Builder should create a test file that:

1. **Tests citation validation (Gherkin: "Generate narrative with valid citations"):**
   - Mock OpenAI API to return narrative with proper citations like "[Ticket #12345]", "[Device: WS-ACCT-01]"
   - Mock database to contain those exact ticket IDs and device names
   - Call `generateNarrative()`
   - Validate:
     - Narrative contains `executive_summary`, `trends`, `recommendations`, `discussion_points`
     - Every recommendation has `evidence` array with at least 1 citation
     - Citation format matches regex: `/\[(Ticket #\d+|Device: [\w-]+|Policy: .+|Risk: .+)\]/`

2. **Tests hallucination detection (Gherkin: "Detect hallucination in OpenAI output"):**
   - Mock OpenAI to return recommendation citing "[Device: FW-MAIN-99]"
   - Mock database to **NOT** contain device "FW-MAIN-99"
   - Call `generateNarrative()`
   - Expect validation to throw error: "Hallucination detected: Device \"FW-MAIN-99\" cited in evidence but not found in database"

3. **Tests OpenAI API timeout (Gherkin: "OpenAI API timeout"):**
   - Mock OpenAI API to delay response beyond 60 seconds
   - Validate retry logic (3 attempts with exponential backoff)
   - After 3 failures, expect error: "OpenAI API timeout after 3 retries"

---

### File: tests/integration/api/sync.test.js
**Problem:** Missing integration tests for sync endpoints
**Fix:** Builder should create a test file that:

1. **Setup:** Use test database (separate from production)
   - Before all tests: run migrations on test DB
   - Before each test: truncate tables
   - After all tests: close DB connection

2. **Tests POST /sync/connectwise (Gherkin: "Successfully sync all ConnectWise data"):**
   - Mock axios to return `tests/mocks/connectwise-response.json`
   - POST to `/sync/connectwise` with valid credentials
   - Validate response:
     ```javascript
     expect(response.status).toBe(200);
     expect(response.body.record_counts.clients).toBe(5);
     expect(response.body.record_counts.agreements).toBe(8);
     expect(response.body.record_counts.tickets).toBe(150);
     expect(response.body.record_counts.devices).toBe(47);
     ```
   - Query database directly to validate records were inserted:
     ```javascript
     const clients = await db('clients').where('source', 'connectwise');
     expect(clients).toHaveLength(5);
     expect(clients[0]).toHaveProperty('external_id');
     ```

3. **Tests POST /sync/connectwise with auth failure:**
   - Mock axios to throw 401
   - POST to `/sync/connectwise` with invalid credentials
   - Validate response:
     ```javascript
     expect(response.status).toBe(401);
     expect(response.body.error).toContain("authentication failed");
     ```
   - Validate no records inserted in database

---

### File: tests/integration/api/clients.test.js
**Problem:** Missing integration tests for client scores endpoint
**Fix:** Builder should create a test file that:

1. **Setup:** Seed test database with known client data (use fixtures or factory)

2. **Tests GET /clients/:id/scores:**
   - Seed client with known metrics (matching Standards score test data)
   - GET `/clients/1/scores`
   - Validate response:
     ```javascript
     expect(response.status).toBe(200);
     expect(response.body.standards).toHaveProperty('score');
     expect(response.body.standards.breakdown).toHaveProperty('device_coverage');
     expect(response.body.risk).toHaveProperty('score');
     expect(response.body.experience).toHaveProperty('score');
     ```

---

### File: tests/integration/api/qbr.test.js
**Problem:** Missing integration tests for QBR generation endpoints
**Fix:** Builder should create a test file that:

1. **Tests POST /clients/:id/qbr/generate (Gherkin: "Submit QBR generation job"):**
   - Seed client with complete data
   - POST to `/clients/1/qbr/generate`
   - Validate response:
     ```javascript
     expect(response.status).toBe(202);
     expect(response.body).toHaveProperty('job_id');
     expect(response.body.status).toBe('queued');
     expect(response.body.message).toContain('Poll /clients/1/qbr/');
     ```

2. **Tests GET /clients/:id/qbr/:jobId - in progress (Gherkin: "Poll job status (in progress)"):**
   - Create job with status "active"
   - GET `/clients/1/qbr/abc-123`
   - Validate response shows `status: "active"` and `progress` message

3. **Tests GET /clients/:id/qbr/:jobId - completed (Gherkin: "Poll job status (completed)"):**
   - Create completed job with PDF file path
   - GET `/clients/1/qbr/abc-123`
   - Validate response:
     ```javascript
     expect(response.status).toBe(200);
     expect(response.body.status).toBe('completed');
     expect(response.body.pdf_url).toBeTruthy();
     expect(response.body.completed_at).toBeTruthy();
     ```

---

### File: tests/e2e/qbr-generation.test.js
**Problem:** Missing end-to-end test for full QBR flow
**Fix:** Builder should create a test file that:

1. **Tests full QBR generation flow (Gherkin: "Generate complete QBR PDF"):**
   - **Setup:**
     - Seed database with complete client data (scores, risks, recommendations, devices)
     - Mock OpenAI API to return narrative with valid citations
     - Mock pg-boss worker (or run actual worker in test mode)

   - **Execute:**
     - Trigger QBR generation job
     - Wait for job completion (poll status or use callback)
     - Retrieve PDF file

   - **Validate:**
     - PDF file exists and size > 0
     - PDF contains all 9 sections (parse PDF content or check for section headers)
     - Validate section content:
       ```javascript
       expect(pdfText).toContain('Executive Summary');
       expect(pdfText).toContain('Score Dashboard');
       expect(pdfText).toContain('Standards: 83'); // Expected score
       expect(pdfText).toContain('Top 5 Risks');
       expect(pdfText).toContain('Lifecycle Forecast');
       ```

   - **Validate data accuracy:**
     - Extract risk count from PDF, expect 5 risks
     - Validate at least one citation appears in narrative section

2. **Tests PDF generation with large dataset (Gherkin: "PDF renders correctly with large dataset"):**
   - Seed client with 500 devices, 1000 tickets
   - Generate PDF
   - Validate:
     - PDF file size < 10 MB
     - All sections render completely (no truncation)
     - No errors in logs

---

## Verification

After Builder implements these test files, the Test phase should:

1. **Run unit tests:**
   ```bash
   npm test -- tests/unit/
   ```
   - All adapter normalization tests pass
   - All scoring engine tests pass with correct weighted formulas
   - Narrative generator citation validation works

2. **Run integration tests:**
   ```bash
   npm test -- tests/integration/
   ```
   - API endpoints return correct status codes
   - Database records persist correctly after sync
   - Job queue creates jobs and tracks status

3. **Run E2E tests:**
   ```bash
   npm test -- tests/e2e/
   ```
   - Full QBR flow completes without errors
   - PDF contains all 9 sections with real data
   - Citations in narrative match database records

4. **Generate test coverage report:**
   ```bash
   npm test -- --coverage
   ```
   - Target: >80% coverage for adapters, scoring engines, QBR generation
   - Target: >70% coverage overall

5. **Validate against Gherkin scenarios:**
   - Each Gherkin scenario in architecture.md should have a corresponding test
   - Test names should reference Gherkin scenario for traceability

## Acceptance Criteria Updates

**No changes needed.** The Gherkin scenarios in the original architecture.md are correct and comprehensive. The issue is not with the acceptance criteria — it's that the Builder did not implement tests to validate those criteria.

The Builder should treat each Gherkin scenario as a **test specification** and write tests that directly implement those scenarios.

---

## Summary for Builder

**Your task:** Create the test files listed above (11 test files total).

**Critical requirements:**
1. Every test file must use the existing test infrastructure (jest.config.js, tests/setup.js)
2. Use the mock data files already created (tests/mocks/*.json)
3. For database tests, use a separate test database (configure via TEST_DATABASE_URL env var)
4. Mock external APIs (axios, OpenAI, Microsoft Graph) — never call real APIs in tests
5. Each Gherkin scenario should map to at least one test case
6. Test names should clearly describe what they validate (use `describe` and `it` blocks)
7. Use Jest matchers appropriately (`toHaveProperty`, `toContain`, `toBeGreaterThan`, etc.)
8. Include setup/teardown logic (beforeAll, afterAll, beforeEach, afterEach)
9. Tests should be **deterministic** — same input = same output every time
10. Tests should be **isolated** — one test's failure should not cause others to fail

**Expected outcome:** When the Test phase runs `npm test`, all tests pass and validate the Gherkin acceptance criteria from the architecture specification.
