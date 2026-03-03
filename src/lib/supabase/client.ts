import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    // During SSR pre-render, env vars may not be available.
    // Return a dummy client that will be replaced on client-side hydration.
    if (typeof window === 'undefined') {
      return createClient('http://localhost:0', 'dummy-key', {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    throw new Error('Supabase URL and Anon Key must be set in environment variables');
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

// Lazily initialized singleton
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
