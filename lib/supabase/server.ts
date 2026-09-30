// Utilidades de servidor: valida el token del usuario y crea un cliente
// de Supabase que actúa EN NOMBRE de ese usuario (las políticas RLS se
// siguen aplicando, así que no hace falta la service role key).
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config";

export type AuthContext = { user: User; supabase: SupabaseClient };

export async function requireUser(req: Request): Promise<AuthContext | NextResponse> {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return jsonError("Debes iniciar sesión.", 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return jsonError("Sesión inválida o expirada.", 401);

  return { user: data.user, supabase };
}

export function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}
