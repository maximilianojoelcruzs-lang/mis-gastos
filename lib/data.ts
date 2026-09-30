// Datos de ejemplo, normalización y cálculos. Se comparte entre el
// navegador y el servidor, así el backend valida lo mismo que el front.
import type { AppData, Month, MonthSummary } from "./types";
import { uid } from "./format";

export function seedData(): AppData {
  return {
    version: 3,
    activeId: "dic2024",
    months: [
      {
        id: "dic2024",
        label: "Diciembre",
        income: 940000,
        items: [
          { id: "i1", name: "Luz", amount: 64000, paid: false },
          { id: "i2", name: "Entel", amount: 31000, paid: false },
          { id: "i3", name: "Comida", amount: 38000, paid: false },
          { id: "i4", name: "CMR", amount: 120000, paid: false },
          { id: "i5", name: "Internet", amount: 15000, paid: false },
          { id: "i6", name: "Agua", amount: 10000, paid: false },
          { id: "i7", name: "Casa", amount: 150000, paid: false },
          { id: "i8", name: "Feria", amount: 100000, paid: false },
          { id: "i9", name: "Match", amount: 100000, paid: false },
        ],
      },
    ],
    market: { items: [] },
    wishlist: { items: [] },
  };
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => Number(v) || 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalize(raw: any): AppData {
  const seed = seedData();
  if (!raw || typeof raw !== "object") return seed;

  const months: Month[] =
    Array.isArray(raw.months) && raw.months.length
      ? raw.months.map((m: any) => ({
          id: m?.id || uid(),
          label: str(m?.label, "Mes"),
          income: num(m?.income),
          items: Array.isArray(m?.items)
            ? m.items.map((i: any) => ({
                id: i?.id || uid(),
                name: str(i?.name),
                amount: num(i?.amount),
                paid: !!i?.paid,
              }))
            : [],
        }))
      : seed.months;

  const activeId = months.find((m) => m.id === raw.activeId) ? raw.activeId : months[0].id;

  const market = {
    items: Array.isArray(raw.market?.items)
      ? raw.market.items.map((i: any) => ({
          id: i?.id || uid(),
          name: str(i?.name),
          qty: Number(i?.qty) || 1,
          price: num(i?.price),
          done: !!i?.done,
        }))
      : [],
  };

  const wishlist = {
    items: Array.isArray(raw.wishlist?.items)
      ? raw.wishlist.items.map((i: any) => ({
          id: i?.id || uid(),
          name: str(i?.name),
          price: num(i?.price),
          urls: Array.isArray(i?.urls)
            ? i.urls.filter((u: unknown) => typeof u === "string")
            : typeof i?.url === "string"
              ? [i.url]
              : [""],
          done: !!i?.done,
        }))
      : [],
  };

  return { version: 3, activeId, months, market, wishlist };
}

export function summarizeMonth(m: Month): MonthSummary {
  const spent = m.items.reduce((s, i) => s + (i.amount || 0), 0);
  const paid = m.items.reduce((s, i) => s + (i.paid ? i.amount || 0 : 0), 0);
  return {
    id: m.id,
    label: m.label,
    income: m.income || 0,
    spent,
    paid,
    pending: spent - paid,
    balance: (m.income || 0) - spent,
  };
}
