# Cache Architecture

> Caching strategy documentation for শিক্ষা বাংলা.

## React Query (Client-Side)

### Server-Side Prefetch

In `layout.tsx`:
```typescript
const queryClient = new QueryClient()
await queryClient.prefetchQuery({
  queryKey: queryKeys.config,
  queryFn: fetchSiteConfig,
  staleTime: 300_000, // 5 minutes
})
const dehydratedState = dehydrate(queryClient)
```

### Query Key Factory

All keys defined in `src/lib/query-keys.ts`:
```typescript
export const queryKeys = {
  config: ['config'] as const,
  hierarchyMetadata: ['hierarchyMetadata'] as const,
  subjects: (classSlug: string) => ['subjects', classSlug] as const,
  admin: {
    examResults: (params) => ['admin', 'exam-results', params],
  },
}
```

### Cache Invalidation

After mutations, invalidate relevant queries:
```typescript
queryClient.invalidateQueries({ queryKey: queryKeys.subjects(classSlug) })
```

The `LearningPreferenceProvider` invalidates all content queries when preference changes.

## HTTP Caching

| Resource | Cache Header |
|----------|-------------|
| Static assets (images, fonts) | `Cache-Control: public, max-age=31536000, immutable` |
| API responses | `Cache-Control: no-store` (dynamic) |
| Site config | Prefetched with `staleTime: 300000` (5 min) |

## Database Caching

### In-Memory Cache

- `content-type-labels.ts`: 5-minute TTL
- `csrf.ts`: 30-second TTL for CSRF setting

### Pattern

```typescript
let cachedValue: T | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000

function getCached(): T {
  if (cachedValue && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedValue
  }
  // Fetch and cache
  cachedValue = fetchFromDB()
  cacheTimestamp = Date.now()
  return cachedValue
}
```

## Invalidation Strategies

| Trigger | Action |
|---------|--------|
| Content CRUD | Invalidate related content queries |
| Learning preference change | Invalidate all content queries |
| Payment approval | Invalidate purchase/access queries |
| Admin settings change | Invalidate config query |
