// GET  /api/data            → datos del usuario (crea los de ejemplo si no hay)
// GET  /api/data?owner=<id> → datos de otra persona que te los compartió (RLS decide)
// GET  /api/data?meta=1     → solo la fecha de la última versión (para detectar cambios)
// PUT  /api/data            → valida/normaliza y guarda. Si se envía `base` (la versión que
//                             tenías) y alguien guardó otra entre medio, responde 409.
import { NextResponse } from "next/server";
import { normalize, seedData } from "@/lib/data";
import { jsonError, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 3_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function targetOf(value: unknown, me: string): string | NextResponse {
  if (value === undefined || value === null || value === "" || value === me) return me;
  if (typeof value !== "string" || !UUID.test(value)) return jsonError("Dueño inválido.", 400);
  return value;
}

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;
  const url = new URL(req.url);
  const owner = targetOf(url.searchParams.get("owner"), user.id);
  if (owner instanceof NextResponse) return owner;
  const metaOnly = url.searchParams.get("meta") === "1";

  const { data, error } = await supabase
    .from("user_data")
    .select(metaOnly ? "updated_at" : "content, updated_at")
    .eq("user_id", owner)
    .maybeSingle<{ content?: unknown; updated_at: string }>();
  if (error) return jsonError("No se pudieron cargar los datos.", 500);

  if (metaOnly) {
    if (!data) return jsonError(owner === user.id ? "Sin datos." : "No tienes acceso a esos datos.", 404);
    return NextResponse.json({ updated_at: data.updated_at });
  }
  if (data?.content) return NextResponse.json({ content: normalize(data.content), updated_at: data.updated_at });
  if (owner !== user.id) return jsonError("No tienes acceso a esos datos.", 404);

  const content = seedData();
  const updated_at = new Date().toISOString();
  const { error: insertError } = await supabase.from("user_data").upsert({ user_id: user.id, content, updated_at });
  if (insertError) return jsonError("No se pudieron crear tus datos iniciales.", 500);
  return NextResponse.json({ content, updated_at });
}

export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const text = await req.text();
  if (text.length > MAX_BYTES) return jsonError("Los datos son demasiado grandes.", 413);

  let body: { content?: unknown; base?: unknown; owner?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError("JSON inválido.", 400);
  }
  if (!body || typeof body.content !== "object" || body.content === null) {
    return jsonError("Falta el campo content.", 400);
  }
  const owner = targetOf(body.owner, user.id);
  if (owner instanceof NextResponse) return owner;
  const base = typeof body.base === "string" && body.base ? body.base : null;

  const content = normalize(body.content);
  const updated_at = new Date().toISOString();

  if (owner === user.id && !base) {
    const { error } = await supabase.from("user_data").upsert({ user_id: user.id, content, updated_at });
    if (error) return jsonError("No se pudo guardar.", 500);
    return NextResponse.json({ ok: true, updated_at });
  }

  let q = supabase.from("user_data").update({ content, updated_at }).eq("user_id", owner);
  if (base) q = q.eq("updated_at", base);
  const { data: rows, error } = await q.select("updated_at");
  if (error) return jsonError("No se pudo guardar.", 500);
  if (rows && rows.length) return NextResponse.json({ ok: true, updated_at });

  // No se actualizó nada: o cambió la versión, o no tienes permiso para editar.
  const { data: current } = await supabase.from("user_data").select("updated_at").eq("user_id", owner).maybeSingle();
  if (!current) {
    if (owner !== user.id) return jsonError("No tienes acceso a esos datos.", 403);
    const { error: upErr } = await supabase.from("user_data").upsert({ user_id: user.id, content, updated_at });
    if (upErr) return jsonError("No se pudo guardar.", 500);
    return NextResponse.json({ ok: true, updated_at });
  }
  // El dueño siempre puede editar su fila, así que para él es siempre un choque de versiones.
  if (base && (owner === user.id || new Date(current.updated_at).getTime() !== new Date(base).getTime())) {
    return NextResponse.json({ error: "Los datos cambiaron en otro dispositivo.", conflict: true, updated_at: current.updated_at }, { status: 409 });
  }
  return jsonError("Solo tienes permiso para ver estos datos, no para cambiarlos.", 403);
}
