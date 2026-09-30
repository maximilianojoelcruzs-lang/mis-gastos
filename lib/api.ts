"use client";
// Cliente del backend propio: añade el token de Supabase a cada llamada.
import type { AppData } from "./types";
import type { PriceLookup } from "./gemini";
import { getSupabase } from "./supabase/client";

async function authFetch(path: string, init: RequestInit = {}) {
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const resp = await fetch(path, { ...init, headers });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.error) throw new Error(json.error || "Error del servidor.");
  return json;
}

export const api = {
  loadData: (): Promise<{ content: AppData }> => authFetch("/api/data"),
  saveData: (content: AppData) =>
    authFetch("/api/data", { method: "PUT", body: JSON.stringify({ content }) }),
  buscarPrecio: (q: string): Promise<PriceLookup> =>
    authFetch("/api/buscar-precio?q=" + encodeURIComponent(q)),
};
