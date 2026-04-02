// test/smoke/smoke.config.ts
//
// Config helper shared by all smoke test suites (staging, production).
// All values are read from environment variables so that no secrets are
// ever hardcoded. The defaults are safe values for local dry-runs.

export interface SmokeConfig {
  /** Full base URL of the target deployment, without a trailing slash. */
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

export interface SmokeConfigOptions {
  /**
   * Default value for SMOKE_BASE_URL when the env var is not set.
   * Defaults to 'https://staging.tribehub.app'.
   */
  defaultBaseUrl?: string;
  /**
   * Name of the env var that holds the smoke-test user email.
   * Defaults to 'SMOKE_USER_EMAIL'.
   */
  emailEnvVar?: string;
  /**
   * Name of the env var that holds the smoke-test user password.
   * Defaults to 'SMOKE_USER_PASSWORD'.
   */
  passwordEnvVar?: string;
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

export function loadSmokeConfig(options: SmokeConfigOptions = {}): SmokeConfig {
  const {
    defaultBaseUrl = 'https://staging.tribehub.app',
    emailEnvVar = 'SMOKE_USER_EMAIL',
    passwordEnvVar = 'SMOKE_USER_PASSWORD',
  } = options;

  const baseUrl = (process.env['SMOKE_BASE_URL'] ?? defaultBaseUrl).replace(
    /\/$/,
    '',
  ); // strip trailing slash

  // Credentials are required — no default so CI fails loudly when not set.
  const userEmail = requireEnv(emailEnvVar);
  const userPassword = requireEnv(passwordEnvVar);

  return {
    baseUrl,
    userEmail,
    userPassword,
    requestTimeoutMs: 15_000,
    suiteTimeoutMs: 60_000,
  };
}
