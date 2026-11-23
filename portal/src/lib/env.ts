export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  vapidPublicKey: (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || undefined,
};
export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
