"use client";
// Sincroniza la lista del súper con otras personas a través de Supabase.
//  • Cada producto es una fila (shared_items); nunca se sobreescribe la lista entera.
//  • "El último cambio gana" por producto, con la hora del servidor.
//  • Los borrados se marcan (deleted) para que el otro dispositivo se entere.
//  • Se consulta cada pocos segundos mientras la app está a la vista.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AisleId, AppData, MarketItem } from "./types";
import { AISLES, guessAisle } from "./data";
import { getSupabase } from "./supabase/client";

type UpdateFn = (mutate: (draft: AppData) => void) => void;
export type SyncStatus = "off" | "syncing" | "ok" | "error";
export type Member = { user_id: string; email: string | null };
type Row = { list_id: string; id: string; data: Partial<MarketItem> | null; deleted: boolean; updated_at: string };
type Known = { hash: string; at: number; deleted?: boolean };

const POLL_MS = 5000;
const AISLE_IDS = AISLES.map((a) => a.id);
const hashItem = (i: MarketItem) => JSON.stringify([i.name, i.qty, i.price, i.done, i.aisle]);
const toData = (i: MarketItem) => ({ name: i.name, qty: i.qty, price: i.price, done: i.done, aisle: i.aisle });

export const SQL_MISSING =
  "Falta activar las listas compartidas en Supabase: ejecuta el archivo supabase/shared_lists.sql en el SQL Editor.";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function friendlyError(err: any): string {
  const m = String(err?.message || "").toLowerCase();
  const c = String(err?.code || "");
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(c) || m.includes("could not find the") || m.includes("does not exist")) return SQL_MISSING;
  if (m.includes("not_found")) return "No existe una lista con ese código.";
  if (m.includes("list_full")) return "Esa lista ya tiene el máximo de 8 personas.";
  if (m.includes("not_authenticated") || m.includes("jwt")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sin conexión.";
  return err?.message || "Ocurrió un error.";
}

function rowToItem(r: Row): MarketItem {
  const d = (r.data || {}) as Partial<MarketItem>;
  const name = typeof d.name === "string" ? d.name : "";
  return {
    id: r.id,
    name,
    qty: Number(d.qty) || 1,
    price: Number(d.price) || 0,
    done: !!d.done,
    aisle: AISLE_IDS.includes(d.aisle as AisleId) ? (d.aisle as AisleId) : guessAisle(name),
  };
}

export function useSharedList(data: AppData | null, update: UpdateFn) {
  const link = data?.market.shared ?? null;
  const linkId = link?.id ?? null;
  const [status, setStatus] = useState<SyncStatus>("off");
  const [error, setError] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const known = useRef(new Map<string, Known>());
  const dataRef = useRef(data);
  dataRef.current = data;
  const running = useRef(false);
  const again = useRef(false);

  const syncNow = useCallback(async () => {
    const sb = getSupabase();
    const start = dataRef.current;
    if (!sb || !start?.market.shared) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    const listId = start.market.shared.id;
    try {
      // 1) Traer lo que hay en el servidor
      const { data: rows, error: e1 } = await sb.from("shared_items").select("*").eq("list_id", listId);
      if (e1) throw e1;
      if (dataRef.current?.market.shared?.id !== listId) return; // cambió de lista mientras tanto

      // 2) Qué aplicar localmente (un cambio local pendiente le gana al remoto)
      const local = dataRef.current!.market.items;
      const localMap = new Map(local.map((i) => [i.id, i]));
      const upsertLocal: MarketItem[] = [];
      const removeLocal = new Set<string>();
      for (const r of (rows || []) as Row[]) {
        const k = known.current.get(r.id);
        const at = Date.parse(r.updated_at) || 0;
        if (k && k.at >= at) continue;
        const l = localMap.get(r.id);
        if (l && k && !k.deleted && hashItem(l) !== k.hash) continue;
        if (r.deleted) {
          if (l) removeLocal.add(r.id);
          known.current.set(r.id, { hash: "", at, deleted: true });
        } else {
          const it = rowToItem(r);
          upsertLocal.push(it);
          known.current.set(r.id, { hash: hashItem(it), at });
        }
      }
      let next = local.filter((i) => !removeLocal.has(i.id));
      for (const it of upsertLocal) {
        const idx = next.findIndex((x) => x.id === it.id);
        next = idx >= 0 ? next.map((x, n) => (n === idx ? it : x)) : [...next, it];
      }
      if (upsertLocal.length || removeLocal.size) {
        update((d) => {
          const m = d.market;
          m.items = m.items.filter((i) => !removeLocal.has(i.id));
          for (const it of upsertLocal) {
            const idx = m.items.findIndex((x) => x.id === it.id);
            if (idx >= 0) m.items[idx] = it;
            else m.items.push(it);
          }
        });
      }

      // 3) Subir lo que cambió aquí (y los borrados)
      const nextIds = new Set(next.map((i) => i.id));
      const upserts: { list_id: string; id: string; data: object; deleted: boolean }[] = [];
      for (const it of next) {
        const k = known.current.get(it.id);
        if (!k || (!k.deleted && k.hash !== hashItem(it))) upserts.push({ list_id: listId, id: it.id, data: toData(it), deleted: false });
      }
      for (const [id, k] of known.current) if (!k.deleted && !nextIds.has(id)) upserts.push({ list_id: listId, id, data: {}, deleted: true });
      if (upserts.length) {
        setStatus("syncing");
        const { data: saved, error: e2 } = await sb.from("shared_items").upsert(upserts, { onConflict: "list_id,id" }).select();
        if (e2) throw e2;
        for (const r of (saved || []) as Row[]) {
          known.current.set(r.id, r.deleted
            ? { hash: "", at: Date.parse(r.updated_at) || 0, deleted: true }
            : { hash: hashItem(rowToItem(r)), at: Date.parse(r.updated_at) || 0 });
        }
      }
      setError("");
      setStatus("ok");
    } catch (e) {
      setError(friendlyError(e));
      setStatus("error");
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        setTimeout(() => syncNow(), 50);
      }
    }
  }, [update]);

  // Al cambiar de lista se empieza de cero
  useEffect(() => {
    known.current = new Map();
    setError("");
    setMembers([]);
    setStatus(linkId ? "syncing" : "off");
  }, [linkId]);

  // Sincroniza poco después de cada cambio en los productos
  const signature = useMemo(() => (data ? data.market.items.map((i) => i.id + hashItem(i)).join("|") : ""), [data]);
  useEffect(() => {
    if (!linkId) return;
    const t = setTimeout(syncNow, 700);
    return () => clearTimeout(t);
  }, [linkId, signature, syncNow]);

  // Y consulta cada pocos segundos mientras la app esté a la vista
  useEffect(() => {
    if (!linkId) return;
    const tick = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    const iv = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [linkId, syncNow]);

  // Participantes
  useEffect(() => {
    const sb = getSupabase();
    if (!linkId || !sb) return;
    let alive = true;
    const load = async () => {
      const { data: rows } = await sb.from("shared_members").select("user_id,email").eq("list_id", linkId);
      if (alive && rows) setMembers(rows as Member[]);
    };
    load();
    const iv = setInterval(load, 10000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, [linkId]);

  const setLink = (row: any) => {
    const r = Array.isArray(row) ? row[0] : row;
    if (!r?.id) return "No se pudo abrir la lista.";
    update((d) => { d.market.shared = { id: r.id, name: r.name || "Lista compartida", code: r.code || "" }; });
    return "";
  };

  /** Devuelve un mensaje de error, o "" si salió bien. */
  const create = async (name: string) => {
    const sb = getSupabase();
    if (!sb) return "Sin conexión.";
    const { data: row, error: e } = await sb.rpc("create_shared_list", { p_name: name });
    return e ? friendlyError(e) : setLink(row);
  };
  const join = async (code: string) => {
    const sb = getSupabase();
    if (!sb) return "Sin conexión.";
    const { data: row, error: e } = await sb.rpc("join_shared_list", { p_code: code });
    return e ? friendlyError(e) : setLink(row);
  };
  const leave = async () => {
    const sb = getSupabase();
    if (!sb || !linkId) return "";
    const { error: e } = await sb.rpc("leave_shared_list", { p_list: linkId });
    if (e) return friendlyError(e);
    update((d) => { d.market.shared = null; });
    return "";
  };

  return { link, status, error, members, syncNow, create, join, leave };
}
export type SharedList = ReturnType<typeof useSharedList>;
