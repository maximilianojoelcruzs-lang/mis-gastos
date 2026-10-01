// GET  /api/data            → datos del usuario (crea los de ejemplo si no hay)
// GET  /api/data?owner=<id> → datos de otra persona que te los compartió (RLS decide)
// GET  /api/data?meta=1     → solo la fecha de la última versión (para detectar cambios)
// PUT  /api/data            → valida/normaliza y guarda. Si se envía `base` (la versión que
//                             tenías) y alguien guardó otra entre medio, responde 409.
//                             Devuelve la versión que quedó guardada en la base.
import { NextResponse } from "next/server";
import { normalize, seedData } from "@/lib/data";
import { instant } from "@/lib/format";
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
  const { data: row, error: insertError } = await supabase
    .from("user_data").upsert({ user_id: user.id, content, updated_at }).select("updated_at").maybeSingle<{ updated_at: string }>();
  if (insertError) return jsonError("No se pudieron crear tus datos iniciales.", 500);
  return NextResponse.json({ content, updated_at: row?.updated_at || updated_at });
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

  const { data: current, error: readError } = await supabase
    .from("user_data").select("updated_at").eq("user_id", owner).maybeSingle<{ updated_at: string }>();
  if (readError) return jsonError("No se pudo guardar.", 500);

  if (!current) {
    if (owner !== user.id) return jsonError("No tienes acceso a esos datos.", 403);
    const { data: row, error } = await supabase
      .from("user_data").upsert({ user_id: user.id, content, updated_at }).select("updated_at").maybeSingle<{ updated_at: string }>();
    if (error) return jsonError("No se pudo guardar.", 500);
    return NextResponse.json({ ok: true, updated_at: row?.updated_at || updated_at });
  }

  // Se compara el instante (no el texto): la base puede devolver otro formato o precisión.
  if (base && instant(current.updated_at) !== instant(base)) {
    return NextResponse.json({ error: "Los datos cambiaron en otro dispositivo.", conflict: true, updated_at: current.updated_at }, { status: 409 });
  }

  const { data: rows, error } = await supabase
    .from("user_data").update({ content, updated_at }).eq("user_id", owner).select("updated_at");
  if (error) return jsonError("No se pudo guardar.", 500);
  if (!rows || !rows.length) return jsonError("Solo tienes permiso para ver estos datos, no para cambiarlos.", 403);
  // Se devuelve la versión que quedó guardada (un trigger de la tabla puede haberla cambiado).
  return NextResponse.json({ ok: true, updated_at: (rows[0] as { updated_at: string }).updated_at || updated_at });
}
