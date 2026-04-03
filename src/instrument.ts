import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV ?? 'development';

if (!dsn) {
  console.warn(
    '[Sentry] SENTRY_DSN is not defined — Sentry will run in disabled mode.',
  );
}

const tracesSampleRate = nodeEnv === 'production' ? 0.2 : 1.0;

Sentry.init({
  dsn: dsn ?? undefined,
  environment: nodeEnv,
  tracesSampleRate,
  profilesSampleRate: 1.0,
  integrations: [nodeProfilingIntegration()],
  enabled: Boolean(dsn),
});
