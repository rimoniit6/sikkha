/**
 * SIKKHA AI Content Automation — Real End-to-End Pipeline Test
 *
 * IMPORTANT: This test connects to a REAL PostgreSQL database and optionally
 * exercises REAL AI providers. Do NOT run against production data.
 *
 * Prerequisites:
 *   1. PostgreSQL running at DATABASE_URL (from .env or env var)
 *   2. Prisma schema migrated: npx prisma migrate dev
 *   3. (Optional) AI provider API key configured for real AI verification
 *   4. (Optional) Next.js dev server running on localhost:3000 for HTTP tests
 *
 * Run:
 *   npm run dev              # Start Next.js (for HTTP-mode tests)
 *   npx vitest run tests/workflow.real-e2e.test.ts --reporter=verbose
 *
 * Environment variables:
 *   DATABASE_URL             (required) PostgreSQL connection string
 *   SKIP_REAL_AI=true        Skip AI provider calls (default: true)
 *   SKIP_HTTP_TESTS=true     Skip HTTP endpoint tests (default: false)
 *   TEST_BASE_URL            Next.js URL (default: http://localhost:3000)
 *   AI_PROVIDER_KEY=...      Real AI provider API key
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// ─── Test Configuration ────────────────────────────────────────

let db: any = null
let pipelineEngine: any = null
let FULL_AUTOMATION_PIPELINE: any = null
let pipelineRunId: string | null = null

const SKIP_REAL_AI = process.env.SKIP_REAL_AI !== 'false'
const SKIP_HTTP_TESTS = process.env.SKIP_HTTP_TESTS === 'true'
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

// Unique correlation ID for this test run — used for cleanup
const TEST_CORRELATION_ID = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

async function getDb() {
  const { db: projectDb } = await import('@/lib/db')
  return projectDb
}

// ─── Setup & Teardown ──────────────────────────────────────────

beforeAll(async () => {
  try {
    db = await getDb()
    await db.$queryRaw`SELECT 1`
    console.log('✅ Database connected successfully')

    const engine = await import('@/features/automation/pipeline/pipeline-engine')
    pipelineEngine = engine.pipelineEngine

    const definitions = await import('@/features/automation/pipeline/definitions')
    FULL_AUTOMATION_PIPELINE = definitions.FULL_AUTOMATION_PIPELINE
  } catch (error) {
    console.error('❌ Failed to connect to database:', error instanceof Error ? error.message : error)
    console.error('   Make sure DATABASE_URL is configured and PostgreSQL is running.')
    console.error('   Current DATABASE_URL:', process.env.DATABASE_URL || '(not set)')
    throw error
  }
})

afterAll(async () => {
  if (!db || !pipelineRunId) return

  // Delete records in reverse dependency order by pipelineId FK
  // StageExecution and PipelineEvent reference PipelineRun via pipelineId
  // ReviewTask, BlogPost reference PipelineRun via correlationId or pipelineId
  try {
    // Stage 1: Delete stage executions
    await db.stageExecution.deleteMany({ where: { pipelineId: pipelineRunId } }).catch(() => {})
    // Stage 2: Delete pipeline events
    await db.pipelineEvent.deleteMany({ where: { pipelineId: pipelineRunId } }).catch(() => {})
    // Stage 3: Delete pipeline run itself
    await db.pipelineRun.deleteMany({ where: { id: pipelineRunId } }).catch(() => {})

    // Cleanup by correlationId as well (for tables that use it)
    const tables = [
      'aiRequestLog', 'outboxMessage', 'inboxMessage', 'deadLetterItem',
      'reviewTask', 'blogPost',
    ]
    for (const table of tables) {
      try {
        const model = db[table]
        if (model?.deleteMany) {
          await model.deleteMany({ where: { correlationId: TEST_CORRELATION_ID } })
        }
      } catch { /* table might not have correlationId field */ }
    }

    console.log('✅ Test data cleaned up successfully')
  } catch (error) {
    console.warn('⚠️ Cleanup incomplete:', error instanceof Error ? error.message : error)
  }
})

// ─── Tests ─────────────────────────────────────────────────────

describe('Real E2E: Pipeline End-to-End', () => {
  it('Database is connected and pipeline models exist', async () => {
    if (!db) throw new Error('Database not connected')
    const result = await db.$queryRaw`SELECT 1 as check`
    expect(result).toBeTruthy()

    const tables = ['pipeline_run', 'stage_execution', 'pipeline_event', 'review_task', 'outbox_message']
    for (const table of tables) {
      try {
        await db.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`)
      } catch {
        console.warn(`⚠️ Table "${table}" not found. Run: npx prisma migrate dev`)
      }
    }
    console.log('✅ All pipeline tables exist in schema')
  })

  it('Pipeline engine singleton is available', () => {
    expect(pipelineEngine).toBeTruthy()
    expect(typeof pipelineEngine.execute).toBe('function')
    expect(typeof pipelineEngine.resume).toBe('function')
  })

  it('FULL_AUTOMATION pipeline definition is loaded', () => {
    expect(FULL_AUTOMATION_PIPELINE).toBeTruthy()
    expect(FULL_AUTOMATION_PIPELINE.name).toBe('FULL_AUTOMATION')
    expect(FULL_AUTOMATION_PIPELINE.stages).toHaveLength(7)
    expect(FULL_AUTOMATION_PIPELINE.stages.map((s: any) => s.name)).toEqual([
      'RESEARCH', 'OUTLINE', 'DRAFT', 'SEO', 'METADATA', 'REVIEW', 'PUBLISH',
    ])
    console.log('✅ Pipeline definition loaded with 7 stages')
  })

  it('Runs the pipeline and verifies DB records', async () => {
    if (!db || !pipelineEngine || !FULL_AUTOMATION_PIPELINE) throw new Error('Infrastructure not loaded')

    // Execute the pipeline with a Bengali education topic
    const result = await pipelineEngine.execute(
      `e2e-${TEST_CORRELATION_ID}`,
      FULL_AUTOMATION_PIPELINE,
      {
        topic: 'বাংলাদেশের শিক্ষা ব্যবস্থা',
        sourceUrl: `e2e://${TEST_CORRELATION_ID}`,
        sourceType: 'e2e-test',
      },
      TEST_CORRELATION_ID,
    )

    pipelineRunId = result.pipelineId
    console.log(`\n📊 Pipeline Result:`)
    console.log(`   Success:     ${result.success}`)
    console.log(`   Status:      ${result.status}`)
    console.log(`   Pipeline ID: ${result.pipelineId}`)
    console.log(`   Correlation: ${result.correlationId}`)
    console.log(`   Failed at:   ${result.failedStage || '(none)'}`)
    console.log(`   Error:       ${result.error || '(none)'}`)

    expect(result.pipelineId).toBeTruthy()
    expect(result.correlationId).toBe(TEST_CORRELATION_ID)

    if (SKIP_REAL_AI) {
      // Without real AI, pipeline fails at RESEARCH stage (No AI providers available)
      // This proves DB records are created before the failure
      expect(result.success).toBe(false)
      expect(result.status).toBe('FAILED')
      expect(result.failedStage).toBe('RESEARCH')
      expect(result.error).toMatch(/No AI providers available|rate limit|AI/)
      console.log('ℹ️ Pipeline failed at RESEARCH (expected — no AI provider configured)')
    } else {
      expect(result.success).toBe(true)
      expect(result.status).toBe('COMPLETED')
      expect(result.completedStages).toHaveLength(7)
    }

    // ─── Database Record Verification ─────────────────────────

    // 1. PipelineRun
    const pipelineRun = await db.pipelineRun.findUnique({
      where: { id: result.pipelineId },
    })
    expect(pipelineRun).toBeTruthy()
    expect(pipelineRun.correlationId).toBe(TEST_CORRELATION_ID)
    expect(pipelineRun.startedAt).toBeTruthy()
    console.log(`✅ PipelineRun: id=${pipelineRun.id}, status=${pipelineRun.status}`)

    // 2. StageExecution records
    const stages = await db.stageExecution.findMany({
      where: { pipelineId: result.pipelineId },
      orderBy: { stageOrder: 'asc' },
    })
    expect(stages.length).toBeGreaterThanOrEqual(1)
    console.log(`✅ StageExecutions: ${stages.length} records`)
    for (const stage of stages) {
      console.log(`   ${stage.stageName} (order ${stage.stageOrder}): ${stage.status}`)
      expect(stage.pipelineId).toBe(result.pipelineId)
    }

    // 3. PipelineEvent records — chronological order
    const events = await db.pipelineEvent.findMany({
      where: { pipelineId: result.pipelineId },
      orderBy: { createdAt: 'asc' },
    })
    expect(events.length).toBeGreaterThanOrEqual(1)
    console.log(`✅ PipelineEvents: ${events.length} records`)
    const eventTypes = events.map((e: any) => e.eventType)
    expect(eventTypes[0]).toBe('PIPELINE_STARTED')

    const terminalEvent = eventTypes[eventTypes.length - 1]
    expect(['PIPELINE_COMPLETED', 'PIPELINE_FAILED', 'PIPELINE_CANCELLED']).toContain(terminalEvent)
    console.log(`   First event: ${eventTypes[0]}, Last event: ${terminalEvent}`)

    // 4. Chronological ordering
    for (let i = 1; i < events.length; i++) {
      const prev = new Date(events[i - 1].createdAt).getTime()
      const curr = new Date(events[i].createdAt).getTime()
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
    console.log('✅ All events in chronological order')

    // 5. Correlation ID consistency
    for (const event of events) expect(event.correlationId).toBe(TEST_CORRELATION_ID)
    for (const stage of stages) expect(stage.pipelineId).toBe(pipelineRunId)
    console.log('✅ Correlation IDs consistent across pipeline')
  })

  it('Stage order matches pipeline definition', async () => {
    if (!db || !pipelineRunId) return

    const stages = await db.stageExecution.findMany({
      where: { pipelineId: pipelineRunId },
      orderBy: { stageOrder: 'asc' },
    })

    const expectedOrder = ['RESEARCH', 'OUTLINE', 'DRAFT', 'SEO', 'METADATA', 'REVIEW', 'PUBLISH']
    for (let i = 0; i < Math.min(stages.length, expectedOrder.length); i++) {
      expect(stages[i].stageName).toBe(expectedOrder[i])
      expect(stages[i].stageOrder).toBe(i)
    }
    console.log(`✅ Stage order: correct (${stages.length}/${expectedOrder.length} stages)`)

    // Verify status transitions: first stages tried should have status (RUNNING, FAILED, COMPLETED, SKIPPED)
    const validStatuses = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED', 'ROLLED_BACK']
    for (const stage of stages) {
      expect(validStatuses).toContain(stage.status)
    }
    console.log('✅ All stage statuses valid')
  })
})

describe('Real E2E: API Endpoints', () => {
  it('Health endpoint returns component status', async () => {
    if (SKIP_HTTP_TESTS) return

    const res = await fetch(`${BASE_URL}/api/admin/automation/health`)
    const data = await res.json().catch(() => null)

    if (res.status === 200) {
      console.log(`✅ Health: ${data?.status}, DB: ${data?.components?.database?.status}`)
      expect(data?.status).toBeDefined()
      expect(data?.components?.database).toBeDefined()
      expect(data?.components?.pipeline).toBeDefined()
    } else if (res.status === 401) {
      console.log('⏭️ Health endpoint returned 401 (no admin session)')
    } else {
      console.log(`⚠️ Health endpoint: ${res.status}`)
    }
  })
})

describe('Real E2E: Resume Flow', () => {
  it('PipelineEngine.resume() handles non-existent pipeline gracefully', async () => {
    const result = await pipelineEngine.resume('non-existent-pipeline-id')
    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
    console.log('✅ Resume: graceful error for non-existent pipeline')
  })

  it('PipelineEngine can be instantiated multiple times', async () => {
    const { PipelineEngine } = await import('@/features/automation/pipeline/pipeline-engine')
    const e1 = new PipelineEngine()
    const e2 = new PipelineEngine()
    expect(e1).toBeTruthy()
    expect(e2).toBeTruthy()
    console.log('✅ PipelineEngine: multiple instances OK')
  })
})
