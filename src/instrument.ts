import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!dsn) {
  console.warn(
    '[Sentry] SENTRY_DSN is not defined — Sentry will run in disabled mode.',
  );
}

const isProduction = nodeEnv === 'production';

// Sample only a fraction of traces in production to reduce overhead.
// In non-production envs keep full sampling so local debugging works,
// but only when Sentry is actually enabled (DSN present).
const tracesSampleRate = isProduction ? 0.2 : 1.0;

// Profiling generates a V8 heap snapshot for every sampled transaction.
// Running at 100 % in non-production environments with Sentry disabled
// causes the profiling payloads to accumulate in memory because they are
// never flushed. Cap to 0 outside production.
const profilesSampleRate = isProduction ? 0.2 : 0;

// Only activate the V8 profiling integration when it will actually be used:
// production environment, a positive sample rate, and a valid DSN. Without
// this guard the integration allocates V8 profiler resources and accumulates
// profiling payloads in memory even when Sentry is effectively disabled
// (no DSN) or profiling is opted out (rate == 0).
const enableProfiling = isProduction && profilesSampleRate > 0 && Boolean(dsn);

Sentry.init({
  dsn: dsn ?? undefined,
  environment: nodeEnv,
  tracesSampleRate,
  profilesSampleRate,
  integrations: enableProfiling ? [nodeProfilingIntegration()] : [],
  enabled: Boolean(dsn),
});
