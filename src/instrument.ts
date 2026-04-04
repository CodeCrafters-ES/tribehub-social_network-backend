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

Sentry.init({
  dsn: dsn ?? undefined,
  environment: nodeEnv,
  tracesSampleRate,
  profilesSampleRate,
  integrations: [nodeProfilingIntegration()],
  enabled: Boolean(dsn),
});
