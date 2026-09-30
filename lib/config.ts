// La URL y la clave "anon" de Supabase son públicas por diseño (la
// seguridad la dan las políticas RLS). Se leen de variables de entorno;
// los valores por defecto mantienen funcionando el despliegue actual.
export const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uzutgrejzbxezkvhezuw.supabase.co"
)
  .trim()
  .replace(/\/(rest|auth)(\/v\d+)?\/?$/i, "")
  .replace(/\/+$/, "");

export const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6dXRncmVqemJ4ZXprdmhlenV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1MDQ5MTUsImV4cCI6MjEwMTA4MDkxNX0.u_5Lqy5av9gnEaJKOW6ihY186D9iyaxGmz4-drjFcJk"
).trim();

export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
