# Feature Flags — SystemConfigModule

Feature flags are stored in the `system_configs` PostgreSQL table and served
through `SystemConfigService` with a two-level cache (in-memory + Redis).

---

## Naming convention

Every key follows a dot-separated hierarchy of exactly three segments:

```
<category>.<domain>.<name>
```

| Category  | Value type | Purpose                                    | Example                        |
|-----------|------------|--------------------------------------------|--------------------------------|
| `feature` | `boolean`  | Enable or disable a feature at runtime     | `feature.feed.enabled`         |
| `config`  | any        | Tuneable parameter (number, string, JSON)  | `config.search.rateLimit`      |

Rules:
- Use `feature.<domain>.enabled` as the canonical shape for on/off toggles.
- Use `config.<domain>.<param>` for numeric or string configuration values.
- All segments are lowercase, no underscores, no hyphens.
- Domain must match the NestJS module name (`feed`, `search`, `reactions`, ...).

---

## Flags currently in the database

The following flags are seeded via `npx prisma db seed` (`prisma/seed.ts`).
All upsert calls are idempotent — safe to run multiple times.

| Key                         | valueType | Default value | Description                                              | Applied in                  |
|-----------------------------|-----------|---------------|----------------------------------------------------------|-----------------------------|
| `feature.feed.enabled`      | boolean   | `true`        | Enables the general feed endpoint (`GET /feed`)          | `FeedModule` controller      |
| `feature.search.enabled`    | boolean   | `true`        | Enables the global search endpoint (`GET /search`)       | `SearchModule` controller    |
| `feature.reactions.enabled` | boolean   | `true`        | Enables post reactions (`POST /reactions`)               | `ReactionsModule` controller |
| `config.search.rateLimit`   | number    | `30`          | Max search requests per minute per user (rate limiter)   | `SearchModule` rate limiter  |

### Default behaviour when a flag is absent from the database

`FeatureFlagGuard` calls `SystemConfigService.isEnabled(key, true)` with a
default of `true`. This means **a missing flag never blocks a route** — new
endpoints work without requiring a database row first.

---

## How to add a new flag

1. Add a row to `prisma/seed.ts` following the naming convention.
2. Run `npx prisma db seed` to insert the row.
3. Annotate the route with `@FeatureFlag` and `@UseGuards(FeatureFlagGuard)` (see below).

---

## How to use in an endpoint

Apply `@FeatureFlag` and `@UseGuards(FeatureFlagGuard)` together. The guard
reads the decorator metadata and calls `SystemConfigService.isEnabled()`.

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { FeatureFlagGuard } from '../../common/guards/feature-flag.guard';
import { FeatureFlag } from '../../common/decorators/feature-flag.decorator';

@Controller('feed')
export class FeedController {
  @UseGuards(FeatureFlagGuard)
  @FeatureFlag('feature.feed.enabled')
  @Get()
  getFeed() {
    // ...
  }
}
```

Important notes:
- Do **not** register `FeatureFlagGuard` globally. Apply it per-route or
  per-controller only where enforcement is needed.
- The module that owns the controller must import `SystemConfigModule` (or a
  shared `CommonModule` that re-exports it) so that `SystemConfigService` is
  available for injection in the guard.
- `@FeatureFlag` can also be placed at controller level to protect all routes
  in that controller with a single flag.

---

## Behaviour when a flag is disabled

When `isEnabled()` returns `false`, `FeatureFlagGuard` throws a
`ForbiddenException` and the request is rejected before reaching the handler.

HTTP response:

```
HTTP 403 Forbidden
```

```json
{
  "code": "FEATURE_DISABLED",
  "message": "This feature is currently disabled.",
  "details": {
    "flag": "feature.feed.enabled"
  }
}
```

A `WARN`-level structured log entry is also emitted:

```json
{
  "event": "feature_flag.blocked",
  "flag": "feature.feed.enabled",
  "enabled": false,
  "route": "GET /feed",
  "requestId": "<uuid>"
}
```

---

## How to invalidate / refresh the cache

`SystemConfigService.invalidate()` removes entries from both the in-memory Map
and Redis so the next read goes straight to the database.

### Invalidate a single key

```typescript
// After updating a specific flag in the DB:
await this.systemConfigService.invalidate('feature.feed.enabled');
```

### Invalidate all keys at once

```typescript
// After a bulk update or a migration that touches system_configs:
await this.systemConfigService.invalidate();
```

### When to call invalidate

| Scenario                                               | Call                           |
|--------------------------------------------------------|--------------------------------|
| A flag is updated via Prisma Studio or a migration     | `invalidate(key)`              |
| A seed is re-run after changing defaults               | `invalidate()` (full clear)    |
| An admin endpoint updates a flag in the DB             | `invalidate(key)` at the end of the service method |
| Horizontal deployment: new process starts with stale data | N/A — TTL expires automatically |

---

## TTL and configuration

| Variable                          | Default | Description                                                      |
|-----------------------------------|---------|------------------------------------------------------------------|
| `SYSTEM_CONFIG_CACHE_TTL_SECONDS` | `60`    | Lifetime of each entry in both in-memory cache and Redis (EX TTL) |

Set this variable in `.env` to change the TTL:

```env
SYSTEM_CONFIG_CACHE_TTL_SECONDS=120
```

Rules applied at startup:
- If the variable is absent or not a valid positive integer, the service falls
  back to `60` seconds.
- The same TTL is used for both cache levels. Redis entries are stored with
  `EX <ttl_seconds>` so they expire automatically even if `invalidate()` is
  never called.

### Cache read path (summary)

```
request
  └─ in-memory hit?  ──yes──> return value
       └─ Redis hit?  ──yes──> populate in-memory → return value
            └─ DB hit?  ──yes──> populate Redis + in-memory → return value
                 └─ DB miss / error  ──────────────> return defaultValue
```

Redis is optional. When `REDIS_URL` is not set, or when the connection fails,
the service operates with in-memory cache only. All failures are non-fatal —
the application continues to run using the provided `defaultValue`.
