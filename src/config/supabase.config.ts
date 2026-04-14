// src/config/supabase.config.ts
//
// Supabase client singleton.
//
// Why a singleton:
//   createClient() allocates an HTTP agent, an auth state machine, and (when
//   Realtime is enabled) a WebSocket connection. Calling it on every request
//   produces unbounded allocations that are never freed, which is the primary
//   driver of heap growth in high-traffic scenarios.
//
//   A single instance is safe because @supabase/supabase-js is designed to be
//   shared across the lifetime of a server process. Auth operations
//   (signUp, signInWithPassword) are stateless at the client level — each call
//   is an independent HTTP request regardless of how many clients exist.
//
// Thread safety:
//   Node.js is single-threaded; the module-level `let` is initialised at most
//   once per process and is safe without additional locking.

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let instance: SupabaseClient | null = null;
let adminInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (instance) {
    return instance;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variable: SUPABASE_ANON_KEY');
  }

  instance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    // Disable the Realtime subscription manager entirely — the backend never
    // subscribes to database changes via this client, and the underlying
    // WebSocket would otherwise hold the event loop open and consume memory.
    realtime: { params: { eventsPerSecond: -1 } },
  });

  return instance;
}

/**
 * Returns a Supabase client initialised with the service-role key.
 * This client bypasses Row Level Security and has admin privileges —
 * use only for server-side operations that require elevated access
 * (e.g. auth.admin.deleteUser during registration rollback).
 *
 * Never expose this client or its key to untrusted callers.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (adminInstance) {
    return adminInstance;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  adminInstance = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // Disable automatic session persistence — the admin client is used for
      // one-off server-side operations and must never store session state.
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: { params: { eventsPerSecond: -1 } },
  });

  return adminInstance;
}

/**
 * Resets the singletons. Intended for use in unit tests only — production code
 * must never call this function.
 */
export function _resetSupabaseClientForTesting(): void {
  instance = null;
  adminInstance = null;
}
