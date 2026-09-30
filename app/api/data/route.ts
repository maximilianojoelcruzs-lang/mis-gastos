// GET  /api/data  → devuelve los datos del usuario (crea los de ejemplo si no hay)
// PUT  /api/data  → valida/normaliza y guarda los datos del usuario
import { NextResponse } from "next/server";
import { normalize, seedData } from "@/lib/data";
import { jsonError, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_000_000;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("user_data")
    .select("content, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return jsonError("No se pudieron cargar tus datos.", 500);

  if (data?.content) {
    return NextResponse.json({ content: normalize(data.content), updated_at: data.updated_at });
  }

  const content = seedData();
  const { error: insertError } = await supabase.from("user_data").upsert({ user_id: user.id, content });
  if (insertError) return jsonError("No se pudieron crear tus datos iniciales.", 500);
  return NextResponse.json({ content, updated_at: null });
}

export async function PUT(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const text = await req.text();
  if (text.length > MAX_BYTES) return jsonError("Los datos son demasiado grandes.", 413);

  let body: { content?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError("JSON inválido.", 400);
  }
  if (!body || typeof body.content !== "object" || body.content === null) {
    return jsonError("Falta el campo content.", 400);
  }

  const content = normalize(body.content);
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from("user_data").upsert({ user_id: user.id, content, updated_at });
  if (error) return jsonError("No se pudo guardar.", 500);

  return NextResponse.json({ ok: true, updated_at });
}
