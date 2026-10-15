// La URL y la clave pública de Supabase (anon o "publishable") son públicas
// por diseño: la seguridad la dan las políticas RLS. Las define la
// integración de Supabase en Vercel (o .env.local en desarrollo).
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .trim()
  .replace(/\/(rest|auth)(\/v\d+)?\/?$/i, "")
  .replace(/\/+$/, "");

export const SUPABASE_ANON_KEY = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  ""
).trim();

export const isConfigured = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;
