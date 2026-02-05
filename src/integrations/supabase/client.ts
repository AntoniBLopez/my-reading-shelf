import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    typeof SUPABASE_URL === 'string' &&
      SUPABASE_URL.length > 0 &&
      typeof SUPABASE_PUBLISHABLE_KEY === 'string' &&
      SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
