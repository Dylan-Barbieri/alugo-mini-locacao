import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseEnv } from '@/lib/supabase/env';

const env = getSupabaseEnv();

export const isSupabaseConfigured = env.isConfigured;

export const supabase: SupabaseClient<Database> | null = env.isConfigured
  ? createClient<Database>(env.url, env.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
