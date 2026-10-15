// GET /api/keepalive → consulta mínima a la base (función ping) para que
// Supabase no pause el proyecto por inactividad. La llama Vercel Cron una vez
// al día (vercel.json). No lee ni escribe datos.
import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isConfigured) return NextResponse.json({ ok: false, error: "Supabase no está configurado." }, { status: 500 });
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ping`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    });
    return NextResponse.json({ ok: resp.ok, status: resp.status, time: new Date().toISOString() }, { status: resp.ok ? 200 : 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo conectar con Supabase." }, { status: 502 });
  }
}
