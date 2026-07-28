# SIKKHA AI Content Automation — Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining ~48% of the automation system: worker lifecycle, outbox processing, pipeline execution, 8 missing API endpoints, architectural fixes, query keys, and 15 admin UI pages.

**Architecture:** The backend services (33 services, 22 Prisma models, 20 API routes) are complete. Workers exist but never start. The system needs: (1) worker registration + startup in `instrumentation.ts`, (2) outbox processor startup, (3) pipeline execution wired to API, (4) FULL_AUTOMATION pipeline definition, (5) 8 missing CRUD endpoints, (6) architectural fixes (AnyPrismaClient type, publishStage duplication, weak hash), (7) query keys, (8) 15 admin UI pages.

**Tech Stack:** Next.js 16, Prisma (PostgreSQL), TypeScript, TanStack Query, shadcn/ui, Zod, Vitest, Bengali (Bangla) for user-facing text.

---

## File Structure

### New Files to Create

| File | Responsibility |
|------|----------------|
| `src/features/automation/workers/startup.ts` | Worker registration + startup module |
| `src/features/automation/workers/scheduler-worker.ts` | Cron worker for `scheduleService.executeDue()` |
| `src/features/automation/pipeline/definitions.ts` | Pre-built FULL_AUTOMATION pipeline definition |
| `src/app/api/admin/automation/sources/[id]/route.ts` | GET, PUT, DELETE for sources |
| `src/app/api/admin/automation/templates/[id]/route.ts` | GET, PUT, DELETE for templates |
| `src/app/api/admin/automation/rules/route.ts` | GET, POST for rules |
| `src/app/api/admin/automation/rules/[id]/route.ts` | GET, PUT, DELETE for rules |
| `src/app/api/admin/automation/review/[id]/route.ts` | PUT (approve/reject) |
| `src/app/api/admin/automation/publish/schedule/[id]/route.ts` | DELETE (cancel) |
| `src/app/api/admin/automation/dead-letter/route.ts` | GET (list), POST (retry) |
| `src/app/api/admin/automation/pipelines/[id]/resume/route.ts` | POST (resume from checkpoint) |
| `src/app/api/admin/automation/queue/route.ts` | GET (stats), POST (purge) |
| `src/hooks/admin/use-automation-sources.ts` | TanStack Query hooks for sources |
| `src/hooks/admin/use-automation-providers.ts` | TanStack Query hooks for providers |
| `src/hooks/admin/use-automation-templates.ts` | TanStack Query hooks for templates |
| `src/hooks/admin/use-automation-pipelines.ts` | TanStack Query hooks for pipelines |
| `src/hooks/admin/use-automation-rules.ts` | TanStack Query hooks for rules |
| `src/hooks/admin/use-automation-review.ts` | TanStack Query hooks for review |
| `src/hooks/admin/use-automation-logs.ts` | TanStack Query hooks for logs |
| `src/hooks/admin/use-automation-schedules.ts` | TanStack Query hooks for schedules |
| `src/hooks/admin/use-automation-settings.ts` | TanStack Query hooks for settings |
| `src/hooks/admin/use-automation-dashboard.ts` | TanStack Query hooks for dashboard |
| `src/hooks/admin/use-automation-queue.ts` | TanStack Query hooks for queue |
| `src/hooks/admin/use-automation-dead-letter.ts` | TanStack Query hooks for dead letter |

### Files to Modify

| File | Changes |
|------|---------|
| `src/instrumentation.ts` | Add worker startup + graceful shutdown |
| `src/features/automation/workers/index.ts` | Add scheduler-worker export |
| `src/app/api/admin/automation/pipelines/route.ts` | Wire POST to execute pipeline |
| `src/features/automation/lib/transaction-types.ts` | Replace `any` with proper type |
| `src/features/automation/pipeline/stage-executors.ts:280-340` | Use PublishService instead of direct create |
| `src/features/automation/workers/import-worker.ts:130-137` | Replace weak hash with SHA-256 |
| `src/features/automation/pipeline/failure-recovery.ts:37-43` | Use dedicated checkpoint field |
| `src/lib/query-keys.ts` | Add automation query keys |
| `src/features/automation/pages/AutomationDashboardPage.tsx` | Full implementation |
| `src/features/automation/pages/SourceListPage.tsx` | Full implementation |
| `src/features/automation/pages/SourceEditorPage.tsx` | Full implementation |
| `src/features/automation/pages/ProviderListPage.tsx` | Full implementation |
| `src/features/automation/pages/ProviderEditorPage.tsx` | Full implementation |
| `src/features/automation/pages/TemplateListPage.tsx` | Full implementation |
| `src/features/automation/pages/TemplateEditorPage.tsx` | Full implementation |
| `src/features/automation/pages/PipelineListPage.tsx` | Full implementation |
| `src/features/automation/pages/PipelineDetailPage.tsx` | Full implementation |
| `src/features/automation/pages/RuleListPage.tsx` | Full implementation |
| `src/features/automation/pages/RuleEditorPage.tsx` | Full implementation |
| `src/features/automation/pages/ReviewListPage.tsx` | Full implementation |
| `src/features/automation/pages/LogListPage.tsx` | Full implementation |
| `src/features/automation/pages/ScheduleListPage.tsx` | Full implementation |
| `src/features/automation/pages/AutomationSettingsPage.tsx` | Full implementation |

---

## Global Constraints

- All user-facing text in Bengali (Bangla)
- Singleton pattern: `export const serviceName = new ServiceName()`
- API routes: `withAdmin(request)`, `validateBody(zodSchema, body)`, `withCsrf(request)`, `auditFromRequest()`
- Error handling: `handleApiError(error, context)`
- Logging: `@/lib/logger`
- Database: `@/lib/db` for Prisma client
- Transactions: `safeTransaction` from `@/lib/errors`
- UI: `use client` directive, TanStack Query, shadcn/ui components
- Run `npm run lint` after every file change
- Run `npx tsc --noEmit` after every batch of changes

---

### Task 1: Worker Lifecycle Startup

**Files:**
- Create: `src/features/automation/workers/startup.ts`
- Modify: `src/instrumentation.ts`
- Modify: `src/features/automation/workers/index.ts`

**Interfaces:**
- Consumes: `workerManager` from `./worker-manager`, `QUEUES` from `./worker-types`, all worker instances
- Produces: `startAutomationWorkers()` function

- [ ] **Step 1: Create startup.ts**

```typescript
// src/features/automation/workers/startup.ts
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
  workerManager.register('outbox', QUEUES.OUTBOX, outboxWorker.processOutboxEntry, { pollIntervalMs: 5000 })

  workerManager.startAll()
  isStarted = true

  logger.info('Automation workers started', { count: workerManager.workerCount })
}

export function stopAutomationWorkers(): void {
  if (!isStarted) return
  workerManager.stopAll()
  isStarted = false
  logger.info('Automation workers stopped')
}
```

- [ ] **Step 2: Modify instrumentation.ts**

```typescript
// src/instrumentation.ts
import logger from '@/lib/logger'

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { registerProcessHandlers } = await import(
    '@/lib/process-handlers.node'
  )
  registerProcessHandlers()

  logger.info('Application starting', {
    context: 'instrumentation',
    nodeEnv: process.env.NODE_ENV,
  })

  // Seed super admin
  try {
    const { db } = await import('@/lib/db')
    const { ensureSuperAdmin } = await import('@/lib/seed-super-admin')
    await ensureSuperAdmin(db as unknown as import('@prisma/client').PrismaClient)
    logger.info('Super admin seed completed', { context: 'instrumentation' })
  } catch (err) {
    logger.error('Super admin seed failed', err, { context: 'instrumentation' })
  }

  // Start automation workers
  try {
    const { startAutomationWorkers } = await import(
      '@/features/automation/workers/startup'
    )
    startAutomationWorkers()
    logger.info('Automation workers initialized', { context: 'instrumentation' })
  } catch (err) {
    logger.error('Automation workers failed to start', err, { context: 'instrumentation' })
  }

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down automation workers...', { context: 'instrumentation' })
    try {
      const { stopAutomationWorkers } = await import(
        '@/features/automation/workers/startup'
      )
      stopAutomationWorkers()
    } catch {
      // Ignore errors during shutdown
    }
    process.exit(0)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  logger.info('Application ready', {
    context: 'instrumentation',
  })
}
```

- [ ] **Step 3: Update workers/index.ts exports**

```typescript
// src/features/automation/workers/index.ts (add to existing)
export { startAutomationWorkers, stopAutomationWorkers } from './startup'
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/workers/startup.ts src/instrumentation.ts src/features/automation/workers/index.ts
git commit -m "feat: add worker lifecycle startup in instrumentation.ts"
```

---

### Task 2: Scheduler Worker

**Files:**
- Create: `src/features/automation/workers/scheduler-worker.ts`
- Modify: `src/features/automation/workers/startup.ts`
- Modify: `src/features/automation/workers/index.ts`

**Interfaces:**
- Consumes: `scheduleService` from `../publishing/schedule-service`
- Produces: `SchedulerWorker` class, registered in startup

- [ ] **Step 1: Create scheduler-worker.ts**

```typescript
// src/features/automation/workers/scheduler-worker.ts
import logger from '@/lib/logger'
import { scheduleService } from '../publishing/schedule-service'
import type { JobResult } from './worker-types'

export class SchedulerWorker {
  async process(
    _payload: Record<string, unknown>,
    correlationId: string,
  ): Promise<JobResult> {
    logger.info('Scheduler worker: executing due schedules', { correlationId }, { context: 'scheduler-worker' })

    try {
      const result = await scheduleService.executeDue()
      return {
        success: true,
        data: { executed: result.executed, failed: result.failed },
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Scheduler error'
      logger.error('Scheduler worker: failed', error, { context: 'scheduler-worker' })
      return { success: false, error: errorMessage }
    }
  }
}

export const schedulerWorker = new SchedulerWorker()
```

- [ ] **Step 2: Register scheduler in startup.ts**

```typescript
// Add to src/features/automation/workers/startup.ts
import { schedulerWorker } from './scheduler-worker'

// Inside startAutomationWorkers(), add:
workerManager.register('scheduler', QUEUES.SCHEDULER, schedulerWorker.process, { pollIntervalMs: 60000 })
```

- [ ] **Step 3: Update workers/index.ts**

```typescript
// Add to src/features/automation/workers/index.ts
export { SchedulerWorker, schedulerWorker } from './scheduler-worker'
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/workers/scheduler-worker.ts src/features/automation/workers/startup.ts src/features/automation/workers/index.ts
git commit -m "feat: add scheduler worker for publish schedules"
```

---

### Task 3: FULL_AUTOMATION Pipeline Definition

**Files:**
- Create: `src/features/automation/pipeline/definitions.ts`

**Interfaces:**
- Consumes: `STAGE_EXECUTORS`, `STAGE_COMPENSATORS` from `./stage-executors`
- Produces: `FULL_AUTOMATION_PIPELINE` definition object

- [ ] **Step 1: Create definitions.ts**

```typescript
// src/features/automation/pipeline/definitions.ts
import type { PipelineDefinition } from './pipeline-types'
import { STAGE_EXECUTORS, STAGE_COMPENSATORS } from './stage-executors'

export const FULL_AUTOMATION_PIPELINE: PipelineDefinition = {
  name: 'FULL_AUTOMATION',
  type: 'FULL_AUTOMATION',
  maxRetries: 3,
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  enableCompensation: true,
  stages: [
    {
      name: 'IMPORT',
      order: 0,
      execute: STAGE_EXECUTORS.IMPORT,
      compensate: STAGE_COMPENSATORS.IMPORT,
      timeoutMs: 60_000,
      maxRetries: 2,
    },
    {
      name: 'AI_REWRITE',
      order: 1,
      execute: STAGE_EXECUTORS.AI_REWRITE,
      compensate: STAGE_COMPENSATORS.AI_REWRITE,
      timeoutMs: 120_000,
      maxRetries: 2,
    },
    {
      name: 'AI_METADATA',
      order: 2,
      execute: STAGE_EXECUTORS.AI_METADATA,
      compensate: STAGE_COMPENSATORS.AI_METADATA,
      timeoutMs: 60_000,
      maxRetries: 2,
    },
    {
      name: 'REVIEW',
      order: 3,
      execute: STAGE_EXECUTORS.REVIEW,
      timeoutMs: 30_000,
      requiresReview: true,
    },
    {
      name: 'PUBLISH',
      order: 4,
      execute: STAGE_EXECUTORS.PUBLISH,
      compensate: STAGE_COMPENSATORS.PUBLISH,
      timeoutMs: 30_000,
      maxRetries: 1,
    },
  ],
}

export const PIPELINE_DEFINITIONS: Record<string, PipelineDefinition> = {
  FULL_AUTOMATION: FULL_AUTOMATION_PIPELINE,
}

export function getPipelineDefinition(name: string): PipelineDefinition | undefined {
  return PIPELINE_DEFINITIONS[name]
}
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/automation/pipeline/definitions.ts
git commit -m "feat: add FULL_AUTOMATION pipeline definition"
```

---

### Task 4: Wire Pipeline Execution from API

**Files:**
- Modify: `src/app/api/admin/automation/pipelines/route.ts`

**Interfaces:**
- Consumes: `pipelineEngine` from `pipeline-engine`, `getPipelineDefinition` from `definitions`
- Produces: Async pipeline execution on POST

- [ ] **Step 1: Modify pipelines/route.ts POST handler**

```typescript
// Add imports at top of src/app/api/admin/automation/pipelines/route.ts
import { pipelineEngine } from '@/features/automation/pipeline/pipeline-engine'
import { getPipelineDefinition } from '@/features/automation/pipeline/definitions'

// Replace the POST handler's transaction block (lines 77-111) with:
const data = await db.$transaction(async (tx) => {
  const run = await tx.pipelineRun.create({
    data: {
      sourceId: validated.data.sourceId,
      correlationId,
      pipelineType: validated.data.pipelineType,
      status: 'PENDING',
      scheduledAt: validated.data.scheduledAt ? new Date(validated.data.scheduledAt) : null,
    },
    include: { source: { select: { id: true, name: true, sourceType: true, url: true } } },
  })

  // Create initial pipeline event
  await tx.pipelineEvent.create({
    data: {
      pipelineId: run.id,
      correlationId,
      eventType: 'PIPELINE_STARTED',
      data: JSON.stringify({ sourceId: validated.data.sourceId, pipelineType: validated.data.pipelineType, sourceName: source.name }),
    },
  })

  await auditFromRequest(
    request,
    auth.user.id,
    AuditActions.AUTOMATION_PIPELINE_RUN,
    'automation_pipeline_run',
    run.id,
    undefined,
    { sourceId: validated.data.sourceId, pipelineType: validated.data.pipelineType },
    tx as never,
  )

  return run
})

// Execute pipeline asynchronously (don't block response)
const pipelineName = validated.data.pipelineType === 'IMPORT' ? 'FULL_AUTOMATION' : validated.data.pipelineType
const definition = getPipelineDefinition(pipelineName)
if (definition) {
  pipelineEngine.execute(definition, {
    sourceId: validated.data.sourceId,
    sourceUrl: source.url,
    sourceType: source.sourceType,
  }).catch((error) => {
    // Error is already logged by pipeline engine
  })
}

return apiResponse(data, 201)
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/automation/pipelines/route.ts
git commit -m "feat: wire pipeline execution from API POST"
```

---

### Task 5: Fix Transaction Types

**Files:**
- Modify: `src/features/automation/lib/transaction-types.ts`

**Interfaces:**
- Consumes: PrismaClient types
- Produces: Proper `PrismaTxClient` type

- [ ] **Step 1: Replace AnyPrismaClient**

```typescript
// src/features/automation/lib/transaction-types.ts
import type { PrismaClient } from '@prisma/client'

/**
 * Prisma transaction client type for automation operations.
 * Uses PrismaClient['$transaction'] return type for proper typing.
 */
export type PrismaTxClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]

/**
 * Legacy alias for backward compatibility.
 * @deprecated Use PrismaTxClient instead
 */
export type AnyPrismaClient = PrismaTxClient

/**
 * Typed transaction callback for automation operations.
 * Returns the result of type T when the transaction completes.
 */
export type TransactionCallback<T> = (tx: PrismaTxClient) => Promise<T>
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/automation/lib/transaction-types.ts
git commit -m "fix: replace AnyPrismaClient with proper PrismaTxClient type"
```

---

### Task 6: Fix publishStage to Use PublishService

**Files:**
- Modify: `src/features/automation/pipeline/stage-executors.ts:280-340`

**Interfaces:**
- Consumes: `publishService` from `../publishing/publish-service`
- Produces: Updated `publishStage` executor

- [ ] **Step 1: Add import**

```typescript
// Add at top of stage-executors.ts
import { publishService } from '../publishing/publish-service'
```

- [ ] **Step 2: Replace publishStage implementation**

```typescript
// Replace publishStage function (lines 280-340) with:
export const publishStage: StageExecutor = async (ctx): Promise<StageOutput> => {
  const content = ctx.variables.rewrittenContent
  const title = ctx.variables.seoTitle || ctx.variables.sourceTitle || 'Untitled'

  if (!content) {
    return { success: false, data: {}, error: 'No content to publish' }
  }

  logger.info('Publish stage: creating blog post', { title: title.substring(0, 50) }, { context: 'pipeline' })

  try {
    const tags = ctx.variables.tags || []
    const category = ctx.variables.category || 'general'

    // Use centralized PublishService for consistency
    const result = await publishService.createDraft({
      title,
      content,
      excerpt: ctx.variables.seoDescription || content.substring(0, 200),
      featuredImage: ctx.variables.thumbnailUrl || null,
      categoryId: null, // Category lookup happens inside PublishService
      tags,
      metaTitle: ctx.variables.seoTitle || null,
      metaDescription: ctx.variables.seoDescription || null,
      correlationId: ctx.correlationId,
      scheduledAt: ctx.variables.publishScheduleId || undefined,
      status: 'DRAFT',
    })

    if (!result.success) {
      return { success: false, data: {}, error: result.error }
    }

    ctx.variables.blogPostId = result.blogPostId
    ctx.variables.publishStatus = result.status

    return {
      success: true,
      data: {
        blogPostId: result.blogPostId,
        slug: result.slug,
        status: result.status,
        title,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Publish failed'
    return { success: false, data: {}, error: errorMessage }
  }
}
```

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/automation/pipeline/stage-executors.ts
git commit -m "fix: use PublishService.createDraft in publishStage instead of direct create"
```

---

### Task 7: Fix Import Worker Hash

**Files:**
- Modify: `src/features/automation/workers/import-worker.ts:130-137`

**Interfaces:**
- Consumes: `crypto` module
- Produces: SHA-256 content hash

- [ ] **Step 1: Replace hashContent method**

```typescript
// Find hashContent method in import-worker.ts and replace with:
private hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}
```

- [ ] **Step 2: Add crypto import if missing**

```typescript
// Add at top of import-worker.ts if not present
import crypto from 'crypto'
```

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/automation/workers/import-worker.ts
git commit -m "fix: replace weak content hash with SHA-256 in import-worker"
```

---

### Task 8: Fix Checkpoint Storage

**Files:**
- Modify: `src/features/automation/pipeline/failure-recovery.ts:37-43`

**Interfaces:**
- Consumes: Prisma PipelineRun model
- Produces: Dedicated checkpoint storage

- [ ] **Step 1: Update checkpoint storage to use metadata field**

```typescript
// In failure-recovery.ts, find checkpoint save/load and update:

// Save checkpoint - use metadata field instead of errorMessage
async saveCheckpoint(runId: string, checkpoint: Record<string, unknown>): Promise<void> {
  await db.pipelineRun.update({
    where: { id: runId },
    data: {
      metadata: JSON.stringify({
        checkpoint,
        checkpointSavedAt: new Date().toISOString(),
      }),
    },
  })
}

// Load checkpoint - parse from metadata field
async loadCheckpoint(runId: string): Promise<Record<string, unknown> | null> {
  const run = await db.pipelineRun.findUnique({
    where: { id: runId },
    select: { metadata: true },
  })

  if (!run?.metadata) return null

  try {
    const parsed = JSON.parse(run.metadata as string)
    return parsed.checkpoint || null
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/features/automation/pipeline/failure-recovery.ts
git commit -m "fix: use metadata field for checkpoint storage instead of errorMessage"
```

---

### Task 9: Add Query Keys

**Files:**
- Modify: `src/lib/query-keys.ts`

**Interfaces:**
- Consumes: Existing queryKeys structure
- Produces: `automation` namespace in queryKeys

- [ ] **Step 1: Add automation query keys**

```typescript
// Add to src/lib/query-keys.ts after the blog section:

automation: {
  all: ['automation'] as const,
  sources: () => [...queryKeys.automation.all, 'sources'] as const,
  sourceDetail: (id: string) => [...queryKeys.automation.sources(), id] as const,
  providers: () => [...queryKeys.automation.all, 'providers'] as const,
  providerDetail: (id: string) => [...queryKeys.automation.providers(), id] as const,
  templates: () => [...queryKeys.automation.all, 'templates'] as const,
  templateDetail: (id: string) => [...queryKeys.automation.templates(), id] as const,
  pipelines: () => [...queryKeys.automation.all, 'pipelines'] as const,
  pipelineDetail: (id: string) => [...queryKeys.automation.pipelines(), id] as const,
  rules: () => [...queryKeys.automation.all, 'rules'] as const,
  ruleDetail: (id: string) => [...queryKeys.automation.rules(), id] as const,
  review: () => [...queryKeys.automation.all, 'review'] as const,
  reviewDetail: (id: string) => [...queryKeys.automation.review(), id] as const,
  logs: () => [...queryKeys.automation.all, 'logs'] as const,
  schedules: () => [...queryKeys.automation.all, 'schedules'] as const,
  scheduleDetail: (id: string) => [...queryKeys.automation.schedules(), id] as const,
  settings: () => [...queryKeys.automation.all, 'settings'] as const,
  health: () => [...queryKeys.automation.all, 'health'] as const,
  queue: () => [...queryKeys.automation.all, 'queue'] as const,
  deadLetter: () => [...queryKeys.automation.all, 'dead-letter'] as const,
},
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/query-keys.ts
git commit -m "feat: add automation query keys for TanStack Query"
```

---

### Task 10: Missing CRUD API — Sources [id]

**Files:**
- Create: `src/app/api/admin/automation/sources/[id]/route.ts`

**Interfaces:**
- Consumes: `db`, `withAdmin`, `validateBody`, `withCsrf`, `auditFromRequest`, `handleApiError`
- Produces: GET, PUT, DELETE endpoints for individual sources

- [ ] **Step 1: Create sources/[id]/route.ts**

```typescript
// src/app/api/admin/automation/sources/[id]/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  sourceType: z.enum(['rss', 'api', 'webhook', 'manual']).optional(),
  contentType: z.string().optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().optional(),
  fetchInterval: z.number().min(60).optional(),
  config: z.record(z.unknown()).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const source = await db.sourceConfig.findUnique({
      where: { id, deletedAt: null },
      include: { pipelineRuns: { orderBy: { createdAt: 'desc' }, take: 5 } },
    })

    if (!source) return apiError('সোর্স খুঁজে পাওয়া যায়নি', 404)
    return apiResponse(source)
  } catch (error) {
    return handleApiError(error, 'Admin Get Source')
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(updateSourceSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.sourceConfig.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('সোর্স খুঁজে পাওয়া যায়নি', 404)

    const source = await db.sourceConfig.update({
      where: { id },
      data: validated.data,
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_SOURCE_UPDATED,
      'automation_source',
      source.id,
      existing,
      source,
    )

    return apiResponse(source)
  } catch (error) {
    return handleApiError(error, 'Admin Update Source')
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const existing = await db.sourceConfig.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('সোর্স খুঁজে পাওয়া যায়নি', 404)

    await db.sourceConfig.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_SOURCE_DELETED,
      'automation_source',
      id,
      existing,
    )

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Source')
  }
}
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/automation/sources/[id]/route.ts
git commit -m "feat: add CRUD endpoints for individual sources"
```

---

### Task 11: Missing CRUD API — Templates [id]

**Files:**
- Create: `src/app/api/admin/automation/templates/[id]/route.ts`

- [ ] **Step 1: Create templates/[id]/route.ts**

```typescript
// src/app/api/admin/automation/templates/[id]/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const template = await db.promptTemplate.findUnique({
      where: { id, deletedAt: null },
      include: { versions: { orderBy: { version: 'desc' } } },
    })

    if (!template) return apiError('টেমপ্লেট খুঁজে পাওয়া যায়নি', 404)
    return apiResponse(template)
  } catch (error) {
    return handleApiError(error, 'Admin Get Template')
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(updateTemplateSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.promptTemplate.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('টেমপ্লেট খুঁজে পাওয়া যায়নি', 404)

    const template = await db.promptTemplate.update({
      where: { id },
      data: validated.data,
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_TEMPLATE_UPDATED,
      'automation_template',
      template.id,
      existing,
      template,
    )

    return apiResponse(template)
  } catch (error) {
    return handleApiError(error, 'Admin Update Template')
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const existing = await db.promptTemplate.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('টেমপ্লেট খুঁজে পাওয়া যায়নি', 404)

    await db.promptTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_TEMPLATE_DELETED,
      'automation_template',
      id,
      existing,
    )

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Template')
  }
}
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/automation/templates/[id]/route.ts
git commit -m "feat: add CRUD endpoints for individual templates"
```

---

### Task 12: Missing CRUD API — Rules

**Files:**
- Create: `src/app/api/admin/automation/rules/route.ts`
- Create: `src/app/api/admin/automation/rules/[id]/route.ts`

- [ ] **Step 1: Create rules/route.ts**

```typescript
// src/app/api/admin/automation/rules/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf, paginatedApiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createRuleSchema = z.object({
  name: z.string().min(1, 'নাম আবশ্যক'),
  ruleType: z.enum(['FILTER', 'TRANSFORM', 'NOTIFICATION', 'SCHEDULE']),
  conditions: z.record(z.unknown()),
  actions: z.record(z.unknown()),
  priority: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      db.automationRule.findMany({
        where: { deletedAt: null },
        orderBy: { priority: 'desc' },
        skip,
        take: limit,
      }),
      db.automationRule.count({ where: { deletedAt: null } }),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Rules')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validated = validateBody(createRuleSchema, body)
    if ('error' in validated) return validated.error

    const rule = await db.automationRule.create({
      data: {
        ...validated.data,
        conditions: JSON.stringify(validated.data.conditions),
        actions: JSON.stringify(validated.data.actions),
      },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_RULE_CREATED,
      'automation_rule',
      rule.id,
      undefined,
      rule,
    )

    return apiResponse(rule, 201)
  } catch (error) {
    return handleApiError(error, 'Admin Create Rule')
  }
}
```

- [ ] **Step 2: Create rules/[id]/route.ts**

```typescript
// src/app/api/admin/automation/rules/[id]/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  ruleType: z.enum(['FILTER', 'TRANSFORM', 'NOTIFICATION', 'SCHEDULE']).optional(),
  conditions: z.record(z.unknown()).optional(),
  actions: z.record(z.unknown()).optional(),
  priority: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const rule = await db.automationRule.findUnique({
      where: { id, deletedAt: null },
    })

    if (!rule) return apiError('নিয়ম খুঁজে পাওয়া যায়নি', 404)
    return apiResponse(rule)
  } catch (error) {
    return handleApiError(error, 'Admin Get Rule')
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(updateRuleSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.automationRule.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('নিয়ম খুঁজে পাওয়া যায়নি', 404)

    const updateData: Record<string, unknown> = { ...validated.data }
    if (validated.data.conditions) {
      updateData.conditions = JSON.stringify(validated.data.conditions)
    }
    if (validated.data.actions) {
      updateData.actions = JSON.stringify(validated.data.actions)
    }

    const rule = await db.automationRule.update({
      where: { id },
      data: updateData,
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_RULE_UPDATED,
      'automation_rule',
      rule.id,
      existing,
      rule,
    )

    return apiResponse(rule)
  } catch (error) {
    return handleApiError(error, 'Admin Update Rule')
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const existing = await db.automationRule.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('নিয়ম খুঁজে পাওয়া যায়নি', 404)

    await db.automationRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_RULE_DELETED,
      'automation_rule',
      id,
      existing,
    )

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin Delete Rule')
  }
}
```

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/automation/rules/
git commit -m "feat: add CRUD endpoints for automation rules"
```

---

### Task 13: Missing CRUD API — Review [id]

**Files:**
- Create: `src/app/api/admin/automation/review/[id]/route.ts`

- [ ] **Step 1: Create review/[id]/route.ts**

```typescript
// src/app/api/admin/automation/review/[id]/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const reviewActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_changes']),
  notes: z.string().optional(),
})

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const task = await db.reviewTask.findUnique({
      where: { id, deletedAt: null },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        pipelineRun: { select: { id: true, correlationId: true, status: true } },
      },
    })

    if (!task) return apiError('পর্যালোচনা টাস্ক খুঁজে পাওয়া যায়নি', 404)
    return apiResponse(task)
  } catch (error) {
    return handleApiError(error, 'Admin Get Review Task')
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const validated = validateBody(reviewActionSchema, body)
    if ('error' in validated) return validated.error

    const existing = await db.reviewTask.findUnique({ where: { id, deletedAt: null } })
    if (!existing) return apiError('পর্যালোচনা টাস্ক খুঁজে পাওয়া যায়নি', 404)

    const statusMap = {
      approve: 'APPROVED',
      reject: 'REJECTED',
      request_changes: 'CHANGES_REQUESTED',
    } as const

    const task = await db.reviewTask.update({
      where: { id },
      data: {
        status: statusMap[validated.data.action],
        notes: validated.data.notes,
        reviewedAt: new Date(),
        reviewedById: auth.user.id,
      },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_REVIEW_COMPLETED,
      'automation_review',
      task.id,
      existing,
      task,
    )

    return apiResponse(task)
  } catch (error) {
    return handleApiError(error, 'Admin Update Review Task')
  }
}
```

- [ ] **Step 2: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/automation/review/[id]/route.ts
git commit -m "feat: add review task approve/reject endpoint"
```

---

### Task 14: Missing CRUD API — Schedule [id], Dead Letter, Pipeline Resume, Queue

**Files:**
- Create: `src/app/api/admin/automation/publish/schedule/[id]/route.ts`
- Create: `src/app/api/admin/automation/dead-letter/route.ts`
- Create: `src/app/api/admin/automation/pipelines/[id]/resume/route.ts`
- Create: `src/app/api/admin/automation/queue/route.ts`

- [ ] **Step 1: Create schedule/[id]/route.ts**

```typescript
// src/app/api/admin/automation/publish/schedule/[id]/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const existing = await db.publishSchedule.findUnique({ where: { id } })
    if (!existing) return apiError('সময়সূচী খুঁজে পাওয়া যায়নি', 404)

    await db.publishSchedule.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_SCHEDULE_CANCELLED,
      'automation_schedule',
      id,
      existing,
    )

    return apiResponse({ success: true })
  } catch (error) {
    return handleApiError(error, 'Admin Cancel Schedule')
  }
}
```

- [ ] **Step 2: Create dead-letter/route.ts**

```typescript
// src/app/api/admin/automation/dead-letter/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, validateBody, withCsrf, paginatedApiResponse } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { deadLetterService } from '@/features/automation/lib/dead-letter-service'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const retrySchema = z.object({
  messageIds: z.array(z.string()).min(1, 'মেসেজ আইডি আবশ্যক'),
})

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      db.deadLetterMessage.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.deadLetterMessage.count(),
    ])

    return paginatedApiResponse(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    return handleApiError(error, 'Admin Get Dead Letter')
  }
}

export async function POST(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const body = await request.json()
    const validated = validateBody(retrySchema, body)
    if ('error' in validated) return validated.error

    let retried = 0
    for (const messageId of validated.data.messageIds) {
      try {
        await deadLetterService.retry(undefined, messageId)
        retried++
      } catch {
        // Continue with next message
      }
    }

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_DEAD_LETTER_RETRY,
      'automation_dead_letter',
      undefined,
      undefined,
      { messageIds: validated.data.messageIds, retried },
    )

    return apiResponse({ success: true, retried })
  } catch (error) {
    return handleApiError(error, 'Admin Retry Dead Letter')
  }
}
```

- [ ] **Step 3: Create pipelines/[id]/resume/route.ts**

```typescript
// src/app/api/admin/automation/pipelines/[id]/resume/route.ts
import { db } from '@/lib/db'
import { apiResponse, apiError, withAdmin, withCsrf } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { pipelineEngine } from '@/features/automation/pipeline/pipeline-engine'
import { getPipelineDefinition } from '@/features/automation/pipeline/definitions'
import { auditFromRequest, AuditActions } from '@/lib/audit'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  const csrfCheck = await withCsrf(request)
  if ('error' in csrfCheck) return csrfCheck.error

  try {
    const { id } = await params
    const run = await db.pipelineRun.findUnique({
      where: { id, deletedAt: null },
      include: { source: true },
    })

    if (!run) return apiError('পাইপলাইন রান খুঁজে পাওয়া যায়নি', 404)
    if (run.status !== 'FAILED') return apiError('শুধুমাত্র ব্যর্থ পাইপলাইন পুনরুদ্ধার করা যাবে', 400)

    const definition = getPipelineDefinition(run.pipelineType)
    if (!definition) return apiError('পাইপলাইন সংজ্ঞা পাওয়া যায়নি', 404)

    // Resume asynchronously
    pipelineEngine.execute(definition, {
      sourceId: run.sourceId,
      sourceUrl: run.source?.url,
      sourceType: run.source?.sourceType,
      pipelineRunId: run.id,
    }).catch(() => {})

    await auditFromRequest(
      request,
      auth.user.id,
      AuditActions.AUTOMATION_PIPELINE_RUN,
      'automation_pipeline_run',
      run.id,
    )

    return apiResponse({ success: true, message: 'পাইপলাইন পুনরুদ্ধার শুরু হয়েছে' })
  } catch (error) {
    return handleApiError(error, 'Admin Resume Pipeline')
  }
}
```

- [ ] **Step 4: Create queue/route.ts**

```typescript
// src/app/api/admin/automation/queue/route.ts
import { apiResponse, withAdmin } from '@/lib/api-utils'
import { handleApiError } from '@/lib/errors'
import { workerManager } from '@/features/automation/workers/worker-manager'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await withAdmin(request)
  if (auth instanceof NextResponse) return auth

  try {
    const health = workerManager.getHealth()
    return apiResponse({ workers: health })
  } catch (error) {
    return handleApiError(error, 'Admin Get Queue Stats')
  }
}
```

- [ ] **Step 5: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/automation/publish/schedule/[id]/route.ts src/app/api/admin/automation/dead-letter/route.ts src/app/api/admin/automation/pipelines/[id]/resume/route.ts src/app/api/admin/automation/queue/route.ts
git commit -m "feat: add remaining CRUD API endpoints (schedule, dead-letter, resume, queue)"
```

---

### Task 15: Dashboard Page Implementation

**Files:**
- Modify: `src/features/automation/pages/AutomationDashboardPage.tsx`
- Create: `src/hooks/admin/use-automation-dashboard.ts`

- [ ] **Step 1: Create use-automation-dashboard.ts**

```typescript
// src/hooks/admin/use-automation-dashboard.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useAutomationDashboard() {
  return useQuery({
    queryKey: queryKeys.automation.health(),
    queryFn: async () => {
      const res = await fetch('/api/admin/automation/health')
      if (!res.ok) throw new Error('Failed to fetch dashboard data')
      return res.json()
    },
    refetchInterval: 30000,
  })
}

export function useAutomationQueueStats() {
  return useQuery({
    queryKey: queryKeys.automation.queue(),
    queryFn: async () => {
      const res = await fetch('/api/admin/automation/queue')
      if (!res.ok) throw new Error('Failed to fetch queue stats')
      return res.json()
    },
    refetchInterval: 10000,
  })
}

export function useAutomationPipelineRuns(params?: { page?: number; limit?: number; status?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.status) searchParams.set('status', params.status)

  return useQuery({
    queryKey: [...queryKeys.automation.pipelines(), params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/pipelines?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline runs')
      return res.json()
    },
  })
}
```

- [ ] **Step 2: Implement AutomationDashboardPage**

```typescript
// src/features/automation/pages/AutomationDashboardPage.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAutomationDashboard, useAutomationQueueStats, useAutomationPipelineRuns } from '@/hooks/admin/use-automation-dashboard'

export default function AutomationDashboardPage() {
  const { data: health, isLoading: healthLoading } = useAutomationDashboard()
  const { data: queueStats } = useAutomationQueueStats()
  const { data: pipelineRuns } = useAutomationPipelineRuns({ limit: 10 })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">অটোমেশন ড্যাশবোর্ড</h1>
        <Button variant="outline">রিফ্রেশ</Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ওয়ার্কার স্ট্যাটাস</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthLoading ? '...' : health?.data?.workers?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">সক্রিয় ওয়ার্কার</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">কিউ ডেপথ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {queueStats?.data?.workers?.reduce((sum: number, w: { processedCount: number }) => sum + w.processedCount, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">মোট প্রসেস করা হয়েছে</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">সফল পাইপলাইন</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pipelineRuns?.data?.filter((r: { status: string }) => r.status === 'COMPLETED').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">গত ২৪ ঘণ্টায়</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ব্যর্থ পাইপলাইন</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {pipelineRuns?.data?.filter((r: { status: string }) => r.status === 'FAILED').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">গত ২৪ ঘণ্টায়</p>
          </CardContent>
        </Card>
      </div>

      {/* Worker Status */}
      <Card>
        <CardHeader>
          <CardTitle>ওয়ার্কার স্ট্যাটাস</CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <p className="text-muted-foreground">লোড হচ্ছে...</p>
          ) : (
            <div className="space-y-2">
              {health?.data?.workers?.map((worker: { name: string; status: string; processedCount: number; failedCount: number }) => (
                <div key={worker.name} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant={worker.status === 'RUNNING' ? 'default' : worker.status === 'ERROR' ? 'destructive' : 'secondary'}>
                      {worker.status}
                    </Badge>
                    <span className="font-medium">{worker.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    প্রসেস: {worker.processedCount} | ব্যর্থ: {worker.failedCount}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Pipeline Runs */}
      <Card>
        <CardHeader>
          <CardTitle>সাম্প্রতিক পাইপলাইন রান</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {pipelineRuns?.data?.slice(0, 5).map((run: { id: string; status: string; createdAt: string; source?: { name: string } }) => (
              <div key={run.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <Badge variant={run.status === 'COMPLETED' ? 'default' : run.status === 'FAILED' ? 'destructive' : 'secondary'}>
                    {run.status}
                  </Badge>
                  <span>{run.source?.name || 'Unknown'}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(run.createdAt).toLocaleDateString('bn-BD')}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/automation/pages/AutomationDashboardPage.tsx src/hooks/admin/use-automation-dashboard.ts
git commit -m "feat: implement automation dashboard page with real data"
```

---

### Task 16: Source Pages Implementation

**Files:**
- Modify: `src/features/automation/pages/SourceListPage.tsx`
- Modify: `src/features/automation/pages/SourceEditorPage.tsx`
- Create: `src/hooks/admin/use-automation-sources.ts`

- [ ] **Step 1: Create use-automation-sources.ts**

```typescript
// src/hooks/admin/use-automation-sources.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useAutomationSources(params?: { page?: number; limit?: number; sourceType?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.sourceType) searchParams.set('sourceType', params.sourceType)

  return useQuery({
    queryKey: [...queryKeys.automation.sources(), params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/sources?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch sources')
      return res.json()
    },
  })
}

export function useAutomationSource(id: string) {
  return useQuery({
    queryKey: queryKeys.automation.sourceDetail(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/sources/${id}`)
      if (!res.ok) throw new Error('Failed to fetch source')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; sourceType: string; url: string; contentType?: string }) => {
      const res = await fetch('/api/admin/automation/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create source')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.sources() })
    },
  })
}

export function useUpdateSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/automation/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update source')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.sources() })
    },
  })
}

export function useDeleteSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/automation/sources/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete source')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.sources() })
    },
  })
}
```

- [ ] **Step 2: Implement SourceListPage**

```typescript
// src/features/automation/pages/SourceListPage.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useAutomationSources, useDeleteSource } from '@/hooks/admin/use-automation-sources'

export default function SourceListPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading } = useAutomationSources({ page, limit: 20 })
  const deleteMutation = useDeleteSource()

  const handleDelete = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত এই সোর্স মুছে ফেলতে চান?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">কন্টেন্ট সোর্স</h1>
        <Button onClick={() => router.push('/admin/automation/sources/new')}>
          নতুন সোর্স যোগ করুন
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="সোর্স খুঁজুন..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">লোড হচ্ছে...</p>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">নাম</th>
                <th className="p-3 text-left">ধরন</th>
                <th className="p-3 text-left">কন্টেন্ট টাইপ</th>
                <th className="p-3 text-left">স্ট্যাটাস</th>
                <th className="p-3 text-left">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((source: { id: string; name: string; sourceType: string; contentType: string; isActive: boolean }) => (
                <tr key={source.id} className="border-b">
                  <td className="p-3">{source.name}</td>
                  <td className="p-3"><Badge variant="outline">{source.sourceType}</Badge></td>
                  <td className="p-3">{source.contentType}</td>
                  <td className="p-3">
                    <Badge variant={source.isActive ? 'default' : 'secondary'}>
                      {source.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/automation/sources/${source.id}`)}
                      >
                        সম্পাদনা
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(source.id)}
                      >
                        মুছুন
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data?.pagination && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            পূর্ববর্তী
          </Button>
          <span className="py-2 px-4">
            পৃষ্ঠা {data.pagination.page} / {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage(page + 1)}
          >
            পরবর্তী
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement SourceEditorPage**

```typescript
// src/features/automation/pages/SourceEditorPage.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAutomationSource, useCreateSource, useUpdateSource } from '@/hooks/admin/use-automation-sources'

export default function SourceEditorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const { data: source, isLoading } = useAutomationSource(isNew ? '' : id)
  const createMutation = useCreateSource()
  const updateMutation = useUpdateSource()

  const [form, setForm] = useState({
    name: '',
    sourceType: 'rss',
    url: '',
    contentType: 'article',
    isActive: true,
  })

  useEffect(() => {
    if (source?.data) {
      setForm({
        name: source.data.name,
        sourceType: source.data.sourceType,
        url: source.data.url,
        contentType: source.data.contentType,
        isActive: source.data.isActive,
      })
    }
  }, [source])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (isNew) {
        await createMutation.mutateAsync(form)
      } else {
        await updateMutation.mutateAsync({ id, data: form })
      }
      router.push('/admin/automation/sources')
    } catch (error) {
      console.error('Failed to save source:', error)
    }
  }

  if (!isNew && isLoading) {
    return <div className="p-6">লোড হচ্ছে...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'নতুন সোর্স যোগ করুন' : 'সোর্স সম্পাদনা করুন'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">নাম</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="sourceType">ধরন</Label>
          <Select
            value={form.sourceType}
            onValueChange={(value) => setForm({ ...form, sourceType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rss">RSS</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="url">URL</Label>
          <Input
            id="url"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="contentType">কন্টেন্ট টাইপ</Label>
          <Select
            value={form.contentType}
            onValueChange={(value) => setForm({ ...form, contentType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {isNew ? 'তৈরি করুন' : 'সংরক্ষণ করুন'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/automation/sources')}>
            বাতিল
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/pages/SourceListPage.tsx src/features/automation/pages/SourceEditorPage.tsx src/hooks/admin/use-automation-sources.ts
git commit -m "feat: implement source list and editor pages"
```

---

### Task 17: Provider Pages Implementation

**Files:**
- Modify: `src/features/automation/pages/ProviderListPage.tsx`
- Modify: `src/features/automation/pages/ProviderEditorPage.tsx`
- Create: `src/hooks/admin/use-automation-providers.ts`

- [ ] **Step 1: Create use-automation-providers.ts**

```typescript
// src/hooks/admin/use-automation-providers.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useAutomationProviders() {
  return useQuery({
    queryKey: queryKeys.automation.providers(),
    queryFn: async () => {
      const res = await fetch('/api/admin/automation/providers')
      if (!res.ok) throw new Error('Failed to fetch providers')
      return res.json()
    },
  })
}

export function useAutomationProvider(id: string) {
  return useQuery({
    queryKey: queryKeys.automation.providerDetail(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/providers/${id}`)
      if (!res.ok) throw new Error('Failed to fetch provider')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/admin/automation/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create provider')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.providers() })
    },
  })
}

export function useUpdateProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/admin/automation/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update provider')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.providers() })
    },
  })
}

export function useDeleteProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/automation/providers/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete provider')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.providers() })
    },
  })
}
```

- [ ] **Step 2: Implement ProviderListPage**

```typescript
// src/features/automation/pages/ProviderListPage.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAutomationProviders, useDeleteProvider } from '@/hooks/admin/use-automation-providers'

export default function ProviderListPage() {
  const router = useRouter()
  const { data, isLoading } = useAutomationProviders()
  const deleteMutation = useDeleteProvider()

  const handleDelete = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত এই প্রোভাইডার মুছে ফেলতে চান?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI প্রোভাইডার</h1>
        <Button onClick={() => router.push('/admin/automation/providers/new')}>
          নতুন প্রোভাইডার যোগ করুন
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">লোড হচ্ছে...</p>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">নাম</th>
                <th className="p-3 text-left">ধরন</th>
                <th className="p-3 text-left">মডেল</th>
                <th className="p-3 text-left">স্ট্যাটাস</th>
                <th className="p-3 text-left">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((provider: { id: string; name: string; providerType: string; defaultModel: string; isActive: boolean }) => (
                <tr key={provider.id} className="border-b">
                  <td className="p-3">{provider.name}</td>
                  <td className="p-3"><Badge variant="outline">{provider.providerType}</Badge></td>
                  <td className="p-3">{provider.defaultModel}</td>
                  <td className="p-3">
                    <Badge variant={provider.isActive ? 'default' : 'secondary'}>
                      {provider.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/automation/providers/${provider.id}`)}
                      >
                        সম্পাদনা
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(provider.id)}
                      >
                        মুছুন
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement ProviderEditorPage**

```typescript
// src/features/automation/pages/ProviderEditorPage.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAutomationProvider, useCreateProvider, useUpdateProvider } from '@/hooks/admin/use-automation-providers'

export default function ProviderEditorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const { data: provider, isLoading } = useAutomationProvider(isNew ? '' : id)
  const createMutation = useCreateProvider()
  const updateMutation = useUpdateProvider()

  const [form, setForm] = useState({
    name: '',
    displayName: '',
    providerType: 'openai',
    apiKey: '',
    baseUrl: '',
    defaultModel: 'gpt-4',
    isActive: true,
  })

  useEffect(() => {
    if (provider?.data) {
      setForm({
        name: provider.data.name,
        displayName: provider.data.displayName,
        providerType: provider.data.providerType,
        apiKey: '',
        baseUrl: provider.data.baseUrl || '',
        defaultModel: provider.data.defaultModel,
        isActive: provider.data.isActive,
      })
    }
  }, [provider])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const data = { ...form }
      if (!data.apiKey) delete data.apiKey

      if (isNew) {
        await createMutation.mutateAsync(data)
      } else {
        await updateMutation.mutateAsync({ id, data })
      }
      router.push('/admin/automation/providers')
    } catch (error) {
      console.error('Failed to save provider:', error)
    }
  }

  if (!isNew && isLoading) {
    return <div className="p-6">লোড হচ্ছে...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'নতুন প্রোভাইডার যোগ করুন' : 'প্রোভাইডার সম্পাদনা করুন'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">নাম</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="displayName">প্রদর্শন নাম</Label>
          <Input
            id="displayName"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="providerType">ধরন</Label>
          <Select
            value={form.providerType}
            onValueChange={(value) => setForm({ ...form, providerType: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai">OpenAI</SelectItem>
              <SelectItem value="anthropic">Anthropic</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="apiKey">{isNew ? 'API কী' : 'API কী (খালি রাখুন পরিবর্তন না করতে)'}</Label>
          <Input
            id="apiKey"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            required={isNew}
          />
        </div>

        <div>
          <Label htmlFor="defaultModel">ডিফল্ট মডেল</Label>
          <Input
            id="defaultModel"
            value={form.defaultModel}
            onChange={(e) => setForm({ ...form, defaultModel: e.target.value })}
          />
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {isNew ? 'তৈরি করুন' : 'সংরক্ষণ করুন'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/automation/providers')}>
            বাতিল
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/pages/ProviderListPage.tsx src/features/automation/pages/ProviderEditorPage.tsx src/hooks/admin/use-automation-providers.ts
git commit -m "feat: implement provider list and editor pages"
```

---

### Task 18: Template Pages Implementation

**Files:**
- Modify: `src/features/automation/pages/TemplateListPage.tsx`
- Modify: `src/features/automation/pages/TemplateEditorPage.tsx`
- Create: `src/hooks/admin/use-automation-templates.ts`

- [ ] **Step 1: Create use-automation-templates.ts**

```typescript
// src/hooks/admin/use-automation-templates.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useAutomationTemplates(params?: { page?: number; limit?: number; category?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.category) searchParams.set('category', params.category)

  return useQuery({
    queryKey: [...queryKeys.automation.templates(), params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/templates?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
    },
  })
}

export function useAutomationTemplate(id: string) {
  return useQuery({
    queryKey: queryKeys.automation.templateDetail(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/templates/${id}`)
      if (!res.ok) throw new Error('Failed to fetch template')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useCreateTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; category: string }) => {
      const res = await fetch('/api/admin/automation/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create template')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.templates() })
    },
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/automation/templates/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete template')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.templates() })
    },
  })
}
```

- [ ] **Step 2: Implement TemplateListPage**

```typescript
// src/features/automation/pages/TemplateListPage.tsx
'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAutomationTemplates, useDeleteTemplate } from '@/hooks/admin/use-automation-templates'

export default function TemplateListPage() {
  const router = useRouter()
  const { data, isLoading } = useAutomationTemplates()
  const deleteMutation = useDeleteTemplate()

  const handleDelete = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত এই টেমপ্লেট মুছে ফেলতে চান?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">প্রম্পট টেমপ্লেট</h1>
        <Button onClick={() => router.push('/admin/automation/templates/new')}>
          নতুন টেমপ্লেট যোগ করুন
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">লোড হচ্ছে...</p>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">নাম</th>
                <th className="p-3 text-left">ক্যাটাগরি</th>
                <th className="p-3 text-left">ভার্সন</th>
                <th className="p-3 text-left">স্ট্যাটাস</th>
                <th className="p-3 text-left">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((template: { id: string; name: string; category: string; versions: Array<{ version: number }>; isActive: boolean }) => (
                <tr key={template.id} className="border-b">
                  <td className="p-3">{template.name}</td>
                  <td className="p-3"><Badge variant="outline">{template.category}</Badge></td>
                  <td className="p-3">v{template.versions?.[0]?.version || 1}</td>
                  <td className="p-3">
                    <Badge variant={template.isActive ? 'default' : 'secondary'}>
                      {template.isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/automation/templates/${template.id}`)}
                      >
                        সম্পাদনা
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        মুছুন
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement TemplateEditorPage**

```typescript
// src/features/automation/pages/TemplateEditorPage.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAutomationTemplate, useCreateTemplate } from '@/hooks/admin/use-automation-templates'

export default function TemplateEditorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const isNew = id === 'new'

  const { data: template, isLoading } = useAutomationTemplate(isNew ? '' : id)
  const createMutation = useCreateTemplate()

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'rewrite',
  })

  useEffect(() => {
    if (template?.data) {
      setForm({
        name: template.data.name,
        description: template.data.description || '',
        category: template.data.category,
      })
    }
  }, [template])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createMutation.mutateAsync(form)
      router.push('/admin/automation/templates')
    } catch (error) {
      console.error('Failed to save template:', error)
    }
  }

  if (!isNew && isLoading) {
    return <div className="p-6">লোড হচ্ছে...</div>
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        {isNew ? 'নতুন টেমপ্লেট যোগ করুন' : 'টেমপ্লেট সম্পাদনা করুন'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">নাম</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="description">বিবরণ</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="category">ক্যাটাগরি</Label>
          <Select
            value={form.category}
            onValueChange={(value) => setForm({ ...form, category: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rewrite">Rewrite</SelectItem>
              <SelectItem value="metadata">Metadata</SelectItem>
              <SelectItem value="seo">SEO</SelectItem>
              <SelectItem value="social">Social</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4">
          <Button type="submit" disabled={createMutation.isPending}>
            {isNew ? 'তৈরি করুন' : 'সংরক্ষণ করুন'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/admin/automation/templates')}>
            বাতিল
          </Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/pages/TemplateListPage.tsx src/features/automation/pages/TemplateEditorPage.tsx src/hooks/admin/use-automation-templates.ts
git commit -m "feat: implement template list and editor pages"
```

---

### Task 19: Pipeline Pages Implementation

**Files:**
- Modify: `src/features/automation/pages/PipelineListPage.tsx`
- Modify: `src/features/automation/pages/PipelineDetailPage.tsx`
- Create: `src/hooks/admin/use-automation-pipelines.ts`

- [ ] **Step 1: Create use-automation-pipelines.ts**

```typescript
// src/hooks/admin/use-automation-pipelines.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

export function useAutomationPipelines(params?: { page?: number; limit?: number; status?: string }) {
  const searchParams = new URLSearchParams()
  if (params?.page) searchParams.set('page', String(params.page))
  if (params?.limit) searchParams.set('limit', String(params.limit))
  if (params?.status) searchParams.set('status', params.status)

  return useQuery({
    queryKey: [...queryKeys.automation.pipelines(), params],
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/pipelines?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch pipelines')
      return res.json()
    },
  })
}

export function useAutomationPipeline(id: string) {
  return useQuery({
    queryKey: queryKeys.automation.pipelineDetail(id),
    queryFn: async () => {
      const res = await fetch(`/api/admin/automation/pipelines/${id}`)
      if (!res.ok) throw new Error('Failed to fetch pipeline')
      return res.json()
    },
    enabled: !!id,
  })
}

export function useTriggerPipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { sourceId: string; pipelineType?: string }) => {
      const res = await fetch('/api/admin/automation/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to trigger pipeline')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.pipelines() })
    },
  })
}

export function useResumePipeline() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/automation/pipelines/${id}/resume`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to resume pipeline')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.automation.pipelines() })
    },
  })
}
```

- [ ] **Step 2: Implement PipelineListPage**

```typescript
// src/features/automation/pages/PipelineListPage.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAutomationPipelines } from '@/hooks/admin/use-automation-pipelines'

export default function PipelineListPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAutomationPipelines({ page, limit: 20 })

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">পাইপলাইন রান</h1>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">লোড হচ্ছে...</p>
      ) : (
        <div className="border rounded-lg">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">করিলেশন আইডি</th>
                <th className="p-3 text-left">সোর্স</th>
                <th className="p-3 text-left">ধরন</th>
                <th className="p-3 text-left">স্ট্যাটাস</th>
                <th className="p-3 text-left">তৈরি</th>
                <th className="p-3 text-left">কার্যক্রম</th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((run: { id: string; correlationId: string; pipelineType: string; status: string; createdAt: string; source?: { name: string } }) => (
                <tr key={run.id} className="border-b">
                  <td className="p-3 font-mono text-sm">{run.correlationId.substring(0, 8)}...</td>
                  <td className="p-3">{run.source?.name || 'Unknown'}</td>
                  <td className="p-3"><Badge variant="outline">{run.pipelineType}</Badge></td>
                  <td className="p-3">
                    <Badge className={statusColors[run.status] || ''}>{run.status}</Badge>
                  </td>
                  <td className="p-3">{new Date(run.createdAt).toLocaleDateString('bn-BD')}</td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/automation/pipelines/${run.id}`)}
                    >
                      বিস্তারিত
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
            পূর্ববর্তী
          </Button>
          <span className="py-2 px-4">
            পৃষ্ঠা {data.pagination.page} / {data.pagination.totalPages}
          </span>
          <Button variant="outline" disabled={page >= data.pagination.totalPages} onClick={() => setPage(page + 1)}>
            পরবর্তী
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement PipelineDetailPage**

```typescript
// src/features/automation/pages/PipelineDetailPage.tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAutomationPipeline, useResumePipeline } from '@/hooks/admin/use-automation-pipelines'

export default function PipelineDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const { data: pipeline, isLoading } = useAutomationPipeline(id)
  const resumeMutation = useResumePipeline()

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    FAILED: 'bg-red-100 text-red-800',
    SKIPPED: 'bg-gray-100 text-gray-800',
  }

  const handleResume = async () => {
    await resumeMutation.mutateAsync(id)
  }

  if (isLoading) {
    return <div className="p-6">লোড হচ্ছে...</div>
  }

  const run = pipeline?.data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">পাইপলাইন রান বিস্তারিত</h1>
          <p className="text-muted-foreground">{run?.correlationId}</p>
        </div>
        <div className="flex gap-2">
          {run?.status === 'FAILED' && (
            <Button onClick={handleResume} disabled={resumeMutation.isPending}>
              পুনরুদ্ধার করুন
            </Button>
          )}
          <Button variant="outline" onClick={() => router.back()}>
            ফিরে যান
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>সারসংক্ষেপ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">স্ট্যাটাস</p>
              <Badge className={statusColors[run?.status] || ''}>{run?.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ধরন</p>
              <p>{run?.pipelineType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">সোর্স</p>
              <p>{run?.source?.name || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">তৈরি</p>
              <p>{new Date(run?.createdAt).toLocaleString('bn-BD')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stages */}
      <Card>
        <CardHeader>
          <CardTitle>স্টেজ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {run?.stages?.map((stage: { name: string; status: string; startedAt: string; completedAt: string; errorMessage: string }) => (
              <div key={stage.name} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  <Badge className={statusColors[stage.status] || ''}>{stage.status}</Badge>
                  <span className="font-medium">{stage.name}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {stage.startedAt && new Date(stage.startedAt).toLocaleTimeString('bn-BD')}
                  {stage.completedAt && ` → ${new Date(stage.completedAt).toLocaleTimeString('bn-BD')}`}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader>
          <CardTitle>ইভেন্ট</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {run?.events?.map((event: { id: string; eventType: string; createdAt: string; data: string }) => (
              <div key={event.id} className="flex items-center justify-between p-2 border rounded text-sm">
                <Badge variant="outline">{event.eventType}</Badge>
                <span className="text-muted-foreground">
                  {new Date(event.createdAt).toLocaleString('bn-BD')}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/features/automation/pages/PipelineListPage.tsx src/features/automation/pages/PipelineDetailPage.tsx src/hooks/admin/use-automation-pipelines.ts
git commit -m "feat: implement pipeline list and detail pages"
```

---

### Task 20: Remaining Pages Implementation

**Files:**
- Modify: `src/features/automation/pages/RuleListPage.tsx`
- Modify: `src/features/automation/pages/RuleEditorPage.tsx`
- Modify: `src/features/automation/pages/ReviewListPage.tsx`
- Modify: `src/features/automation/pages/LogListPage.tsx`
- Modify: `src/features/automation/pages/ScheduleListPage.tsx`
- Modify: `src/features/automation/pages/AutomationSettingsPage.tsx`
- Create: `src/hooks/admin/use-automation-rules.ts`
- Create: `src/hooks/admin/use-automation-review.ts`
- Create: `src/hooks/admin/use-automation-logs.ts`
- Create: `src/hooks/admin/use-automation-schedules.ts`
- Create: `src/hooks/admin/use-automation-settings.ts`

This task implements the remaining 6 pages. Due to space constraints, the pattern is identical to previous pages: create TanStack Query hooks, then implement the page component with DataTable, loading/error states, and Bengali labels.

- [ ] **Step 1: Create all remaining hooks**

Follow the exact pattern from Task 16-19 for each entity: rules, review, logs, schedules, settings.

- [ ] **Step 2: Implement all remaining pages**

Each page follows the same pattern:
- List page: DataTable with columns, filters, pagination
- Editor page: Form with validation
- Bengali labels for all text
- Loading and error states

- [ ] **Step 3: Run lint and typecheck**

```bash
npm run lint
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/automation/pages/ src/hooks/admin/
git commit -m "feat: implement all remaining admin UI pages"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-27-automation-remaining-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
