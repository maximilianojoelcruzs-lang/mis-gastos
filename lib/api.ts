"use client";
// Cliente del backend propio: añade el token de Supabase a cada llamada.
import type { AppData } from "./types";
import { getSupabase } from "./supabase/client";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function authFetch(path: string, init: RequestInit = {}) {
  const sb = getSupabase();
  const { data } = sb ? await sb.auth.getSession() : { data: { session: null } };
  const token = data.session?.access_token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const resp = await fetch(path, { ...init, headers });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.error) throw new ApiError(json.error || "Error del servidor.", resp.status);
  return json;
}

const q = (owner: string | null, extra = "") => {
  const p = new URLSearchParams();
  if (owner) p.set("owner", owner);
  if (extra) p.set("meta", "1");
  const s = p.toString();
  return "/api/data" + (s ? "?" + s : "");
};

export const api = {
  /** owner = null → mis datos; si no, los de quien me los compartió. */
  loadData: (owner: string | null = null): Promise<{ content: AppData; updated_at: string | null }> => authFetch(q(owner)),
  version: (owner: string | null = null): Promise<{ updated_at: string }> => authFetch(q(owner, "meta")),
  saveData: (content: AppData, base: string | null = null, owner: string | null = null): Promise<{ updated_at: string }> =>
    authFetch("/api/data", { method: "PUT", body: JSON.stringify({ content, base, owner }) }),
};
