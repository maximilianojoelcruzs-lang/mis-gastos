// GET /api/resumen → totales por mes y acumulados (ingresos, gastos, ahorro,
// lo pagado y lo pendiente). Útil para gráficos, reportes o integraciones.
import { NextResponse } from "next/server";
import { normalize, summarizeMonth } from "@/lib/data";
import { jsonError, requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (auth instanceof NextResponse) return auth;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("user_data")
    .select("content")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return jsonError("No se pudieron cargar tus datos.", 500);

  const content = normalize(data?.content);
  const months = content.months.map(summarizeMonth);
  const totals = months.reduce(
    (t, m) => ({
      income: t.income + m.income,
      spent: t.spent + m.spent,
      paid: t.paid + m.paid,
      pending: t.pending + m.pending,
      balance: t.balance + m.balance,
    }),
    { income: 0, spent: 0, paid: 0, pending: 0, balance: 0 }
  );

  const market = content.market.items;
  const wish = content.wishlist.items.filter((i) => !i.done);

  return NextResponse.json({
    months,
    totals,
    market: {
      items: market.length,
      done: market.filter((i) => i.done).length,
      estimated: market.reduce((s, i) => s + i.price * (i.qty || 1), 0),
    },
    wishlist: { pending: wish.length, estimated: wish.reduce((s, i) => s + i.price, 0) },
  });
}
