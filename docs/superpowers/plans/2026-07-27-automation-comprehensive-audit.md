# SIKKHA AI CONTENT AUTOMATION — COMPREHENSIVE AUDIT & IMPLEMENTATION ROADMAP

**Audit Date:** 2026-07-27
**Audit Type:** Production-level implementation gap analysis (post-previous audit)
**Method:** Source code verification — every file read, every import traced, every integration verified
**Previous Reports:** AUTOMATION-AUDIT-REPORT.md, IMPLEMENTATION-GAP-AUDIT-ROADMAP.md

---

# 1. CURRENT COMPLETION

## Overall: 55%

| Module | Status | Completion % | Evidence |
|--------|--------|-------------|----------|
| **Prisma Schema (24 models)** | ✅ COMPLETE | 100% | 24 models, 307 fields, 64 indexes, 17 relations, 10 unique constraints |
| **Prisma Migrations** | ✅ COMPLETE | 100% | 5 migrations exist and apply cleanly |
| **Soft Delete Integration** | ✅ COMPLETE | 100% | 12 automation models registered in `soft-delete.ts` |
| **Encryption Service** | ✅ COMPLETE | 100% | AES-256-GCM, SHA-256 key derivation, production guard |
| **Retry Strategy** | ✅ COMPLETE | 100% | `withRetry()`, `calculateBackoff()`, `isPrismaRetryable()` |
| **Outbox Writer** | ✅ COMPLETE | 100% | `write()` and `writeMany()` inside transactions |
| **Outbox Processor** | ⚠️ DEAD CODE | 30% | Class exists (231 lines) but **never instantiated** — outbox messages accumulate forever |
| **Inbox Consumer** | ✅ COMPLETE | 100% | Idempotent consumption via composite key, SHA-256 hashing |
| **Dead Letter Service** | ✅ COMPLETE | 100% | Send, retry, fail, list, count operations |
| **Saga Coordinator** | ✅ COMPLETE | 100% | Forward + compensate, transactional variant |
| **Stage Runner** | ✅ COMPLETE | 100% | Timeout, retry, backoff (used by SagaCoordinator only) |
| **Prompt Guard** | ✅ COMPLETE | 100% | 10 categories, 36 regex patterns, 4 heuristics, DoS protection |
| **Prompt Sanitizer** | ✅ COMPLETE | 100% | Zero-width stripping, delimiter wrapping, 50K truncation |
| **Prompt Validator** | ✅ COMPLETE | 100% | Safety, hallucination (5 patterns), structure, quality checks |
| **SSRF Firewall** | ✅ COMPLETE | 100% | 3 active layers + redirect check, IPv4 (12 ranges), IPv6 (7 ranges), DNS resolution |
| **SSRF Client** | ✅ COMPLETE | 100% | Manual redirect following, 10MB size limiting, timeout |
| **Content Validator** | ✅ COMPLETE | 100% | Magic bytes (8 signatures), polyglot, binary detection |
| **AI Provider Manager** | ⚠️ PARTIAL | 75% | Multi-provider, fallback, health tracking — **rate limiting is passthrough** |
| **OpenAI Provider** | ✅ COMPLETE | 100% | AES-256-GCM key decryption, JSON mode, env fallback |
| **Gemini Provider** | ✅ COMPLETE | 100% | API key in query param, JSON response |
| **Anthropic Provider** | ✅ COMPLETE | 100% | Anthropic-specific headers |
| **Prompt Template Engine** | ✅ COMPLETE | 100% | DB templates, versioning, interpolation, 8 defaults |
| **Metadata Consolidator** | ⚠️ PARTIAL | 70% | Single-call generation, caching — **costUsd hardcoded to $0** |
| **AI Response Cache** | ✅ COMPLETE | 100% | SHA-256 keys, TTL, cleanup |
| **AI Request Logger** | ✅ COMPLETE | 100% | DB-backed, cost aggregation (but costs always 0) |
| **Content Generator** | ✅ COMPLETE | 100% | Wraps provider for content rewriting |
| **Pipeline Engine** | ✅ COMPLETE | 100% | Sequential execution, retry, timeout, compensation |
| **Pipeline Context** | ✅ COMPLETE | 100% | Variable management, stage state, persistence |
| **Pipeline Events** | ✅ COMPLETE | 100% | 18 event types, DB + outbox emission |
| **Stage Executors (5)** | ⚠️ PARTIAL | 80% | IMPORT, AI_REWRITE, AI_METADATA, REVIEW work — **PUBLISH creates BlogPost directly, bypassing PublishService** |
| **Stage Compensators (4)** | ✅ COMPLETE | 100% | Compensation for all 4 executable stages |
| **Failure Recovery** | ⚠️ PARTIAL | 70% | Checkpoint, retry, dead letter — **abuses errorMessage field for checkpoint storage** |
| **Compensation Service** | ✅ COMPLETE | 100% | LIFO rollback, per-stage compensation |
| **Publish Service** | ✅ COMPLETE | 100% | Draft creation, slug generation, tag association, versioning |
| **Review Queue** | ✅ COMPLETE | 100% | Create, approve/reject, status transitions |
| **Schedule Service** | ✅ COMPLETE | 100% | Schedule, cancel, execute due |
| **Rollback Service** | ✅ COMPLETE | 100% | Snapshot, rollback, history, diff |
| **Import Worker** | ⚠️ PARTIAL | 85% | SSRF fetch, content validation — **weak 32-bit content hash** |
| **AI Worker** | ✅ COMPLETE | 100% | Rewrite + metadata processing, queue chaining |
| **Publish Worker** | ✅ COMPLETE | 100% | Creates BlogPost via PublishService |
| **Outbox Worker** | ⚠️ PARTIAL | 50% | Processes queue payloads — **but nothing feeds messages into the queue** |
| **Worker Manager** | ⚠️ PARTIAL | 60% | Register, start, stop, health — **never called from application startup** |
| **Queue Service** | ✅ COMPLETE | 100% | DB-backed queue, idempotency, dead letter |
| **Transaction Types** | ⚠️ BROKEN | 20% | `AnyPrismaClient = any` — zero type safety |
| **Audit Actions (20)** | ✅ COMPLETE | 100% | All 20 AUTOMATION_* actions defined |
| **Entity Types (15)** | ✅ COMPLETE | 100% | All 15 AUTOMATION_* entity types defined |
| **Route Store (15 routes)** | ✅ COMPLETE | 100% | All admin-automation routes defined |
| **Admin Sidebar (10 items)** | ✅ COMPLETE | 100% | All navigation items with icons |
| **Admin Layout Lazy Loading** | ✅ COMPLETE | 100% | 15 lazy imports registered |
| **Query Keys** | ✅ COMPLETE | 100% | 17 automation query key factories defined |
| **API: Pipelines (GET/POST)** | ✅ COMPLETE | 100% | With validation, CSRF, audit, pagination |
| **API: Sources (GET/POST)** | ✅ COMPLETE | 100% | With validation, CSRF, audit, pagination |
| **API: Sources [id] (GET/PUT/DELETE)** | ✅ COMPLETE | 100% | Full CRUD with soft delete |
| **API: Providers (GET/POST)** | ✅ COMPLETE | 100% | With validation, CSRF, audit, pagination |
| **API: Providers [id] (GET/PUT/DELETE)** | ✅ COMPLETE | 100% | Full CRUD with soft delete |
| **API: Providers [id]/rotate-key (POST)** | ✅ COMPLETE | 100% | With audit |
| **API: Templates (GET/POST)** | ✅ COMPLETE | 100% | With version creation |
| **API: Templates [id] (GET/PUT/DELETE)** | ✅ COMPLETE | 100% | Full CRUD with version management |
| **API: Pipelines [id] (GET)** | ✅ COMPLETE | 100% | With stages and events |
| **API: Review (GET)** | ✅ COMPLETE | 100% | List with filters |
| **API: Review [id] (POST)** | ✅ COMPLETE | 100% | Approve/reject with audit |
| **API: Publish (POST)** | ✅ COMPLETE | 100% | With audit |
| **API: Publish Schedule (GET/POST)** | ✅ COMPLETE | 100% | Schedule creation |
| **API: Publish Schedule [id] (DELETE)** | ✅ COMPLETE | 100% | Cancel with audit |
| **API: Settings (GET/PUT)** | ✅ COMPLETE | 100% | Upsert with audit |
| **API: Health (GET)** | ✅ COMPLETE | 100% | DB, Redis, queue, providers, storage |
| **API: Versions (GET)** | ✅ COMPLETE | 100% | Version history |
| **API: Versions [id] (POST)** | ✅ COMPLETE | 100% | Rollback execution |
| **--- WORKERS NOT STARTED ---** | ❌ MISSING | 0% | `workerManager.startAll()` never called |
| **--- SCHEDULER NOT RUNNING ---** | ❌ MISSING | 0% | `scheduleService.executeDue()` never called |
| **--- OUTBOX NOT PROCESSED ---** | ❌ MISSING | 0% | `OutboxProcessor.processNextBatch()` never called |
| **--- WORKER REGISTRATIONS ---** | ❌ MISSING | 0% | No `workerManager.register()` calls |
| **--- PIPELINE NOT EXECUTED FROM API ---** | ❌ MISSING | 0% | POST creates record but doesn't call `pipelineEngine.execute()` |
| **Admin UI: All 15 pages** | ❌ STUB | 5% | Every page is a 5-line `<div>` stub |
| **Tests** | ❌ MISSING | 0% | Zero test files in automation module |
| **Notification Integration** | ❌ MISSING | 0% | No notification triggers for automation events |
| **Cost Tracking** | ❌ PLACEHOLDER | 5% | Hardcoded to $0 everywhere |
| **Rate Limiting** | ❌ PLACEHOLDER | 10% | Token bucket exists but `callWithRateLimit` is passthrough |

---

# 2. NEWLY COMPLETED SINCE PREVIOUS AUDIT

| Feature | Status | Evidence |
|---------|--------|----------|
| Sources [id] CRUD | ✅ NEW | `sources/[id]/route.ts` — GET, PUT, DELETE with soft delete, audit, CSRF |
| Templates [id] CRUD | ✅ NEW | `templates/[id]/route.ts` — GET, PUT, DELETE with version management |
| Pipelines [id] GET | ✅ NEW | `pipelines/[id]/route.ts` — single pipeline with stages and events |
| Review [id] POST | ✅ NEW | `review/[id]/route.ts` — approve/reject with status validation |
| Publish Schedule [id] DELETE | ✅ NEW | `publish/schedule/[id]/route.ts` — cancel schedule |
| Versions [id] POST | ✅ NEW | `versions/[id]/route.ts` — rollback execution |
| Query Keys | ✅ NEW | `query-keys.ts` lines 81-97 — 17 automation query key factories |
| Admin Layout Registration | ✅ NEW | `AdminLayout.tsx` lines 158-249 — 15 lazy imports + 10 sidebar items |
| Route Store | ✅ NEW | `router.ts` lines 115-208 — 15 route definitions |

---

# 3. PARTIALLY COMPLETED FEATURES

| Feature | Completion % | What Works | What's Missing |
|---------|-------------|------------|----------------|
| **Outbox Pattern** | 30% | Writer writes messages in transactions | Processor never runs — messages accumulate forever |
| **Worker Lifecycle** | 20% | WorkerManager class exists with register/start/stop | Never registered, never started, no startup module |
| **Pipeline Execution** | 70% | Engine works, stages execute, compensation works | POST doesn't trigger execution, no FULL_AUTOMATION definition |
| **Cost Tracking** | 5% | Schema has costUsd field, logger accepts cost | All hardcoded to $0, no calculation logic |
| **Rate Limiting** | 10% | Token bucket algorithm exists | `callWithRateLimit` is passthrough, never enforces |
| **Content Hashing** | 50% | Hash function exists in import-worker | Uses weak 32-bit djb2, not SHA-256 |
| **Checkpoint Storage** | 60% | Save/load functions exist | Abuses `errorMessage` field, no dedicated field |
| **Publish Stage** | 60% | Creates BlogPost | Bypasses PublishService, missing slug sanitization, tag associations, versioning |
| **Transaction Types** | 20% | Type alias exists | `AnyPrismaClient = any` — zero type safety |
| **Notification** | 0% | Notification service exists in codebase | Zero automation triggers wired |

---

# 4. MISSING FEATURES

## Critical (System Cannot Function)

| # | Feature | Impact | Files Needed |
|---|---------|--------|--------------|
| 1 | **Worker Startup** | System cannot process any jobs | Create `workers/startup.ts`, modify `instrumentation.ts` |
| 2 | **Outbox Processing** | Events accumulate forever, memory leak | Modify `workers/startup.ts` to instantiate and run `OutboxProcessor` |
| 3 | **Scheduler Worker** | Scheduled publishes never execute | Create `workers/scheduler-worker.ts`, register in startup |
| 4 | **Pipeline Execution from API** | Admins can't trigger pipelines | Modify `pipelines/route.ts` POST to call `pipelineEngine.execute()` |
| 5 | **FULL_AUTOMATION Definition** | Can't run end-to-end pipeline | Create `pipeline/definitions.ts` |

## High (Blocks Production Quality)

| # | Feature | Impact | Files Needed |
|---|---------|--------|--------------|
| 6 | **All 15 Admin UI Pages** | Admins can't manage anything | 15 page files + 15 hook files |
| 7 | **Fix AnyPrismaClient** | Type safety compromised | Modify `transaction-types.ts` |
| 8 | **Fix publishStage** | Missing features, bug risk | Modify `stage-executors.ts` to use PublishService |
| 9 | **Fix Content Hash** | False dedup collisions | Modify `import-worker.ts` to use SHA-256 |
| 10 | **Fix Checkpoint Storage** | Data corruption risk | Modify `failure-recovery.ts` to use metadata field |
| 11 | **Cost Tracking** | Budget blind spot | Modify `metadata-consolidator.ts` and `provider-manager.ts` |
| 12 | **Rate Limiting Enforcement** | AI providers may be rate limited | Modify `provider-manager.ts` `callWithRateLimit` |
| 13 | **Notification Integration** | Silent failures | Modify `pipeline-events.ts` to trigger notifications |
| 14 | **Tests (0 files)** | No confidence in any component | Create 20+ test files |

## Medium (Production Polish)

| # | Feature | Impact | Files Needed |
|---|---------|--------|--------------|
| 15 | **Missing CRUD: Rules** | Can't manage automation rules | Create `rules/route.ts`, `rules/[id]/route.ts` |
| 16 | **Missing CRUD: Dead Letter** | Can't retry failed messages | Create `dead-letter/route.ts` |
| 17 | **Pipeline Resume API** | Can't resume failed pipelines | Create `pipelines/[id]/resume/route.ts` |
| 18 | **Queue Stats API** | Can't monitor worker health | Create `queue/route.ts` |
| 19 | **Alerting System** | Failures go unnoticed | Create `monitoring/alert-service.ts` |
| 20 | **Provider Health Background Check** | Providers may silently fail | Create `monitoring/provider-health-monitor.ts` |
| 21 | **Media Asset Upload** | No file upload for media | Integrate with UploadThing |
| 22 | **Analytics Daily Facts** | No trend tracking | Populate `AnalyticsDailyFact` table |

## Low (Nice to Have)

| # | Feature | Impact |
|---|---------|--------|
| 23 | **Content Deduplication API** | Can't manage ContentDuplicate entries |
| 24 | **Social Media Auto-Share** | No auto-sharing to social channels |
| 25 | **Thumbnail Image Generation** | Only generates text prompt, not actual image |
| 26 | **.env.example** | No documentation for required env vars |

---

# 5. BROKEN OR RISKY IMPLEMENTATIONS

## 1. Outbox Messages Accumulate Forever
- **Root Cause:** `OutboxProcessor` class exists but is never instantiated. `PipelineEvents.emit()` writes to OutboxMessage table, but nothing reads from it.
- **Impact:** Unbounded table growth, events never delivered, memory/storage leak.
- **Fix:** Create worker startup that instantiates `OutboxProcessor`, registers handlers, and runs `processNextBatch()` on interval.

## 2. Workers Never Start
- **Root Cause:** `WorkerManager` singleton exists with `register()` and `startAll()` methods, but no code ever calls them. `instrumentation.ts` only seeds super admin.
- **Impact:** Zero background processing. No imports, no AI processing, no publishing, no outbox dispatch.
- **Fix:** Create `workers/startup.ts` and call from `instrumentation.ts`.

## 3. publishStage Bypasses PublishService
- **Root Cause:** `stage-executors.ts:280-340` creates BlogPost directly via `ctx.tx.blogPost.create()` instead of using `PublishService.createDraft()`.
- **Impact:** Missing slug sanitization, HTML sanitization, reading time calculation, tag associations, version snapshots, scheduled publishing.
- **Fix:** Replace direct create with `publishService.createDraft()`.

## 4. Weak Content Hash
- **Root Cause:** `import-worker.ts:130-137` uses 32-bit djb2 variant, only hashes first 1000 chars, outputs ~6-7 chars.
- **Impact:** High collision rate — different content may be falsely identified as duplicates.
- **Fix:** Replace with SHA-256 hash of full content.

## 5. AnyPrismaClient = any
- **Root Cause:** `transaction-types.ts:11` explicitly sets `AnyPrismaClient = any` with eslint-disable comment.
- **Impact:** Zero type safety across all 33 services that use transaction clients.
- **Fix:** Define proper `PrismaTxClient` type using Prisma's transaction return type.

## 6. Checkpoint Abuses errorMessage Field
- **Root Cause:** `failure-recovery.ts:37-43` stores JSON checkpoint data in `PipelineRun.errorMessage` field.
- **Impact:** Real error messages and checkpoints cannot coexist. Loading requires JSON parsing with try/catch.
- **Fix:** Use dedicated `metadata` JSON field for checkpoint storage.

## 7. Cost Tracking Hardcoded to $0
- **Root Cause:** `metadata-consolidator.ts` lines 42, 83, 104, 131 all set `costUsd: 0`.
- **Impact:** Zero visibility into AI spending. Budget blind spot.
- **Fix:** Calculate cost using provider's `costPer1kIn`/`costPer1kOut` × actual token usage.

## 8. Rate Limiting is Passthrough
- **Root Cause:** `provider-manager.ts:165-175` `callWithRateLimit` just calls `provider.generate(request)` without checking token bucket.
- **Impact:** AI providers may rate-limit the system. No protection against burst traffic.
- **Fix:** Check token bucket before calling provider, wait/refill if empty.

## 9. No Worker Graceful Shutdown
- **Root Cause:** `process-handlers.node.ts` only handles uncaughtException/unhandledRejection. No `workerManager.stopAll()` on SIGTERM/SIGINT.
- **Impact:** Workers may be mid-transaction when process exits, causing data corruption.
- **Fix:** Add SIGTERM/SIGINT handlers that call `workerManager.stopAll()`.

## 10. No .env.example
- **Root Cause:** No `.env.example` file exists. `.env` has only 9 vars, none for automation.
- **Impact:** Developers don't know what env vars are needed for AI providers, workers, etc.
- **Fix:** Create `.env.example` with all required automation vars.

---

# 6. MISSING TESTS

| Test File | Priority | What It Tests |
|-----------|----------|---------------|
| `prompt-guard.test.ts` | P1 | All 10 injection categories with known attack strings |
| `ssrf-firewall.test.ts` | P1 | Protocol, hostname, DNS, IP blocking, redirect |
| `ssrf-client.test.ts` | P1 | Redirect following, size limiting |
| `prompt-sanitizer.test.ts` | P1 | Zero-width char removal, delimiter wrapping |
| `content-validator.test.ts` | P1 | Magic bytes, polyglot detection |
| `encryption-service.test.ts` | P1 | Encrypt/decrypt roundtrip, key derivation |
| `retry-strategy.test.ts` | P2 | Backoff calculation, jitter, Prisma retry detection |
| `dead-letter-service.test.ts` | P2 | Send, retry, fail, list |
| `inbox-consumer.test.ts` | P2 | Idempotency (process once, skip duplicate) |
| `ai-cache.test.ts` | P2 | Set, get, TTL expiration |
| `pipeline-engine.test.ts` | P2 | Execution, retry, compensation |
| `provider-manager.test.ts` | P2 | Fallback, health, rate limit |
| `queue-service.test.ts` | P2 | Enqueue, dequeue, idempotency |
| `publish-service.test.ts` | P2 | Draft creation, slug, tags |
| `review-queue.test.ts` | P2 | Status transitions |
| `metadata-consolidator.test.ts` | P2 | Parsing, caching |
| `pipeline-context.test.ts` | P3 | Variable management |
| `pipeline-events.test.ts` | P3 | Event emission |
| `stage-executors.test.ts` | P3 | Each stage executor |
| `schedule-service.test.ts` | P3 | Schedule, cancel, execute due |

**Total: 20 test files needed. Currently: 0.**

---

# 7. PRODUCTION READINESS SCORE

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Architecture** | 92% | Clean design, some duplicate retry logic (StageRunner vs PipelineEngine) |
| **Database** | 100% | All 24 models complete with proper indexes and relations |
| **Backend Services** | 85% | All services exist, some need fixes (cost tracking, rate limiting, type safety) |
| **Backend APIs** | 80% | 30 endpoints implemented, missing Rules CRUD, Dead Letter, Resume, Queue |
| **Workers** | 15% | Code exists but never starts |
| **Scheduler** | 5% | Code exists but never runs |
| **Security** | 95% | Enterprise-grade: prompt guard, SSRF, encryption, content validation |
| **AI Engine** | 80% | Multi-provider, fallback, caching — cost tracking placeholder |
| **Pipeline** | 75% | Engine works, no FULL_AUTOMATION definition, publishStage bypasses service |
| **Publishing** | 80% | PublishService complete, but pipeline publishStage duplicates logic |
| **Admin UI** | 5% | All 15 pages are stubs, zero hooks |
| **Integration** | 60% | Audit constants defined but never called, no notifications, no cache invalidation |
| **Testing** | 0% | Zero test files |
| **Monitoring** | 25% | Basic health endpoint only |
| **Configuration** | 30% | No .env.example, no automation env vars documented |
| **Production Readiness** | 35% | Can't start, can't test, can't manage |
| **Overall Score** | **55%** | Backend solid, operational layer missing |

---

# 8. NEXT IMPLEMENTATION PLAN

## Phase 1: Critical Backend Wiring (System Cannot Function Without This)

### Step 1: Worker Lifecycle Startup
- **Goal:** Start all background workers when the application boots
- **Files to create:** `src/features/automation/workers/startup.ts`
- **Files to modify:** `src/instrumentation.ts`, `src/features/automation/workers/index.ts`
- **Existing systems to reuse:** `workerManager` singleton, all worker classes, `QUEUES` constants
- **Acceptance criteria:** Workers register on boot, `workerManager.workerCount` > 0, `workerManager.getHealth()` returns all workers
- **Verification checklist:**
  - [ ] `workerManager.register()` called for all 5 workers (import, ai-rewrite, ai-metadata, publish, outbox)
  - [ ] `workerManager.startAll()` called after registration
  - [ ] Graceful shutdown on SIGTERM/SIGINT calls `workerManager.stopAll()`
  - [ ] No errors in startup logs
  - [ ] `npm run lint` passes
  - [ ] `npx tsc --noEmit` passes

### Step 2: Scheduler Worker
- **Goal:** Process due publish schedules periodically
- **Files to create:** `src/features/automation/workers/scheduler-worker.ts`
- **Files to modify:** `src/features/automation/workers/startup.ts`, `src/features/automation/workers/index.ts`
- **Existing systems to reuse:** `scheduleService.executeDue()`, `workerManager.register()`
- **Acceptance criteria:** Scheduler worker registered, polls every 60 seconds, executes due schedules
- **Verification checklist:**
  - [ ] `schedulerWorker` class created with `process()` method
  - [ ] Registered in startup with `QUEUES.SCHEDULER`
  - [ ] `scheduleService.executeDue()` called on each poll
  - [ ] Errors logged but don't crash the worker

### Step 3: Outbox Processing
- **Goal:** Process accumulated outbox messages
- **Files to modify:** `src/features/automation/workers/startup.ts`
- **Existing systems to reuse:** `OutboxProcessor` class, `OutboxWorker`, event handlers
- **Acceptance criteria:** OutboxProcessor instantiated, handlers registered, `processNextBatch()` called on interval
- **Verification checklist:**
  - [ ] `OutboxProcessor` instantiated with handlers
  - [ ] Event type → handler mapping registered for all automation events
  - [ ] `processNextBatch()` called every 5 seconds
  - [ ] Messages transition from PENDING to PROCESSED
  - [ ] Failed messages go to dead letter after maxRetries

### Step 4: FULL_AUTOMATION Pipeline Definition
- **Goal:** Define the end-to-end pipeline that chains all stages
- **Files to create:** `src/features/automation/pipeline/definitions.ts`
- **Existing systems to reuse:** `STAGE_EXECUTORS`, `STAGE_COMPENSATORS`, `PipelineDefinition` type
- **Acceptance criteria:** `FULL_AUTOMATION_PIPELINE` constant exported with all 5 stages
- **Verification checklist:**
  - [ ] Stages: IMPORT → AI_REWRITE → AI_METADATA → REVIEW → PUBLISH
  - [ ] Each stage has executor and compensator
  - [ ] Timeouts configured per stage
  - [ ] `getPipelineDefinition()` helper exported

### Step 5: Wire Pipeline Execution from API
- **Goal:** Trigger pipeline execution when admin creates a pipeline run
- **Files to modify:** `src/app/api/admin/automation/pipelines/route.ts`
- **Existing systems to reuse:** `pipelineEngine.execute()`, `getPipelineDefinition()`
- **Acceptance criteria:** POST creates record AND starts execution asynchronously
- **Verification checklist:**
  - [ ] After creating PipelineRun, `pipelineEngine.execute()` called
  - [ ] Execution is async (doesn't block response)
  - [ ] Proper error handling for execution failures
  - [ ] Correlation ID threaded through

## Phase 2: Architectural Fixes (Production Quality)

### Step 6: Fix Transaction Types
- **Goal:** Replace `any` with proper Prisma transaction client type
- **Files to modify:** `src/features/automation/lib/transaction-types.ts`
- **Existing systems to reuse:** PrismaClient types
- **Acceptance criteria:** `AnyPrismaClient` properly typed, no `any` annotations
- **Verification checklist:**
  - [ ] `PrismaTxClient` type defined using Prisma's transaction return type
  - [ ] `AnyPrismaClient` aliased to `PrismaTxClient` for backward compatibility
  - [ ] All files using `AnyPrismaClient` still compile

### Step 7: Fix publishStage
- **Goal:** Use PublishService instead of direct BlogPost creation
- **Files to modify:** `src/features/automation/pipeline/stage-executors.ts:280-340`
- **Existing systems to reuse:** `publishService.createDraft()`
- **Acceptance criteria:** publishStage delegates to PublishService, all features available
- **Verification checklist:**
  - [ ] `publishService` imported and used
  - [ ] Slug generation, HTML sanitization, reading time all handled
  - [ ] Tag associations working
  - [ ] Version snapshots created

### Step 8: Fix Content Hash
- **Goal:** Replace weak 32-bit hash with SHA-256
- **Files to modify:** `src/features/automation/workers/import-worker.ts:130-137`
- **Existing systems to reuse:** Node.js `crypto` module
- **Acceptance criteria:** SHA-256 hash of full content, 64-char hex output
- **Verification checklist:**
  - [ ] `crypto.createHash('sha256')` used
  - [ ] Full content hashed (not truncated)
  - [ ] Hex digest output

### Step 9: Fix Checkpoint Storage
- **Goal:** Use dedicated metadata field instead of errorMessage
- **Files to modify:** `src/features/automation/pipeline/failure-recovery.ts:37-43`
- **Existing systems to reuse:** PipelineRun.metadata field
- **Acceptance criteria:** Checkpoints stored in metadata, error messages separate
- **Verification checklist:**
  - [ ] Save: `db.pipelineRun.update({ data: { metadata: JSON.stringify({ checkpoint }) } })`
  - [ ] Load: Parse from metadata field
  - [ ] Error messages no longer overwritten

### Step 10: Fix Cost Tracking
- **Goal:** Calculate real AI costs based on provider pricing
- **Files to modify:** `src/features/automation/ai/metadata-consolidator.ts`, `src/features/automation/ai/provider-manager.ts`
- **Existing systems to reuse:** Provider config `costPer1kIn`/`costPer1kOut`, token counts from responses
- **Acceptance criteria:** Cost = (promptTokens × costPer1kIn / 1000) + (completionTokens × costPer1kOut / 1000)
- **Verification checklist:**
  - [ ] Cost calculated from provider config
  - [ ] Cost logged in AiRequestLog
  - [ ] Cost visible in health endpoint

### Step 11: Fix Rate Limiting
- **Goal:** Enforce token bucket rate limits before calling providers
- **Files to modify:** `src/features/automation/ai/provider-manager.ts:155-175`
- **Existing systems to reuse:** Token bucket in `rateLimitTokens` Map
- **Acceptance criteria:** Rate limit checked before each provider call, wait if bucket empty
- **Verification checklist:**
  - [ ] Token bucket checked before `provider.generate()`
  - [ ] If no tokens, wait for refill
  - [ ] Token consumed after successful call
  - [ ] Configurable RPM per provider

## Phase 3: Missing API Endpoints

### Step 12: Rules CRUD
- **Goal:** Full CRUD for automation rules
- **Files to create:** `src/app/api/admin/automation/rules/route.ts`, `src/app/api/admin/automation/rules/[id]/route.ts`
- **Existing systems to reuse:** `withAdmin`, `withCsrf`, `validateBody`, `auditFromRequest`, `softDelete`
- **Acceptance criteria:** GET (list), POST (create), GET (detail), PUT (update), DELETE (soft delete)
- **Verification checklist:**
  - [ ] All 5 endpoints implemented
  - [ ] Zod validation for create/update
  - [ ] Audit logging on mutations
  - [ ] Soft delete on DELETE

### Step 13: Dead Letter Management
- **Goal:** View and retry dead letter items
- **Files to create:** `src/app/api/admin/automation/dead-letter/route.ts`
- **Existing systems to reuse:** `deadLetterService.list()`, `deadLetterService.retry()`
- **Acceptance criteria:** GET (list with pagination), POST (retry selected items)
- **Verification checklist:**
  - [ ] Paginated list with status filter
  - [ ] Retry operation processes items
  - [ ] Audit logging

### Step 14: Pipeline Resume
- **Goal:** Resume failed pipelines from checkpoint
- **Files to create:** `src/app/api/admin/automation/pipelines/[id]/resume/route.ts`
- **Existing systems to reuse:** `pipelineEngine.execute()`, `failureRecovery.loadCheckpoint()`
- **Acceptance criteria:** POST resumes failed pipeline from last checkpoint
- **Verification checklist:**
  - [ ] Validates pipeline is FAILED
  - [ ] Loads checkpoint
  - [ ] Resumes execution asynchronously
  - [ ] Audit logging

### Step 15: Queue Stats
- **Goal:** Monitor worker health and queue depth
- **Files to create:** `src/app/api/admin/automation/queue/route.ts`
- **Existing systems to reuse:** `workerManager.getHealth()`
- **Acceptance criteria:** GET returns worker health status
- **Verification checklist:**
  - [ ] Returns worker names, statuses, processed/failed counts
  - [ ] Last processed time included

## Phase 4: Admin UI (15 Pages)

### Step 16: Dashboard Page
- **Goal:** System overview with real-time stats
- **Files to modify:** `src/features/automation/pages/AutomationDashboardPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-dashboard.ts`
- **Existing systems to reuse:** Health API, Queue API, Pipeline API, `queryKeys.automation.*`, DataTable, Card, Badge
- **Acceptance criteria:** Shows worker status, queue depth, pipeline success/failure rates, recent runs
- **Verification checklist:**
  - [ ] Stats cards with real data
  - [ ] Worker status table
  - [ ] Recent pipeline runs
  - [ ] Loading and error states
  - [ ] Bengali labels

### Step 17: Source Pages
- **Goal:** List and edit content sources
- **Files to modify:** `src/features/automation/pages/SourceListPage.tsx`, `SourceEditorPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-sources.ts`
- **Existing systems to reuse:** Sources API, DataTable, Dialog, Form components
- **Acceptance criteria:** List with filters/pagination, Create/Edit form, Delete confirmation
- **Verification checklist:**
  - [ ] DataTable with columns: Name, Type, Content Type, Status, Actions
  - [ ] Filters for sourceType, isActive
  - [ ] Create/Edit dialog with validation
  - [ ] Delete with confirmation

### Step 18: Provider Pages
- **Goal:** List and edit AI providers
- **Files to modify:** `src/features/automation/pages/ProviderListPage.tsx`, `ProviderEditorPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-providers.ts`
- **Existing systems to reuse:** Providers API, DataTable, Dialog, Form components
- **Acceptance criteria:** List with health status, Create/Edit form, Key rotation, Delete
- **Verification checklist:**
  - [ ] DataTable with columns: Name, Type, Model, Status, Actions
  - [ ] API key masked in display
  - [ ] Create/Edit with API key show/hide
  - [ ] Health check button

### Step 19: Template Pages
- **Goal:** List and edit prompt templates
- **Files to modify:** `src/features/automation/pages/TemplateListPage.tsx`, `TemplateEditorPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-templates.ts`
- **Existing systems to reuse:** Templates API, DataTable, Dialog, Form components
- **Acceptance criteria:** List with category filter, Create/Edit with version management
- **Verification checklist:**
  - [ ] DataTable with columns: Name, Category, Version, Status, Actions
  - [ ] Create template with first version
  - [ ] Version history display

### Step 20: Pipeline Pages
- **Goal:** List and view pipeline run details
- **Files to modify:** `src/features/automation/pages/PipelineListPage.tsx`, `PipelineDetailPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-pipelines.ts`
- **Existing systems to reuse:** Pipelines API, DataTable, Card, Badge
- **Acceptance criteria:** List with status filter, Detail with stage progress and events
- **Verification checklist:**
  - [ ] DataTable with columns: Correlation ID, Source, Type, Status, Created, Actions
  - [ ] Status color coding (PENDING/RUNNING/COMPLETED/FAILED)
  - [ ] Detail page with stage-by-stage progress
  - [ ] Event timeline
  - [ ] Resume button for failed pipelines

### Step 21: Rule Pages
- **Goal:** List and edit automation rules
- **Files to modify:** `src/features/automation/pages/RuleListPage.tsx`, `RuleEditorPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-rules.ts`
- **Existing systems to reuse:** Rules API, DataTable, Dialog, Form components
- **Acceptance criteria:** List with type filter, Create/Edit with JSON editors for conditions/actions
- **Verification checklist:**
  - [ ] DataTable with columns: Name, Type, Priority, Status, Actions
  - [ ] JSON editor for conditions and actions
  - [ ] Priority slider

### Step 22: Review Page
- **Goal:** Human review workflow
- **Files to modify:** `src/features/automation/pages/ReviewListPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-review.ts`
- **Existing systems to reuse:** Review API, DataTable, Dialog
- **Acceptance criteria:** List with status filter, Approve/Reject actions, Content preview
- **Verification checklist:**
  - [ ] DataTable with columns: Title, Entity Type, Status, Auto Score, Assigned To, Actions
  - [ ] Approve/Reject buttons
  - [ ] Content preview modal

### Step 23: Log Page
- **Goal:** Activity log viewer
- **Files to modify:** `src/features/automation/pages/LogListPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-logs.ts`
- **Existing systems to reuse:** Pipeline Events API, DataTable
- **Acceptance criteria:** List with event type filter, Timeline view
- **Verification checklist:**
  - [ ] DataTable with columns: Timestamp, Event Type, Pipeline, Stage, Status
  - [ ] Filter by event type
  - [ ] Detail modal

### Step 24: Schedule Page
- **Goal:** Manage publish schedules
- **Files to modify:** `src/features/automation/pages/ScheduleListPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-schedules.ts`
- **Existing systems to reuse:** Schedule API, DataTable, Dialog
- **Acceptance criteria:** List with status filter, Cancel action, Create schedule form
- **Verification checklist:**
  - [ ] DataTable with columns: Post, Scheduled At, Status, Actions
  - [ ] Cancel button
  - [ ] Create schedule dialog

### Step 25: Settings Page
- **Goal:** System configuration
- **Files to modify:** `src/features/automation/pages/AutomationSettingsPage.tsx`
- **Files to create:** `src/hooks/admin/use-automation-settings.ts`
- **Existing systems to reuse:** Settings API, Form components
- **Acceptance criteria:** Grouped settings form with tabs, Save with validation
- **Verification checklist:**
  - [ ] Tabs: General, AI, Publishing, Security
  - [ ] Key-value pair editor
  - [ ] Save button with loading state

## Phase 5: Testing

### Step 26: Security Tests
- **Goal:** Verify all security modules work correctly
- **Files to create:** 6 test files in `src/features/automation/__tests__/`
- **Existing systems to reuse:** Vitest, all security modules
- **Acceptance criteria:** All 6 security test files pass
- **Verification checklist:**
  - [ ] `prompt-guard.test.ts` — 10 injection categories tested
  - [ ] `ssrf-firewall.test.ts` — Protocol, hostname, DNS, IP blocking
  - [ ] `ssrf-client.test.ts` — Redirects, size limits
  - [ ] `prompt-sanitizer.test.ts` — Zero-width chars, delimiters
  - [ ] `content-validator.test.ts` — Magic bytes, polyglot
  - [ ] `encryption-service.test.ts` — Roundtrip encrypt/decrypt

### Step 27: Engine Tests
- **Goal:** Verify core engine components
- **Files to create:** 10 test files in `src/features/automation/__tests__/`
- **Existing systems to reuse:** Vitest, all engine modules
- **Acceptance criteria:** All 10 engine test files pass
- **Verification checklist:**
  - [ ] `retry-strategy.test.ts` — Backoff, jitter
  - [ ] `dead-letter-service.test.ts` — Send, retry, list
  - [ ] `inbox-consumer.test.ts` — Idempotency
  - [ ] `ai-cache.test.ts` — Set, get, TTL
  - [ ] `pipeline-engine.test.ts` — Execution, retry, compensation
  - [ ] `provider-manager.test.ts` — Fallback, health
  - [ ] `queue-service.test.ts` — Enqueue, dequeue
  - [ ] `publish-service.test.ts` — Draft, slug, tags
  - [ ] `review-queue.test.ts` — Status transitions
  - [ ] `metadata-consolidator.test.ts` — Parsing, caching

## Phase 6: Integration & Polish

### Step 28: Notification Integration
- **Goal:** Trigger notifications for automation events
- **Files to modify:** `src/features/automation/pipeline/pipeline-events.ts`
- **Existing systems to reuse:** `notification-service.ts`
- **Acceptance criteria:** PIPELINE_FAILED, REVIEW_REQUIRED, dead letter trigger notifications
- **Verification checklist:**
  - [ ] Import notification service
  - [ ] Send notification on PIPELINE_FAILED
  - [ ] Send notification on REVIEW_REQUIRED
  - [ ] Send notification on dead letter items

### Step 29: Alerting System
- **Goal:** Email/webhook alerts for critical failures
- **Files to create:** `src/features/automation/monitoring/alert-service.ts`, `src/features/automation/monitoring/provider-health-monitor.ts`
- **Existing systems to reuse:** Provider health check, dead letter service
- **Acceptance criteria:** Alerts sent for pipeline failures, provider failures, dead letter items
- **Verification checklist:**
  - [ ] Alert service with email/webhook support
  - [ ] Provider health monitor runs in background
  - [ ] Alerts deduplicated (not spammy)

### Step 30: Analytics Population
- **Goal:** Populate AnalyticsDailyFact for trend tracking
- **Files to modify:** `src/features/automation/pipeline/pipeline-events.ts`
- **Existing systems to reuse:** `AnalyticsDailyFact` Prisma model
- **Acceptance criteria:** Daily facts written for pipelines, content, AI usage, costs
- **Verification checklist:**
  - [ ] PIPELINE_COMPLETED increments PIPELINES_RUN
  - [ ] PIPELINE_FAILED increments PIPELINES_FAILED
  - [ ] AI requests logged with token counts
  - [ ] Costs aggregated daily

### Step 31: .env.example
- **Goal:** Document all required environment variables
- **Files to create:** `.env.example`
- **Existing systems to reuse:** None
- **Acceptance criteria:** All automation env vars documented with descriptions
- **Verification checklist:**
  - [ ] AI provider keys documented
  - [ ] Worker configuration documented
  - [ ] Pipeline settings documented
  - [ ] SSRF whitelist documented

---

**Final Note:** This roadmap contains 31 steps across 6 phases. The system has a solid backend foundation (24 models, 33 services, 30 API endpoints) but needs the operational layer (worker startup, outbox processing) and UI layer (15 pages) to become production-ready. The critical path is: Worker Startup → Outbox Processing → Pipeline Execution → Admin UI → Tests.
