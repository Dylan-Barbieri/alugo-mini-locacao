type SupabaseEnv = {
  url: string;
  anonKey: string;
  isConfigured: boolean;
};

export function getSupabaseEnv(): SupabaseEnv {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  return {
    url: url ?? '',
    anonKey: anonKey ?? '',
    isConfigured: Boolean(url && anonKey),
  };
}
