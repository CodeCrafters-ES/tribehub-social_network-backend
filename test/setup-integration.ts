/**
 * test/setup-integration.ts
 *
 * Vitest setupFile for the integration (e2e) test suite.
 * Runs before any test file is loaded, so process.env assignments here are
 * guaranteed to be in place before any NestJS module evaluates process.env
 * at import time.
 *
 * Referenced in vitest.integration.config.ts → test.setupFiles.
 */

// ---------------------------------------------------------------------------
// Stub environment variables required by modules that read process.env at
// load time (before any DI container is created).
//
// REDIS_URL — getRedisConnection() throws when absent.
// SUPABASE_* — SupabaseAuthGuard and the Supabase client factory read these
//              eagerly in their constructors / at module initialisation.
// ---------------------------------------------------------------------------
process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
process.env.SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';
