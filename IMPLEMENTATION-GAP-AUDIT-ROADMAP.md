# SIKKHA AI CONTENT AUTOMATION — PHASE 2.2 IMPLEMENTATION GAP AUDIT & NEXT ROADMAP

**Audit Date:** 2026-07-27
**Audit Type:** Production-level implementation gap analysis
**Method:** Source code verification — every file read, every import traced, every integration verified
**Attached Report:** AUTOMATION-AUDIT-REPORT.md (previous audit)

---

# PHASE 1: COMPLETE IMPLEMENTATION STATUS

| Module | Status | Completion % | Notes |
|--------|--------|-------------|-------|
| Prisma Schema (22 models) | ✅ COMPLETE | 100% | All 22 models, relations, indexes, constraints verified |
| Prisma Migrations | ✅ COMPLETE | 100% | 5 migrations exist and apply cleanly |
| BlogPost `automationCorrelationId` | ✅ COMPLETE | 100% | Field exists at schema.prisma:2042 |
| Soft Delete Integration | ✅ COMPLETE | 100% | All 12 automation models registered in `soft-delete.ts` SOFT_DELETE_MODELS |
| Encryption Service | ✅ COMPLETE | 100% | AES-256-GCM, key derivation, decrypt used by OpenAI provider |
| Retry Strategy | ✅ COMPLETE | 100% | `withRetry()`, `calculateBackoff()`, `isPrismaRetryable()` |
| Outbox Writer | ✅ COMPLETE | 100% | `write()` and `writeMany()` inside transactions |
| Outbox Processor | ✅ COMPLETE | 100% | Lease-based locking, batch processing, exponential backoff, dead letter |
| Inbox Consumer | ✅ COMPLETE | 100% | Idempotent consumption via composite key |
| Dead Letter Service | ✅ COMPLETE | 100% | Send, retry, fail, list, count operations |
| Saga Coordinator | ✅ COMPLETE | 100% | Forward + compensate, transactional variant |
| Stage Runner | ✅ COMPLETE | 100% | Timeout, retry, backoff (used by SagaCoordinator only) |
| Prompt Guard | ✅ COMPLETE | 100% | 10 categories, 40+ regex patterns, 4 heuristics |
| Prompt Sanitizer | ✅ COMPLETE | 100% | Zero-width stripping, delimiter wrapping, 50K truncation |
| Prompt Validator | ✅ COMPLETE | 100% | Safety, hallucination, structure, quality checks |
| SSRF Firewall | ✅ COMPLETE | 100% | 5-layer validation, IPv4+IPv6, DNS resolution |
| SSRF Client | ✅ COMPLETE | 100% | Manual redirect following, size limiting |
| Content Validator | ✅ COMPLETE | 100% | Magic bytes, polyglot, binary detection |
| AI Provider Manager | ✅ COMPLETE | 100% | Multi-provider, fallback, health, rate limiting |
| Prompt Template Engine | ✅ COMPLETE | 100% | DB templates, versioning, interpolation, 8 defaults |
| Metadata Consolidator | ✅ COMPLETE | 100% | Single-call generation, caching, request logging |
| AI Response Cache | ✅ COMPLETE | 100% | SHA-256 keys, TTL, upsert |
| AI Request Logger | ✅ COMPLETE | 100% | DB-backed, cost aggregation |
| Content Generator | ✅ COMPLETE | 100% | Wraps provider for content rewriting |
| OpenAI Provider | ✅ COMPLETE | 100% | AES-256-GCM key decryption, JSON mode, env fallback |
| Gemini Provider | ✅ COMPLETE | 100% | API key in query param, JSON response |
| Anthropic Provider | ✅ COMPLETE | 100% | Anthropic-specific headers |
| Pipeline Engine | ✅ COMPLETE | 100% | Sequential execution, retry, timeout, compensation |
| Pipeline Context | ✅ COMPLETE | 100% | Variable management, stage state, persistence |
| Pipeline Events | ✅ COMPLETE | 100% | 18 event types, DB + outbox emission |
| Stage Executors | ✅ COMPLETE | 100% | IMPORT, AI_REWRITE, AI_METADATA, REVIEW, PUBLISH |
| Stage Compensators | ✅ COMPLETE | 100% | Compensation for all 4 executable stages |
| Failure Recovery | ✅ COMPLETE | 100% | Checkpoint, retry, dead letter, resume point |
| Compensation Service | ✅ COMPLETE | 100% | LIFO rollback, per-stage compensation |
| Publish Service | ✅ COMPLETE | 100% | Draft creation, slug generation, tag association, versioning |
| Review Queue | ✅ COMPLETE | 100% | Create, approve/reject, status transitions |
| Schedule Service | ✅ COMPLETE | 100% | Schedule, cancel, execute due |
| Rollback Service | ✅ COMPLETE | 100% | Snapshot, rollback, history, diff |
| Import Worker | ✅ COMPLETE | 100% | SSRF fetch, content validation, store, enqueue AI_REWRITE |
| AI Worker | ✅ COMPLETE | 100% | Rewrite + metadata processing, queue chaining |
| Publish Worker | ✅ COMPLETE | 100% | Creates BlogPost from pipeline output |
| Outbox Worker | ✅ COMPLETE | 100% | Dispatches outbox messages to handlers |
| Worker Manager | ✅ COMPLETE | 100% | Register, start, stop, pause, resume, health |
| Queue Service | ✅ COMPLETE | 100% | DB-backed queue, idempotency, dead letter |
| Audit Actions (20) | ✅ COMPLETE | 100% | All 20 AUTOMATION_* actions defined |
| Entity Types (15) | ✅ COMPLETE | 100% | All 15 AUTOMATION_* entity types defined |
| Route Store (15 routes) | ✅ COMPLETE | 100% | All admin-automation routes defined |
| Admin Sidebar (10 items) | ✅ COMPLETE | 100% | All navigation items with icons |
| Admin Layout Lazy Loading | ✅ COMPLETE | 100% | 15 lazy imports registered |
| API: Pipelines (GET/POST) | ✅ COMPLETE | 100% | With validation, CSRF, audit, pagination |
| API: Sources (GET/POST) | ✅ COMPLETE | 100% | With validation, CSRF, audit, pagination |
| API: Providers (CRUD + rotate-key) | ✅ COMPLETE | 100% | Full CRUD with key rotation |
| API: Templates (GET/POST) | ✅ COMPLETE | 100% | With version creation |
| API: Review (GET) | ✅ COMPLETE | 100% | List with filters |
| API: Publish (POST) | ✅ COMPLETE | 100% | With audit |
| API: Schedule (GET/POST) | ✅ COMPLETE | 100% | Schedule creation |
| API: Versions (GET) | ✅ COMPLETE | 100% | Version history |
| API: Settings (GET/PUT) | ✅ COMPLETE | 100% | Upsert with audit |
| API: Health (GET) | ✅ COMPLETE | 100% | DB, Redis, queue, providers, storage |
| API: Provider [id] (GET/PUT/DELETE) | ✅ COMPLETE | 100% | With soft delete |
| --- WORKERS NOT STARTED --- | ❌ MISSING | 0% | `workerManager.start()` never called |
| --- SCHEDULER NOT RUNNING --- | ❌ MISSING | 0% | `scheduleService.executeDue()` never called |
| --- OUTBOX NOT PROCESSED --- | ❌ MISSING | 0% | `OutboxProcessor.processNextBatch()` never called |
| --- WORKER REGISTRATIONS --- | ❌ MISSING | 0% | No `workerManager.register()` calls |
| --- PIPELINE NOT EXECUTED --- | ❌ MISSING | 0% | POST creates record but doesn't call `pipelineEngine.execute()` |
| Admin UI: All 15 pages | ❌ STUB | 5% | Every page is a 5-line `<div>` stub |
| Tests | ❌ MISSING | 0% | Zero test files in automation module |
| Monitoring Dashboard | ❌ MISSING | 0% | No admin pages for monitoring |
| Cost Tracking | ❌ PLACEHOLDER | 5% | Hardcoded to $0 everywhere |
| Notification Integration | ❌ MISSING | 0% | No notification triggers |
| Alerting | ❌ MISSING | 0% | No alerts for failures |

---

# PHASE 2: ARCHITECTURE COMPARISON

## Complete Implementation Map

| Feature | Status | Files | Reason |
|---------|--------|-------|--------|
| Outbox Pattern | ✅ Complete | `outbox-writer.ts`, `outbox-processor.ts` | Write in transaction, process with lease-based locking, retry, dead letter |
| Inbox Pattern | ✅ Complete | `inbox-consumer.ts` | Idempotent consumption via composite key |
| Retry System | ✅ Complete | `retry-strategy.ts` | Exponential backoff with jitter, Prisma retry detection |
| Dead Letter | ✅ Complete | `dead-letter-service.ts` | Send, retry, fail, list, count |
| Saga Pattern | ✅ Complete | `saga-coordinator.ts` | Forward + compensate, transactional variant |
| Stage Runner | ✅ Complete | `stage-runner.ts` | Timeout + retry (used by SagaCoordinator) |
| SSRF Protection | ✅ Complete | `ssrf-firewall.ts`, `ssrf-client.ts` | 5-layer validation, manual redirect following |
| Prompt Injection Guard | ✅ Complete | `prompt-guard.ts` | 10 categories, 40+ patterns, heuristics |
| Prompt Sanitization | ✅ Complete | `prompt-sanitizer.ts` | Zero-width chars, delimiters, truncation |
| Output Validation | ✅ Complete | `prompt-validator.ts` | Safety, hallucination, structure checks |
| Content Validation | ✅ Complete | `content-validator.ts` | Magic bytes, polyglot, binary detection |
| Encryption | ✅ Complete | `encryption-service.ts` | AES-256-GCM, key derivation |
| AI Provider Abstraction | ✅ Complete | `provider.ts` | Interface with generate/validate/estimateCost |
| Multi-Provider Fallback | ✅ Complete | `provider-manager.ts` | Priority-based, health tracking, 3-strike |
| Prompt Templates | ✅ Complete | `prompt-engine.ts` | DB versions, interpolation, 8 built-in defaults |
| Consolidated Metadata | ✅ Complete | `metadata-consolidator.ts` | Single-call, caching, cost tracking |
| AI Response Caching | ✅ Complete | `ai-cache.ts` | SHA-256, TTL, cleanup |
| AI Request Logging | ✅ Complete | `ai-request-log.ts` | DB-backed, cost aggregation |
| Pipeline Engine | ✅ Complete | `pipeline-engine.ts` | Sequential, retry, timeout, compensation |
| Pipeline Context | ✅ Complete | `pipeline-context.ts` | Variables, stage state, persistence |
| Pipeline Events | ✅ Complete | `pipeline-events.ts` | 18 event types, DB + outbox |
| Stage Executors (5) | ✅ Complete | `stage-executors.ts` | IMPORT, AI_REWRITE, AI_METADATA, REVIEW, PUBLISH |
| Stage Compensators (4) | ✅ Complete | `stage-executors.ts:373-405` | Per-stage compensation |
| Failure Recovery | ✅ Complete | `failure-recovery.ts` | Checkpoint, retry, dead letter, resume |
| Compensation (LIFO) | ✅ Complete | `compensation.ts` | Per-stage rollback handlers |
| Publish Service | ✅ Complete | `publish-service.ts` | Draft, slug, sanitize, tags, versioning |
| Review Queue | ✅ Complete | `review-queue.ts` | Create, approve/reject, status transitions |
| Schedule Service | ✅ Complete | `schedule-service.ts` | Schedule, cancel, execute due |
| Rollback Service | ✅ Complete | `rollback-service.ts` | Snapshot, rollback, history, diff |
| Worker Manager | ✅ Complete | `worker-manager.ts` | Register, start, stop, pause, health |
| Queue Service | ✅ Complete | `queue-service.ts` | DB-backed, idempotency, dead letter |
| Import Worker | ✅ Complete | `import-worker.ts` | SSRF fetch, validate, store, enqueue |
| AI Worker | ✅ Complete | `ai-worker.ts` | Rewrite + metadata, queue chaining |
| Publish Worker | ✅ Complete | `publish-worker.ts` | BlogPost creation from output |
| Outbox Worker | ✅ Complete | `outbox-worker.ts` | Message dispatch to handlers |
| FULL_AUTOMATION Pipeline | ❌ Missing | — | Type defined but no pre-built definition object |
| Worker Startup | ❌ Missing | — | No registration/start code |
| Scheduler Startup | ❌ Missing | — | No cron worker for `executeDue()` |
| Outbox Processing Startup | ❌ Missing | — | No code calls `processNextBatch()` |
| Pipeline Execution from API | ❌ Missing | — | POST creates record but doesn't execute |
| Admin UI Pages (15) | ❌ Stubbed | `pages/*.tsx` | All 5-line stubs |
| Tests | ❌ Missing | — | Zero test files |

---

# PHASE 3: ALL MISSING BACKEND IMPLEMENTATION

## Critical (Blocks entire system from functioning)

### 1. Worker Lifecycle — MISSING
**File to modify:** `src/instrumentation.ts`
**Current state:** Only seeds super admin, registers process handlers. No worker code.
**Missing:**
- `workerManager.register('import', QUEUES.IMPORT, importWorker.process, { pollIntervalMs: 10000 })`
- `workerManager.register('ai-rewrite', QUEUES.AI_REWRITE, aiWorker.processRewrite, { pollIntervalMs: 5000 })`
- `workerManager.register('ai-metadata', QUEUES.AI_METADATA, aiWorker.processMetadata, { pollIntervalMs: 5000 })`
- `workerManager.register('publish', QUEUES.PUBLISH, publishWorker.process, { pollIntervalMs: 10000 })`
- `workerManager.register('outbox', QUEUES.OUTBOX, outboxWorker.process, { pollIntervalMs: 5000 })`
- `workerManager.startAll()`
- Graceful shutdown on `process.on('SIGTERM')`

### 2. Scheduler Worker — MISSING
**File to create:** `src/features/automation/workers/scheduler-worker.ts`
**Missing:** A worker that periodically calls `scheduleService.executeDue()` to process due publish schedules
**Also missing:** Registration in instrumentation.ts

### 3. Outbox Processing — MISSING
**File to modify:** `src/instrumentation.ts`
**Current state:** `OutboxProcessor` exists but no one creates or runs it
**Missing:**
- Instantiate `OutboxProcessor` with handlers
- Register handlers for `sikkha.source.created`, `sikkha.pipeline.completed`, etc.
- Call `processNextBatch()` on interval

### 4. Pipeline Execution from API — MISSING
**File to modify:** `src/app/api/admin/automation/pipelines/route.ts`
**Current state:** POST creates PipelineRun record + PipelineEvent but never calls `pipelineEngine.execute()`
**Missing:**
- After creating the record, build a `PipelineDefinition` and call `pipelineEngine.execute()`
- Or enqueue to a pipeline execution queue for async processing

### 5. FULL_AUTOMATION Pipeline Definition — MISSING
**File to create:** `src/features/automation/pipeline/definitions.ts`
**Missing:** A pre-built pipeline definition that chains:
- IMPORT → AI_REWRITE → AI_METADATA → REVIEW → PUBLISH
- With compensators for each stage

### 6. Tests — MISSING (Zero test files)
**Files to create:**
- `src/features/automation/__tests__/pipeline-engine.test.ts`
- `src/features/automation/__tests__/provider-manager.test.ts`
- `src/features/automation/__tests__/prompt-guard.test.ts`
- `src/features/automation/__tests__/ssrf-firewall.test.ts`
- `src/features/automation/__tests__/ssrf-client.test.ts`
- `src/features/automation/__tests__/prompt-sanitizer.test.ts`
- `src/features/automation/__tests__/content-validator.test.ts`
- `src/features/automation/__tests__/retry-strategy.test.ts`
- `src/features/automation/__tests__/queue-service.test.ts`
- `src/features/automation/__tests__/publish-service.test.ts`
- `src/features/automation/__tests__/review-queue.test.ts`
- `src/features/automation/__tests__/encryption-service.test.ts`
- `src/features/automation/__tests__/metadata-consolidator.test.ts`
- `src/features/automation/__tests__/ai-cache.test.ts`
- `src/features/automation/__tests__/dead-letter-service.test.ts`
- `src/features/automation/__tests__/inbox-consumer.test.ts`

## High (Blocks production quality)

### 7. Cost Tracking — PLACEHOLDER
**Files to modify:**
- `src/features/automation/ai/metadata-consolidator.ts:83` — `costUsd: 0` hardcoded
- `src/features/automation/ai/metadata-consolidator.ts:131` — same
- `src/features/automation/ai/ai-request-log.ts` — no cost calculation
**Missing:** Actual cost calculation based on provider costPer1kIn/costPer1kOut × token usage

### 8. Provider Health Background Check — MISSING
**Missing:** Background health monitoring for AI providers (not just on-demand via API)

### 9. Notification Integration — MISSING
**Missing:** Pipeline events should trigger admin notifications
**File to modify:** `src/features/automation/pipeline/pipeline-events.ts`
**Missing integration with:** `src/lib/notification-service.ts`

### 10. Alerting System — MISSING
**Missing:** Email/webhook alerts for pipeline failures, dead letter items, provider failures

### 11. Rate Limit Integration — MISSING
**File to modify:** `src/features/automation/ai/provider-manager.ts:165`
**Current:** `callWithRateLimit` doesn't actually enforce rate limits
**Missing:** Integration with `@upstash/ratelimit` or similar

## Medium (Production polish)

### 12. Missing CRUD API Endpoints
| Entity | Missing Methods | Files |
|--------|----------------|-------|
| Sources | PUT, DELETE | `sources/[id]/route.ts` (doesn't exist) |
| Templates | PUT, DELETE | `templates/[id]/route.ts` (doesn't exist) |
| Rules | GET, POST, PUT, DELETE | `rules/route.ts`, `rules/[id]/route.ts` (don't exist) |
| Review Tasks | PUT (approve/reject), DELETE | `review/[id]/route.ts` (doesn't exist) |
| Schedules | PUT, DELETE, CANCEL | `publish/schedule/[id]/route.ts` (doesn't exist) |
| Versions | RESTORE | `versions/restore/route.ts` (doesn't exist) |
| Dead Letter | GET, POST (retry), DELETE | `dead-letter/route.ts` (doesn't exist) |
| Bulk Operations | POST | `bulk/route.ts` (doesn't exist) |

### 13. Missing Cron Endpoint
**File to modify:** `src/app/api/admin/cron/route.ts` (if exists) or create
**Missing:** Cron endpoint that `vercel.json` points to for scheduled publish execution

### 14. Pipeline Resume API
**Missing:** API endpoint to resume a failed pipeline from checkpoint
**File to create:** `src/app/api/admin/automation/pipelines/[id]/resume/route.ts`

### 15. Queue Management API
**Missing:** API to view queue depth, retry dead letter items, purge completed jobs
**File to create:** `src/app/api/admin/automation/queue/route.ts`

## Low (Nice to have)

### 16. Content Deduplication API
**Missing:** API to view and manage `ContentDuplicate` entries

### 17. Media Asset Upload Integration
**Missing:** Integration with UploadThing for `MediaAsset` model

### 18. Social Media Auto-Share
**Missing:** Auto-share published posts to social channels

### 19. Thumbnail Image Generation
**Missing:** Only generates text prompt, not actual image

---

# PHASE 4: ALL MISSING FRONTEND IMPLEMENTATION

## Critical (Admin cannot use the system)

Every single admin UI page is a 5-line stub. All need full implementation.

### 1. AutomationDashboardPage — STUB
**File:** `src/features/automation/pages/AutomationDashboardPage.tsx`
**Needs:**
- Queue depth visualization (pending/processing/failed)
- Pipeline run summary (last 24h, success rate)
- Provider health status cards
- Recent pipeline runs table
- Cost summary (daily/weekly/monthly)
- Active workers status
- Dead letter item count
- Quick action buttons (run pipeline, check health)

### 2. SourceListPage — STUB
**File:** `src/features/automation/pages/SourceListPage.tsx`
**Needs:**
- DataTable with columns: Name, Type, Content Type, URL, Status, Last Run, Actions
- Filters: sourceType, contentType, isActive
- Pagination
- Create/Edit/Delete actions
- Inline status toggle

### 3. SourceEditorPage — STUB
**File:** `src/features/automation/pages/SourceEditorPage.tsx`
**Needs:**
- Form: name, sourceType (dropdown), contentType (dropdown), url, isActive, fetchInterval, config (JSON), webhookSecret
- Validation (Zod)
- Create and Edit modes
- Test connection button

### 4. ProviderListPage — STUB
**File:** `src/features/automation/pages/ProviderListPage.tsx`
**Needs:**
- DataTable: Name, Display Name, Type, Model, Status (Active/Inactive), Cost, Actions
- Health check button per provider
- API key display (masked)
- Create/Edit/Delete/Key Rotation actions

### 5. ProviderEditorPage — STUB
**File:** `src/features/automation/pages/ProviderEditorPage.tsx`
**Needs:**
- Form: name, displayName, providerType (dropdown), apiKey, baseUrl, defaultModel, models, rateLimitRpm, costPer1kIn, costPer1kOut, isActive
- API key show/hide toggle
- Test connection button
- Create and Edit modes

### 6. TemplateListPage — STUB
**File:** `src/features/automation/pages/TemplateListPage.tsx`
**Needs:**
- DataTable: Name, Category, Active Version, Status, Actions
- Filter by category
- Create/Delete actions

### 7. TemplateEditorPage — STUB
**File:** `src/features/automation/pages/TemplateEditorPage.tsx`
**Needs:**
- Form: name, description, category (dropdown), isActive
- Version editor: systemPrompt (textarea), userPrompt (textarea), outputSchema, variables, changeLog
- Preview rendered prompt
- Version history

### 8. PipelineListPage — STUB
**File:** `src/features/automation/pages/PipelineListPage.tsx`
**Needs:**
- DataTable: Name, Type, Status, Source, Stages, Duration, Actions
- Filter by status, pipelineType
- Run button per pipeline
- View details button

### 9. PipelineDetailPage — STUB
**File:** `src/features/automation/pages/PipelineDetailPage.tsx`
**Needs:**
- Pipeline run details with stage-by-stage progress
- Stage status cards (color-coded: PENDING/RUNNING/COMPLETED/FAILED/SKIPPED)
- Variables viewer
- Event timeline
- Retry/Resume button for failed pipelines
- Compensation log

### 10. RuleListPage — STUB
**File:** `src/features/automation/pages/RuleListPage.tsx`
**Needs:**
- DataTable: Name, Type, Priority, Status, Actions
- Create/Edit/Delete

### 11. RuleEditorPage — STUB
**File:** `src/features/automation/pages/RuleEditorPage.tsx`
**Needs:**
- Form: name, ruleType, conditions (JSON editor), actions (JSON editor), priority, isActive

### 12. LogListPage — STUB
**File:** `src/features/automation/pages/LogListPage.tsx`
**Needs:**
- DataTable: Timestamp, Event Type, Pipeline, Stage, Status, Details
- Filter by event type, pipeline
- Timeline view
- Detail modal

### 13. ReviewListPage — STUB
**File:** `src/features/automation/pages/ReviewListPage.tsx`
**Needs:**
- DataTable: Title, Entity Type, Status, Auto Score, Assigned To, Actions
- Approve/Reject/Request Changes buttons
- Content preview modal
- Filter by status

### 14. AutomationSettingsPage — STUB
**File:** `src/features/automation/pages/AutomationSettingsPage.tsx`
**Needs:**
- Grouped settings form (key-value pairs)
- Group tabs: General, AI, Publishing, Security
- Save button with validation

### 15. ScheduleListPage — STUB
**File:** `src/features/automation/pages/ScheduleListPage.tsx`
**Needs:**
- DataTable: Post, Scheduled At, Status, Actions
- Cancel button
- Create schedule form
- Filter by status

---

# PHASE 5: ALL INTEGRATION GAPS

| Integration | Status | Evidence | Gap |
|-------------|--------|----------|-----|
| Existing Audit System | ✅ Complete | 20 actions + 15 entity types in `audit.ts:529-639` | None |
| Existing Notification System | ❌ Missing | No import of `notification-service` in any automation file | Pipeline events don't trigger notifications |
| Existing Site Settings | ⚠️ Partial | `AutomationSetting` model is separate from `SiteSetting` | Two separate settings systems |
| Existing Cache | ⚠️ Partial | AI cache exists; no API response cache integration | `cache-invalidate.ts` not connected to automation |
| Existing Permissions | ⚠️ Partial | `withAdmin` role check only; no granular permission checks | No `requirePermission('automation:pipelines:execute')` |
| Existing UploadThing | ❌ Missing | `MediaAsset` model exists but no upload integration | No file upload for media assets |
| Existing Blog | ✅ Complete | `PublishService` creates `BlogPost` with `automationCorrelationId` | None |
| Existing Rich Editor | ❌ Missing | No integration with TipTap content blocks | AI content could use block editor |
| Existing Logger | ✅ Complete | `@/lib/logger` used everywhere | None |
| Existing Queue | ❌ Missing | DB queue exists; no BullMQ/Redis integration | Limited throughput |
| Existing Prisma Middleware | ✅ Complete | Soft-delete middleware active; automation models registered | None |
| Existing Soft Delete | ✅ Complete | All 12 automation models in `SOFT_DELETE_MODELS` set | None |
| Existing Admin Layout | ✅ Complete | Lazy-loaded pages, 10 sidebar items | None |
| Existing Sidebar | ✅ Complete | 10 items in CMS group with icons | None |
| Existing Route Store | ✅ Complete | 15 route definitions | None |
| Existing Query Keys | ❌ Missing | No automation query keys in `query-keys.ts` | Frontend data fetching will be ad-hoc |
| Existing API Utilities | ✅ Complete | `apiResponse`, `apiError`, `paginatedApiResponse` used | None |
| Existing Error Handling | ✅ Complete | `handleApiError` used in all routes | None |
| Existing Authentication | ✅ Complete | `withAdmin` check on all routes | None |
| Existing CSRF | ✅ Complete | `withCsrf` on all mutation endpoints | None |
| Existing Rate Limiter | ⚠️ Partial | Standard rate limiting on routes; AI provider rate limiting is placeholder | `callWithRateLimit` doesn't actually enforce |

---

# PHASE 6: ARCHITECTURAL MISTAKES

### 1. StageRunner vs PipelineEngine Duplicate Retry Logic
**Files:** `src/features/automation/lib/stage-runner.ts` + `src/features/automation/pipeline/pipeline-engine.ts:305-340`
**Issue:** `StageRunner` implements timeout + retry. `PipelineEngine.executeStageWithRetry()` also implements timeout + retry. Two independent retry systems.
**`StageRunner` is only used by `SagaCoordinator`.** The pipeline engine ignores it entirely.
**Recommendation:** Either use StageRunner inside PipelineEngine or remove it.

### 2. AnyPrismaClient Typed as `any`
**File:** `src/features/automation/lib/transaction-types.ts:11`
**Issue:** `export type AnyPrismaClient = any` — defeats TypeScript strict mode.
**Impact:** No type safety in any transaction operation across all automation services.

### 3. Outbox Messages Written But Never Processed
**Files:** `pipeline-events.ts:62` writes to outbox, `outbox-processor.ts` processes them
**Issue:** `PipelineEvents.emit()` writes outbox messages when `publishToOutbox: true`. But no code ever runs `OutboxProcessor.processNextBatch()`. Messages accumulate forever.

### 4. Dead Letter Service Called But Items Never Retried
**File:** `dead-letter-service.ts` has `retry()` and `fail()` methods
**Issue:** No API endpoint or UI exists to retry or fail dead letter items.

### 5. `publishStage` in `stage-executors.ts` Creates BlogPost Directly
**File:** `stage-executors.ts:280-340`
**Issue:** The `publishStage` executor creates a BlogPost directly instead of using `PublishService.createDraft()`. This duplicates slug generation logic and bypasses the publish service's tag association, reading time calculation, and scheduled publishing.

### 6. `importWorker.hashContent` Uses Weak Hash
**File:** `import-worker.ts:130-137`
**Issue:** Uses a 32-bit integer hash (djb2-style) for content deduplication. Collision rate is high.
**Fix:** Use SHA-256 like `ai-cache.ts` and `metadata-consolidator.ts` do.

### 7. Checkpoint Storage Overloads `errorMessage` Field
**File:** `failure-recovery.ts:37-43`
**Issue:** Checkpoints are stored in the `errorMessage` field of `PipelineRun` as JSON. This means a real error message and a checkpoint cannot coexist, and loading a checkpoint requires JSON parsing with try/catch.

---

# PHASE 7: PRODUCTION BLOCKERS

### Critical

| # | Blocker | Impact | Fix |
|---|---------|--------|-----|
| 1 | Workers never start | System cannot process any jobs | Add registration + `startAll()` to `instrumentation.ts` |
| 2 | Scheduler never runs | Scheduled publishes never execute | Create scheduler worker, register in startup |
| 3 | Outbox messages accumulate forever | Memory/storage leak, events never delivered | Start `OutboxProcessor` with handlers |
| 4 | Pipeline POST doesn't execute | Admins can't trigger pipelines | Wire `pipelineEngine.execute()` to API |
| 5 | All 15 UI pages are stubs | Admins can't manage anything | Implement all pages |
| 6 | Zero tests | No confidence in any component | Add comprehensive test suite |

### High

| # | Blocker | Impact | Fix |
|---|---------|--------|-----|
| 7 | Cost tracking at $0 | Budget blind spot | Calculate real costs per provider |
| 8 | `AnyPrismaClient` is `any` | Type safety compromised | Define proper transaction client type |
| 9 | No FULL_AUTOMATION definition | Can't run end-to-end pipeline | Create definition object |
| 10 | publishStage duplicates PublishService | Bug risk, missing features | Use PublishService.createDraft() |
| 11 | No notification integration | Silent failures | Add notification triggers |
| 12 | No dead letter management API | Can't view/retry failed messages | Add CRUD API |

### Medium

| # | Blocker | Impact | Fix |
|---|---------|--------|-----|
| 13 | No alerting | Failures go unnoticed | Add email/webhook alerts |
| 14 | Weak content hash | False dedup collisions | Use SHA-256 |
| 15 | No provider health background check | Providers may silently fail | Add periodic health checks |
| 16 | Rate limit not enforced | AI providers may be rate limited | Integrate with @upstash/ratelimit |
| 17 | Checkpoint overloads errorMessage | Data corruption risk | Use dedicated checkpoint field |

---

# PHASE 8: FINAL REMAINING IMPLEMENTATION CHECKLIST

## STEP 1: Worker Lifecycle (Critical — System cannot function without this)

**Files to modify:**
- `src/instrumentation.ts` — Add worker registration and startup
- `src/features/automation/workers/index.ts` — Add new exports

**Files to create:**
- `src/features/automation/workers/startup.ts` — Worker registration + startup module
- `src/features/automation/workers/scheduler-worker.ts` — Scheduler worker for publish schedules
- `src/features/automation/workers/outbox-startup.ts` — Outbox processor startup

**Dependencies:** None
**Complexity:** Low
**Risk:** Low — additive change, no modification to existing code

## STEP 2: Outbox Processing (Critical — Events accumulate forever)

**Files to modify:**
- `src/features/automation/workers/startup.ts` — Add outbox processor

**Dependencies:** STEP 1
**Complexity:** Low
**Risk:** Low

## STEP 3: Pipeline Execution from API (Critical — Can't trigger pipelines)

**Files to modify:**
- `src/app/api/admin/automation/pipelines/route.ts` — Wire POST to execute pipeline

**Files to create:**
- `src/features/automation/pipeline/definitions.ts` — Pre-built pipeline definitions

**Dependencies:** STEP 1
**Complexity:** Medium
**Risk:** Medium — needs proper error handling for async execution

## STEP 4: FULL_AUTOMATION Pipeline Definition

**Files to create:**
- `src/features/automation/pipeline/definitions.ts`

**Dependencies:** STEP 3
**Complexity:** Low
**Risk:** Low

## STEP 5: Missing CRUD API Endpoints

**Files to create:**
- `src/app/api/admin/automation/sources/[id]/route.ts` — PUT, DELETE
- `src/app/api/admin/automation/templates/[id]/route.ts` — PUT, DELETE
- `src/app/api/admin/automation/rules/route.ts` — GET, POST
- `src/app/api/admin/automation/rules/[id]/route.ts` — GET, PUT, DELETE
- `src/app/api/admin/automation/review/[id]/route.ts` — PUT (approve/reject)
- `src/app/api/admin/automation/publish/schedule/[id]/route.ts` — PUT, DELETE
- `src/app/api/admin/automation/dead-letter/route.ts` — GET, POST (retry)
- `src/app/api/admin/automation/pipelines/[id]/resume/route.ts` — POST
- `src/app/api/admin/automation/queue/route.ts` — GET (stats), POST (purge)

**Dependencies:** STEP 1
**Complexity:** Medium
**Risk:** Low — follows existing patterns

## STEP 6: Cost Tracking

**Files to modify:**
- `src/features/automation/ai/metadata-consolidator.ts` — Replace `costUsd: 0` with calculation
- `src/features/automation/ai/provider-manager.ts` — Add cost estimation to `generate()`
- `src/features/automation/ai/ai-request-log.ts` — Accept real cost values

**Dependencies:** None
**Complexity:** Medium
**Risk:** Low

## STEP 7: Fix Architectural Issues

**Files to modify:**
- `src/features/automation/lib/transaction-types.ts` — Define proper PrismaTxClient type
- `src/features/automation/pipeline/stage-executors.ts:280-340` — Use `PublishService.createDraft()` instead of direct BlogPost creation
- `src/features/automation/workers/import-worker.ts:130-137` — Use SHA-256 for content hash
- `src/features/automation/pipeline/failure-recovery.ts:37-43` — Use dedicated checkpoint field or separate table

**Dependencies:** None
**Complexity:** Medium
**Risk:** Medium — refactoring existing code

## STEP 8: Notification Integration

**Files to modify:**
- `src/features/automation/pipeline/pipeline-events.ts` — Add notification triggers for PIPELINE_COMPLETED, PIPELINE_FAILED

**Dependencies:** None
**Complexity:** Low
**Risk:** Low

## STEP 9: Admin UI — Dashboard Page (First page, highest value)

**Files to modify:**
- `src/features/automation/pages/AutomationDashboardPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-dashboard.ts` — TanStack Query hook

**Dependencies:** STEP 5 (needs API endpoints)
**Complexity:** High
**Risk:** Low

## STEP 10: Admin UI — Sources Pages

**Files to modify:**
- `src/features/automation/pages/SourceListPage.tsx` — Full implementation
- `src/features/automation/pages/SourceEditorPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-sources.ts` — TanStack Query hook

**Dependencies:** STEP 5
**Complexity:** Medium
**Risk:** Low

## STEP 11: Admin UI — Providers Pages

**Files to modify:**
- `src/features/automation/pages/ProviderListPage.tsx` — Full implementation
- `src/features/automation/pages/ProviderEditorPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-providers.ts` — TanStack Query hook

**Dependencies:** STEP 5
**Complexity:** Medium
**Risk:** Low

## STEP 12: Admin UI — Templates Pages

**Files to modify:**
- `src/features/automation/pages/TemplateListPage.tsx` — Full implementation
- `src/features/automation/pages/TemplateEditorPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-templates.ts` — TanStack Query hook

**Dependencies:** STEP 5
**Complexity:** Medium
**Risk:** Low

## STEP 13: Admin UI — Pipelines Pages

**Files to modify:**
- `src/features/automation/pages/PipelineListPage.tsx` — Full implementation
- `src/features/automation/pages/PipelineDetailPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-pipelines.ts` — TanStack Query hook

**Dependencies:** STEP 3, STEP 5
**Complexity:** High
**Risk:** Low

## STEP 14: Admin UI — Rules Pages

**Files to modify:**
- `src/features/automation/pages/RuleListPage.tsx` — Full implementation
- `src/features/automation/pages/RuleEditorPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-rules.ts` — TanStack Query hook

**Dependencies:** STEP 5
**Complexity:** Medium
**Risk:** Low

## STEP 15: Admin UI — Review, Logs, Schedules, Settings Pages

**Files to modify:**
- `src/features/automation/pages/ReviewListPage.tsx` — Full implementation
- `src/features/automation/pages/LogListPage.tsx` — Full implementation
- `src/features/automation/pages/ScheduleListPage.tsx` — Full implementation
- `src/features/automation/pages/AutomationSettingsPage.tsx` — Full implementation

**Files to create:**
- `src/hooks/admin/use-automation-review.ts`
- `src/hooks/admin/use-automation-logs.ts`
- `src/hooks/admin/use-automation-schedules.ts`
- `src/hooks/admin/use-automation-settings.ts`

**Dependencies:** STEP 5
**Complexity:** High
**Risk:** Low

## STEP 16: Test Suite — Security Tests

**Files to create:**
- `src/features/automation/__tests__/prompt-guard.test.ts` — All 10 injection categories
- `src/features/automation/__tests__/ssrf-firewall.test.ts` — All 5 layers
- `src/features/automation/__tests__/ssrf-client.test.ts` — Redirect handling
- `src/features/automation/__tests__/prompt-sanitizer.test.ts` — All sanitization rules
- `src/features/automation/__tests__/content-validator.test.ts` — Magic bytes, polyglot
- `src/features/automation/__tests__/encryption-service.test.ts` — Encrypt/decrypt roundtrip

**Dependencies:** None
**Complexity:** High
**Risk:** Low

## STEP 17: Test Suite — Engine Tests

**Files to create:**
- `src/features/automation/__tests__/pipeline-engine.test.ts` — Execution, retry, compensation
- `src/features/automation/__tests__/provider-manager.test.ts` — Fallback, health, rate limit
- `src/features/automation/__tests__/retry-strategy.test.ts` — Backoff, jitter
- `src/features/automation/__tests__/queue-service.test.ts` — Enqueue, dequeue, idempotency
- `src/features/automation/__tests__/publish-service.test.ts` — Draft creation, slug, tags
- `src/features/automation/__tests__/review-queue.test.ts` — Status transitions
- `src/features/automation/__tests__/dead-letter-service.test.ts` — Send, retry, list
- `src/features/automation/__tests__/inbox-consumer.test.ts` — Idempotency
- `src/features/automation/__tests__/metadata-consolidator.test.ts` — Parsing, caching
- `src/features/automation/__tests__/ai-cache.test.ts` — Set, get, TTL, cleanup

**Dependencies:** None
**Complexity:** High
**Risk:** Low

## STEP 18: Alerting & Monitoring

**Files to create:**
- `src/features/automation/monitoring/alert-service.ts` — Email/webhook alerts
- `src/features/automation/monitoring/provider-health-monitor.ts` — Background health checks

**Files to modify:**
- `src/features/automation/workers/startup.ts` — Add health monitor

**Dependencies:** STEP 1
**Complexity:** Medium
**Risk:** Low

## STEP 19: Fix Rate Limiting

**Files to modify:**
- `src/features/automation/ai/provider-manager.ts:165` — Implement actual rate limiting with @upstash/ratelimit

**Dependencies:** None
**Complexity:** Low
**Risk:** Low

## STEP 20: Query Keys Integration

**Files to modify:**
- `src/lib/query-keys.ts` — Add automation query keys

**Dependencies:** None
**Complexity:** Low
**Risk:** Low

---

# PHASE 9: ESTIMATED COMPLETION

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 92% | Clean design, some duplicate retry logic |
| Database | 100% | All 22 models complete |
| Backend Services | 88% | All services exist, some need fixes |
| Backend APIs | 72% | Core CRUD works, missing 8 endpoints |
| Workers | 15% | Code exists but never starts |
| Scheduler | 5% | Code exists but never runs |
| Security | 95% | Enterprise-grade |
| AI Engine | 90% | Cost tracking placeholder |
| Pipeline | 85% | Engine works, no FULL_AUTOMATION definition |
| Publishing | 80% | publishStage duplicates PublishService |
| Admin UI | 5% | All 15 pages are stubs |
| Integration | 75% | Audit good, notifications missing |
| Testing | 0% | Zero test files |
| Monitoring | 20% | Basic health endpoint only |
| Production Readiness | 35% | Can't start, can't test, can't manage |
| **Overall Completion** | **52%** | Backend solid, operational layer missing |

---

# PHASE 10: NEXT IMPLEMENTATION PROMPT

Generate ONE comprehensive implementation prompt that ONLY covers the remaining work. This prompt should be detailed enough that another AI can execute the remaining implementation without needing another audit.

---

## NEXT IMPLEMENTATION PROMPT

You are implementing the remaining work for the SIKKHA AI Content Automation system. The system has 22 Prisma models, 33 backend services, 20 API routes, and a complete security layer — but workers never start, all 15 admin UI pages are stubs, and zero tests exist.

**DO NOT redesign anything. DO NOT rewrite existing code. Only implement what is missing.**

**Follow the existing codebase patterns exactly:**
- Singleton pattern for services: `export const serviceName = new ServiceName()`
- `withAdmin(request)` for auth, `withCsrf(request)` for mutations
- `validateBody(zodSchema, body)` for validation
- `auditFromRequest(request, userId, action, entityType, entityId, ...)` for audit
- `apiResponse(data)` / `apiError(message, status)` for responses
- `handleApiError(error, context)` for error handling
- `@/lib/logger` for logging
- `@/lib/db` for Prisma client
- `@/lib/errors` `safeTransaction` for transactions
- Bengali (Bangla) user-facing messages
- `use client` for admin page components
- TanStack Query for data fetching

---

### TASK 1: Worker Lifecycle Startup

Create `src/features/automation/workers/startup.ts`:

```typescript
import { workerManager } from './worker-manager'
import { QUEUES } from './worker-types'
import { importWorker } from './import-worker'
import { aiWorker } from './ai-worker'
import { publishWorker } from './publish-worker'
import { outboxWorker } from './outbox-worker'
import logger from '@/lib/logger'

let isStarted = false

export function startAutomationWorkers(): void {
  if (isStarted) return

  workerManager.register('import', QUEUES.IMPORT, importWorker.process, { pollIntervalMs: 10000 })
  workerManager.register('ai-rewrite', QUEUES.AI_REWRITE, aiWorker.processRewrite, { pollIntervalMs: 5000 })
  workerManager.register('ai-metadata', QUEUES.AI_METADATA, aiWorker.processMetadata, { pollIntervalMs: 5000 })
  workerManager.register('publish', QUEUES.PUBLISH, publishWorker.process, { pollIntervalMs: 10000 })
  workerManager.register('outbox', QUEUES.OUTBOX, outboxWorker.process, { pollIntervalMs: 5000 })

  workerManager.startAll()
  isStarted = true

  logger.info('Automation workers started', { count: workerManager.workerCount })
}
```

Modify `src/instrumentation.ts` to call `startAutomationWorkers()` after super admin seed. Add graceful shutdown on SIGTERM/SIGINT.

### TASK 2: FULL_AUTOMATION Pipeline Definition

Create `src/features/automation/pipeline/definitions.ts` with a `FULL_AUTOMATION_PIPELINE` definition that chains IMPORT → AI_REWRITE → AI_METADATA → REVIEW → PUBLISH with compensators from `STAGE_COMPENSATORS`.

### TASK 3: Wire Pipeline Execution

Modify `src/app/api/admin/automation/pipelines/route.ts` POST handler: after creating the PipelineRun record, build a `PipelineDefinition` and call `pipelineEngine.execute()` asynchronously (don't block the response).

### TASK 4: Missing CRUD Endpoints (8 files)

Create these files following the exact pattern of existing routes (e.g., `providers/[id]/route.ts`):
- `sources/[id]/route.ts` — GET, PUT, DELETE (with softDelete)
- `templates/[id]/route.ts` — GET, PUT, DELETE (with softDelete)
- `rules/route.ts` — GET, POST
- `rules/[id]/route.ts` — GET, PUT, DELETE (with softDelete)
- `review/[id]/route.ts` — PUT (approve/reject with status transition validation)
- `publish/schedule/[id]/route.ts` — DELETE (cancel)
- `dead-letter/route.ts` — GET (list), POST (retry)
- `pipelines/[id]/resume/route.ts` — POST (resume from checkpoint)
- `queue/route.ts` — GET (stats), POST (purge completed)

### TASK 5: Fix Cost Tracking

Modify `metadata-consolidator.ts`: replace `costUsd: 0` with real calculation using provider config's `costPer1kIn` and `costPer1kOut` multiplied by actual token usage.

### TASK 6: Fix Architectural Issues

1. Fix `transaction-types.ts` — Define `PrismaTxClient` using Prisma's `$transaction` return type instead of `any`
2. Fix `stage-executors.ts:280-340` — `publishStage` should use `PublishService.createDraft()` instead of direct `blogPost.create()`
3. Fix `import-worker.ts:130-137` — Replace weak hash with SHA-256
4. Fix `failure-recovery.ts:37-43` — Add a `checkpointData` JSON field to PipelineRun or use a dedicated approach

### TASK 7: Add Query Keys

Add to `src/lib/query-keys.ts`:
```typescript
automation: {
  all: ['automation'] as const,
  sources: () => [...automationKeys.all, 'sources'] as const,
  sourceDetail: (id: string) => [...automationKeys.sources(), id] as const,
  providers: () => [...automationKeys.all, 'providers'] as const,
  providerDetail: (id: string) => [...automationKeys.providers(), id] as const,
  templates: () => [...automationKeys.all, 'templates'] as const,
  pipelines: () => [...automationKeys.all, 'pipelines'] as const,
  pipelineDetail: (id: string) => [...automationKeys.pipelines(), id] as const,
  rules: () => [...automationKeys.all, 'rules'] as const,
  review: () => [...automationKeys.all, 'review'] as const,
  logs: () => [...automationKeys.all, 'logs'] as const,
  schedules: () => [...automationKeys.all, 'schedules'] as const,
  settings: () => [...automationKeys.all, 'settings'] as const,
  health: () => [...automationKeys.all, 'health'] as const,
  queue: () => [...automationKeys.all, 'queue'] as const,
  deadLetter: () => [...automationKeys.all, 'dead-letter'] as const,
}
```

### TASK 8: Implement All 15 Admin UI Pages

Each page must:
- Use `use client` directive
- Use TanStack Query hooks for data fetching
- Use existing shadcn/ui components from `src/components/ui/` (DataTable, Button, Dialog, Input, Select, Badge, Card, etc.)
- Follow the exact pattern of existing admin pages (e.g., `src/components/admin/` pages)
- Use Bengali labels for user-facing text
- Handle loading, error, and empty states
- Support pagination
- Include proper TypeScript types

**Implementation order:**
1. DashboardPage — Most value, shows system status
2. SourceListPage + SourceEditorPage — Content sources are the entry point
3. ProviderListPage + ProviderEditorPage — AI providers are core
4. TemplateListPage + TemplateEditorPage — Prompt templates
5. PipelineListPage + PipelineDetailPage — Pipeline visibility
6. RuleListPage + RuleEditorPage — Automation rules
7. ReviewListPage — Human review workflow
8. LogListPage — Activity log
9. ScheduleListPage — Publish schedules
10. AutomationSettingsPage — System configuration

**Create TanStack Query hooks** for each entity:
- `src/hooks/admin/use-automation-sources.ts`
- `src/hooks/admin/use-automation-providers.ts`
- `src/hooks/admin/use-automation-templates.ts`
- `src/hooks/admin/use-automation-pipelines.ts`
- `src/hooks/admin/use-automation-rules.ts`
- `src/hooks/admin/use-automation-review.ts`
- `src/hooks/admin/use-automation-logs.ts`
- `src/hooks/admin/use-automation-schedules.ts`
- `src/hooks/admin/use-automation-settings.ts`
- `src/hooks/admin/use-automation-dashboard.ts`
- `src/hooks/admin/use-automation-queue.ts`
- `src/hooks/admin/use-automation-dead-letter.ts`

### TASK 9: Test Suite

Create test files using Vitest (already configured in `vitest.config.ts`). All tests must use `describe/it/expect` from Vitest.

**Priority 1 — Security tests (most critical):**
- `prompt-guard.test.ts` — Test all 10 injection categories with known attack strings
- `ssrf-firewall.test.ts` — Test protocol, hostname, DNS, IP blocking, redirect
- `ssrf-client.test.ts` — Test redirect following, size limiting
- `prompt-sanitizer.test.ts` — Test zero-width char removal, delimiter wrapping
- `content-validator.test.ts` — Test magic bytes, polyglot detection
- `encryption-service.test.ts` — Test encrypt/decrypt roundtrip, key derivation

**Priority 2 — Engine tests:**
- `retry-strategy.test.ts` — Test backoff calculation, jitter, Prisma retry detection
- `dead-letter-service.test.ts` — Test send, retry, fail, list
- `inbox-consumer.test.ts` — Test idempotency (process once, skip duplicate)
- `ai-cache.test.ts` — Test set, get, TTL expiration

**Priority 3 — Integration tests:**
- `pipeline-engine.test.ts` — Mock DB, test execution flow, retry, compensation
- `provider-manager.test.ts` — Test fallback, health, rate limit
- `queue-service.test.ts` — Test enqueue, dequeue, idempotency

### TASK 10: Notification Integration

Modify `pipeline-events.ts` to trigger admin notifications on:
- `PIPELINE_FAILED` → notification to admins
- `REVIEW_REQUIRED` → notification to assigned reviewer
- Dead letter items → notification to admins

### TASK 11: Monitoring Enhancements

Enhance `health/route.ts` to include:
- Worker health status (from `workerManager.getHealth()`)
- Queue depth per queue name
- Pipeline success/failure rates (last 24h)
- AI provider latency

---

**Execution Rules:**
1. Run `npm run lint` after every file change — fix any lint errors
2. Run `npx tsc --noEmit` after every batch of changes — fix any type errors
3. Never create duplicate utilities — always import from existing
4. Never modify working code unless fixing a bug
5. All new API routes must have: `withAdmin`, `validateBody`, `withCsrf` (mutations), `auditFromRequest`
6. All new pages must have: loading state, error state, empty state
7. All tests must pass before marking as complete
8. Bengali text for all user-facing messages
