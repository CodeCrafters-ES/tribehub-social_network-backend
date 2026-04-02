// test/smoke/smoke.config.ts
//
// Config helper for the staging smoke test suite.
// All values are read from environment variables so that no secrets are
// ever hardcoded. The defaults are safe values for local dry-runs.

export interface SmokeConfig {
  /** Full base URL of the staging deployment, without a trailing slash. */
  baseUrl: string;
  /** Email of the dedicated smoke-test Supabase user. */
  userEmail: string;
  /** Password of the dedicated smoke-test Supabase user. */
  userPassword: string;
  /** Per-request timeout in milliseconds (remote deploys need more room). */
  requestTimeoutMs: number;
  /** Overall test suite timeout in milliseconds. */
  suiteTimeoutMs: number;
}

function requireEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined || value === '') {
    throw new Error(
      `[smoke] Required environment variable "${name}" is missing or empty. ` +
        'Set it before running the smoke suite.',
    );
  }
  return value;
}

export function loadSmokeConfig(): SmokeConfig {
  const baseUrl = (
    process.env['SMOKE_BASE_URL'] ?? 'https://staging.tribehub.app'
  ).replace(/\/$/, ''); // strip trailing slash

  // Credentials are required — no default so CI fails loudly when not set.
  const userEmail = requireEnv('SMOKE_USER_EMAIL');
  const userPassword = requireEnv('SMOKE_USER_PASSWORD');

  return {
    baseUrl,
    userEmail,
    userPassword,
    requestTimeoutMs: 15_000,
    suiteTimeoutMs: 60_000,
  };
}
