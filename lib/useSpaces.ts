"use client";
// Compartir tus finanzas con roles (lector / editor). Tablas y funciones en
// supabase/data_sharing.sql; la seguridad la imponen RLS y esas funciones.
import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";

export type Role = "lector" | "editor";
export type MemberRow = { owner_id: string; member_id: string; owner_email: string | null; member_email: string | null; role: Role };
export type InviteRow = { code: string; role: Role; expires_at: string };
/** Un espacio = las finanzas de alguien. owner null = las mías. */
export type Space = { owner: string | null; label: string; role: "dueño" | Role };

export const ROLE_LABEL: Record<Role, string> = { lector: "Puede ver", editor: "Puede editar" };

export const SHARING_SQL_MISSING =
  "Falta activar “Compartir mis finanzas” en Supabase: ejecuta el archivo supabase/data_sharing.sql en el SQL Editor.";

/* eslint-disable @typescript-eslint/no-explicit-any */
export function sharingError(err: any): string {
  const m = String(err?.message || "").toLowerCase();
  const c = String(err?.code || "");
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(c) || m.includes("could not find the") || m.includes("does not exist")) return SHARING_SQL_MISSING;
  if (m.includes("not_found")) return "El código no existe o ya venció (duran 7 días y sirven una sola vez).";
  if (m.includes("own_invite")) return "Ese código es tuyo: compártelo con la otra persona.";
  if (m.includes("too_many_members")) return "Ya compartes tus finanzas con el máximo de 5 personas.";
  if (m.includes("too_many_invites")) return "Tienes 5 invitaciones pendientes: anula alguna antes de crear otra.";
  if (m.includes("not_authenticated") || m.includes("jwt")) return "Tu sesión expiró. Vuelve a iniciar sesión.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sin conexión.";
  return err?.message || "Ocurrió un error.";
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function useSpaces(userId: string) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const [m, i] = await Promise.all([
      sb.from("data_members").select("owner_id, member_id, owner_email, member_email, role"),
      sb.from("data_invites").select("code, role, expires_at").gt("expires_at", new Date().toISOString()),
    ]);
    const err = m.error || i.error;
    setError(err ? sharingError(err) : "");
    setMembers((m.data as MemberRow[]) || []);
    setInvites((i.data as InviteRow[]) || []);
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh, userId]);

  const call = useCallback(async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await getSupabase()!.rpc(fn, args);
    if (error) throw new Error(sharingError(error));
    await refresh();
    return data;
  }, [refresh]);

  const sharedWithMe = members.filter((m) => m.member_id === userId);
  const myMembers = members.filter((m) => m.owner_id === userId);
  const spaces: Space[] = [
    { owner: null, label: "Mis finanzas", role: "dueño" },
    ...sharedWithMe.map((m) => ({ owner: m.owner_id, label: m.owner_email || "Otra persona", role: m.role })),
  ];

  return {
    ready, error, spaces, myMembers, invites, refresh,
    createInvite: async (role: Role) => ((await call("create_data_invite", { p_role: role })) as InviteRow[])[0],
    acceptInvite: async (code: string) => ((await call("accept_data_invite", { p_code: code })) as { owner_id: string; owner_email: string; role: Role }[])[0],
    setRole: (member: string, role: Role) => call("set_data_member_role", { p_member: member, p_role: role }),
    removeMember: (owner: string, member: string) => call("remove_data_member", { p_owner: owner, p_member: member }),
    revokeInvite: (code: string) => call("revoke_data_invite", { p_code: code }),
  };
}

export type Spaces = ReturnType<typeof useSpaces>;
