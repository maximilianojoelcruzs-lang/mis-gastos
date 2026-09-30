// GET /api/health → estado del servicio (útil para monitoreo).
import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isConfigured,
    gemini: !!process.env.GEMINI_API_KEY,
    time: new Date().toISOString(),
  });
}
