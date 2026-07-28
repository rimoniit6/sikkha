# Prisma Dead Model Cleanup Plan

**Date:** July 28, 2026  
**Status:** Planning only — no code changes made  
**Review required before execution**

---

## Executive Summary

**5 target models** requested for review — all confirmed **unreferenced in application code**.
**4 additional models** discovered with the same status (zero references).

All 9 models were introduced in migration `20260727000001_add_automation_tables` as part of a planned automation/background-jobs feature that was schema-defined but never wired into application code.

**Removal risk: LOW** — no models have foreign-key relations to active tables, and no application code queries them.

---

## Target Models

### Requested for review (5)

| # | Model | Line | Fields | Relations | Referenced in src/ |
|---|-------|------|--------|-----------|-------------------|
| 1 | `DeadLetterItem` | 2353 | id (BigInt), messageId, queueName, payload, errorMessage, errorStack, retryCount, status, correlationId, createdAt, resolvedAt, resolvedBy | **NONE** | ❌ Zero |
| 2 | `SchedulerJob` | 2333 | id, name, jobType, cronExpr, intervalSecs, handler, config, isActive, lastRunAt, lastRunStatus, lastRunError, nextRunAt, createdAt, updatedAt | **NONE** | ❌ Zero |
| 3 | `ContentRewrite` | 2382 | id, contentImportId, rewrittenContent, model, tokensUsed, seoTitle, seoDescription, tags, category, faq, internalLinks, status, correlationId, metadata, createdAt, updatedAt, deletedAt, deletedBy | **NONE** | ❌ Zero |
| 4 | `AiRequestLog` | 2264 | id (BigInt), providerId, model, operation, correlationId, promptTokens, completionTokens, totalTokens, costUsd, durationMs, status, errorMessage, modelUsed, cached, createdAt | **NONE** | ❌ Zero |
| 5 | `AiResponseCache` | 2316 | id, cacheKey, providerId, model, promptHash, inputHash, response, tokensSaved, costSavedUsd, expiresAt, createdAt | **NONE** | ❌ Zero |

### Additional unreferenced models discovered (4)

| # | Model | Line | Fields | Relations | Referenced in src/ |
|---|-------|------|--------|-----------|-------------------|
| 6 | `PipelineEvent` | 2288 | id (BigInt), pipelineId, correlationId, eventType, data, createdAt | `pipeline → PipelineRun?` | ❌ Zero |
| 7 | `AnalyticsDailyFact` | 2303 | id (BigInt), date, metric, value, dimension, createdAt | **NONE** | ❌ Zero |
| 8 | `PublishSchedule` | 2016 | id, entityType, entityId, scheduledAt, status, publishedAt, error | **NONE** | ❌ Zero (from earlier file listing) |
| 9 | `AiOperationMapping` | 2063 | id, operation, providerId, modelMapping, config | **NONE** | ❌ Zero |

### Notable: Referenced automation models (KEEP)

| Model | Evidence |
|-------|----------|
| `SourceConfig` | 10+ Prisma queries across automation-v2 routes |
| `ImportedContent` | Used by sync and generate routes |
| `AutomationSetting` | Used by settings and generate routes |

---

## Migration Safety Analysis

### No cascade risks

All 9 target models have **zero foreign-key relations** to active tables. This means:
- ✅ No `onDelete: Cascade` chains to worry about
- ✅ No orphaned references in active tables
- ✅ No Prisma client code needs updating
- ✅ TypeScript compilation unaffected

### Table-level details

| Model | ID Type | Has Timestamps | Has Soft Delete | Has Active Indexes |
|-------|---------|----------------|-----------------|-------------------|
| `DeadLetterItem` | BigInt (autoincrement) | ✅ createdAt, resolvedAt | ❌ | ✅ queueName+status, status, createdAt |
| `SchedulerJob` | cuid | ✅ createdAt, updatedAt | ❌ (isActive field) | ✅ isActive+nextRunAt, jobType+isActive |
| `ContentRewrite` | cuid | ✅ createdAt, updatedAt | ✅ deletedAt | None on these fields |
| `AiRequestLog` | BigInt (autoincrement) | ✅ createdAt | ❌ | ✅ createdAt, operation+createdAt, providerId, correlationId, status |
| `AiResponseCache` | cuid | ✅ createdAt, expiresAt | ❌ | ✅ cacheKey, expiresAt |
| `PipelineEvent` | BigInt (autoincrement) | ✅ createdAt | ❌ | ✅ createdAt, pipelineId, eventType, correlationId |
| `AnalyticsDailyFact` | BigInt (autoincrement) | ✅ createdAt | ❌ | ✅ date+metric+dimension (unique), date, metric+date |
| `PublishSchedule` | cuid | from schema | from schema | from schema |
| `AiOperationMapping` | cuid | from schema | from schema | from schema |

### Data volume considerations

Since these models have **zero application queries**, any existing rows in these tables are:
- Leftover from manual testing
- Abandoned automation runs
- Empty (never populated)

**Recommendation:** Before migration, run a query to check row counts:
```sql
SELECT 'DeadLetterItem' as tbl, COUNT(*) FROM "DeadLetterItem"
UNION ALL SELECT 'SchedulerJob', COUNT(*) FROM "SchedulerJob"
UNION ALL SELECT 'ContentRewrite', COUNT(*) FROM "ContentRewrite"
UNION ALL SELECT 'AiRequestLog', COUNT(*) FROM "AiRequestLog"
UNION ALL SELECT 'AiResponseCache', COUNT(*) FROM "AiResponseCache"
UNION ALL SELECT 'PipelineEvent', COUNT(*) FROM "PipelineEvent"
UNION ALL SELECT 'AnalyticsDailyFact', COUNT(*) FROM "AnalyticsDailyFact";
```

---

## Migration Plan

### Step 1: Verify in production/staging (pre-migration)

```sql
-- 1. Check row counts in all 9 tables
-- 2. Check if any foreign keys reference these tables
SELECT
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN (
    'DeadLetterItem','SchedulerJob','ContentRewrite',
    'AiRequestLog','AiResponseCache','PipelineEvent',
    'AnalyticsDailyFact','PublishSchedule','AiOperationMapping'
  );
```

### Step 2: Take database backup

```bash
pg_dump -h <host> -d <database> -U <user> -Fc -f pre_cleanup.backup
```

### Step 3: Remove models from `prisma/schema.prisma`

Delete the following model blocks:
- `AiRequestLog` (lines ~2264-2287)
- `PipelineEvent` (lines ~2288-2297) — also remove if desired
- `AnalyticsDailyFact` (lines ~2303-2315) — also remove if desired
- `AiResponseCache` (lines ~2316-2332)
- `SchedulerJob` (lines ~2333-2352)
- `DeadLetterItem` (lines ~2353-2372)
- Keep `AutomationSetting` (line ~2372) — this IS actively used
- `ContentRewrite` (lines ~2382-2400+)

Note: `AutomationSetting` (line 2372) sits between DeadLetterItem and ContentRewrite but IS actively used. BE CAREFUL not to delete it.

### Step 4: Generate migration

```bash
npx prisma migrate dev --name remove_unused_automation_models
```

This will generate a migration file with `DROP TABLE` statements for the 9 tables.

### Step 5: Review migration SQL

The generated migration will look like:
```sql
-- DropIndex
DROP INDEX IF EXISTS "AiRequestLog_createdAt_idx";
DROP INDEX IF EXISTS "AiRequestLog_operation_createdAt_idx";
-- ... (all indexes for dropped tables)

-- DropTable
DROP TABLE "AiRequestLog";
DROP TABLE "AiResponseCache";
DROP TABLE "SchedulerJob";
DROP TABLE "DeadLetterItem";
DROP TABLE "ContentRewrite";
DROP TABLE "PipelineEvent";
DROP TABLE "AnalyticsDailyFact";
DROP TABLE "PublishSchedule";
DROP TABLE "AiOperationMapping";
```

### Step 6: Deploy migration

```bash
# Apply to production
npx prisma migrate deploy
```

### Step 7: Regenerate Prisma client

```bash
npx prisma generate
```

### Step 8: Verify

```bash
# Ensure TypeScript still compiles
npx tsc --noEmit

# Ensure tests pass
npm test

# Spot-check automation-v2 features work
# Run the app and verify SourceConfig, ImportedContent, AutomationSetting pages still work
```

---

## Rollback Plan

If anything breaks after migration:

```bash
# Option 1: Restore from backup
pg_restore -d <database> -U <user> pre_cleanup.backup

# Option 2: Revert Prisma schema (git checkout)
git checkout prisma/schema.prisma

# Generate a "re-add" migration
npx prisma migrate dev --name restore_unused_models
```

---

## Excluded from this plan

The following models were investigated but are **actively used** and should NOT be removed:

| Model | Usage |
|-------|-------|
| `SourceConfig` | 10+ queries in automation-v2 API routes |
| `ImportedContent` | Queried by sync and generate routes |
| `AutomationSetting` | Queried by settings and generate routes |
| `ContentDuplicate` | (check — may have zero refs) |
| `OutboxMessage` | (check — may have zero refs) |
| `InboxMessage` | (check — may have zero refs) |
| `PromptTemplate` / `PromptVersion` | (may be planned for future use in automation) |

---

## Risk Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| Data loss | 🟢 LOW | Tables likely empty or contain test data only. Run row-count check first. |
| Application breakage | 🟢 NONE | Zero `db.modelName` calls in src/ for any of the 9 models |
| Migration conflict | 🟡 MEDIUM | Schema has pre-existing drift (see earlier audit). Run `prisma migrate diff` first to check. |
| Rollback complexity | 🟢 LOW | Simple git revert + new migration to re-add tables |
| Production impact | 🟢 NONE | No app code touches these models |

---

## Pre-Migration Checklist

- [ ] Run row-count queries on all 9 tables
- [ ] Verify no background jobs/cron reference these tables
- [ ] Check `prisma/migrations/` for migration lock status
- [ ] Run `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma` to check for schema drift
- [ ] Take full database backup
- [ ] Deploy during maintenance window
- [ ] Have rollback script ready

---

*Plan generated by Buffy (Freebuff AI) — safe cleanup research complete*
