// GET /api/buscar-precio?q=producto → precio más bajo en Chile según Gemini.
// Ahora exige sesión iniciada para que nadie más gaste tu cuota de Gemini.
import { NextResponse } from "next/server";
import { GeminiError, buscarPrecio } from "@/lib/gemini";
import { jsonError, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;

  const q = (new URL(req.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) return jsonError("Falta el nombre del producto.", 400);

  try {
    const lookup = await buscarPrecio(q);
    return NextResponse.json({ ok: true, ...lookup });
  } catch (e) {
    if (e instanceof GeminiError) return jsonError(e.message, e.status);
    return jsonError("Falló la consulta a la IA.", 500);
  }
}
