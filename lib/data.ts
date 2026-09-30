// Datos de ejemplo, normalización (con migración de versiones anteriores)
// y cálculos. Se comparte entre el navegador y el servidor, así el backend
// valida lo mismo que el front.
import type {
  AppData,
  CategoryId,
  Expense,
  Market,
  MarketItem,
  Month,
  MonthSummary,
  Priority,
  WishItem,
} from "./types";
import { uid } from "./format";

// Paleta categórica validada (daltonismo y contraste) sobre el fondo oscuro.
// "Otros" usa gris neutro, como corresponde a la categoría de descarte.
export const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: "hogar", label: "Hogar", color: "#3987e5" },
  { id: "servicios", label: "Servicios", color: "#d95926" },
  { id: "comida", label: "Comida", color: "#199e70" },
  { id: "deudas", label: "Deudas", color: "#c98500" },
  { id: "transporte", label: "Transporte", color: "#d55181" },
  { id: "salud", label: "Salud", color: "#008300" },
  { id: "ocio", label: "Ocio", color: "#9085e9" },
  { id: "otros", label: "Otros", color: "#6b6b70" },
];
const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[7];
export const emptyByCategory = () =>
  Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<CategoryId, number>;

const KEYWORDS: [CategoryId, RegExp][] = [
  ["servicios", /luz|agua|gas|internet|entel|movistar|wom|claro|vtr|celular|tel[eé]fono|cable|enel/i],
  ["hogar", /casa|arriendo|dividendo|gastos? comunes|condominio|hogar|aseo/i],
  ["comida", /comida|feria|super|almuerzo|mercado|panader|carnicer|lider|jumbo|unimarc/i],
  ["deudas", /cmr|tarjeta|cr[eé]dito|pr[eé]stamo|deuda|cuota|ripley|paris|visa|mastercard/i],
  ["transporte", /uber|bencina|metro|bip|auto|micro|taxi|peaje|tag|estacionamiento|transporte/i],
  ["salud", /farmacia|doctor|m[eé]dic|isapre|fonasa|dentista|salud|remedio/i],
  ["ocio", /netflix|spotify|disney|hbo|cine|match|salida|juego|gimnasio|gym|viaje|ocio/i],
];
export function guessCategory(name: string): CategoryId {
  for (const [id, re] of KEYWORDS) if (re.test(name)) return id;
  return "otros";
}

// ---------- Fechas ----------
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
  "septiembre", "octubre", "noviembre", "diciembre"];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const currentPeriod = () => todayISO().slice(0, 7);

export function nextPeriod(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  let [y, m] = period.split("-").map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function periodName(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  const [y, m] = period.split("-").map(Number);
  return MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + " " + y;
}

function guessPeriod(label: string) {
  const l = (label || "").toLowerCase();
  const idx = MESES.findIndex((m) => l.includes(m) || l.startsWith(m.slice(0, 3)));
  if (idx < 0) return "";
  const year = l.match(/(20\d{2})/)?.[1] || String(new Date().getFullYear());
  return `${year}-${String(idx + 1).padStart(2, "0")}`;
}

/** Días entre hoy y una fecha "YYYY-MM-DD" (negativo = ya pasó). */
export function daysUntil(dateISO: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const [ty, tm, td] = todayISO().split("-").map(Number);
  return Math.round((target - Date.UTC(ty, tm - 1, td)) / 86400000);
}

export type DueStatus = { tone: "late" | "soon" | "ok"; text: string } | null;

export function dueStatus(item: Expense, period: string): DueStatus {
  if (item.paid || !item.dueDay || !/^\d{4}-\d{2}$/.test(period)) return null;
  const [y, m] = period.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const day = Math.min(item.dueDay, last);
  const diff = daysUntil(`${period}-${String(day).padStart(2, "0")}`)!;
  if (diff < 0) return { tone: "late", text: diff === -1 ? "Atrasada 1 día" : `Atrasada ${-diff} días` };
  if (diff === 0) return { tone: "soon", text: "Vence hoy" };
  if (diff <= 3) return { tone: "soon", text: diff === 1 ? "Vence mañana" : `Vence en ${diff} días` };
  return { tone: "ok", text: `Vence el ${day}` };
}

// ---------- Semilla ----------
const exp = (id: string, name: string, amount: number, category: CategoryId, fixed = true, dueDay: number | null = null): Expense =>
  ({ id, name, amount, paid: false, category, fixed, dueDay, installment: null });

export function seedData(): AppData {
  const period = currentPeriod();
  return {
    version: 4,
    activeId: "m1",
    months: [
      {
        id: "m1",
        label: periodName(period),
        period,
        incomes: [{ id: "s1", name: "Sueldo", amount: 940000 }],
        goal: 150000,
        items: [
          exp("i1", "Luz", 64000, "servicios", true, 20),
          exp("i2", "Entel", 31000, "servicios", true, 15),
          exp("i3", "Comida", 38000, "comida", false),
          exp("i4", "CMR", 120000, "deudas", true, 5),
          exp("i5", "Internet", 15000, "servicios", true, 10),
          exp("i6", "Agua", 10000, "servicios", true, 25),
          exp("i7", "Casa", 150000, "hogar", true, 1),
          exp("i8", "Feria", 100000, "comida", false),
          exp("i9", "Match", 100000, "ocio", false),
        ],
      },
    ],
    market: { items: [], templates: [], history: {} },
    wishlist: { items: [] },
  };
}

// ---------- Normalización ----------
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => Number(v) || 0;
const PRIORITIES: Priority[] = ["alta", "media", "baja"];
const FIXED_BY_DEFAULT: CategoryId[] = ["hogar", "servicios", "deudas"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeExpense(i: any): Expense {
  const name = str(i?.name);
  const category: CategoryId = CATEGORY_IDS.includes(i?.category) ? i.category : guessCategory(name);
  const inst = i?.installment;
  const total = Math.max(0, Math.floor(num(inst?.total)));
  const current = Math.min(Math.max(1, Math.floor(num(inst?.current)) || 1), total || 1);
  const dueDay = Math.floor(num(i?.dueDay));
  return {
    id: i?.id || uid(),
    name,
    amount: num(i?.amount),
    paid: !!i?.paid,
    category,
    // Al migrar datos antiguos, se asumen fijos solo hogar, servicios y deudas.
    fixed: typeof i?.fixed === "boolean" ? i.fixed : FIXED_BY_DEFAULT.includes(category),
    dueDay: dueDay >= 1 && dueDay <= 31 ? dueDay : null,
    installment: total >= 2 ? { current, total } : null,
  };
}

function normalizeMonth(m: any): Month {
  const label = str(m?.label, "Mes");
  const incomes = Array.isArray(m?.incomes)
    ? m.incomes.map((x: any) => ({ id: x?.id || uid(), name: str(x?.name, "Ingreso"), amount: num(x?.amount) }))
    : [{ id: uid(), name: "Sueldo", amount: num(m?.income) }];
  return {
    id: m?.id || uid(),
    label,
    period: /^\d{4}-\d{2}$/.test(m?.period) ? m.period : guessPeriod(label),
    incomes,
    goal: num(m?.goal),
    items: Array.isArray(m?.items) ? m.items.map(normalizeExpense) : [],
  };
}

function normalizeMarket(raw: any): Market {
  const items: MarketItem[] = Array.isArray(raw?.items)
    ? raw.items.map((i: any) => ({
        id: i?.id || uid(),
        name: str(i?.name),
        qty: Number(i?.qty) || 1,
        price: num(i?.price),
        done: !!i?.done,
      }))
    : [];
  const templates = Array.isArray(raw?.templates)
    ? raw.templates.map((t: any) => ({
        id: t?.id || uid(),
        name: str(t?.name, "Lista"),
        items: Array.isArray(t?.items)
          ? t.items.map((i: any) => ({ name: str(i?.name), qty: Number(i?.qty) || 1, price: num(i?.price) }))
          : [],
      }))
    : [];
  const history: Market["history"] = {};
  if (raw?.history && typeof raw.history === "object") {
    for (const [k, pts] of Object.entries(raw.history)) {
      if (!Array.isArray(pts)) continue;
      history[k] = pts
        .filter((p: any) => /^\d{4}-\d{2}-\d{2}$/.test(p?.date) && num(p?.price) > 0)
        .map((p: any) => ({ date: p.date, price: num(p.price) }))
        .slice(-24);
    }
  }
  return { items, templates, history };
}

function normalizeWish(i: any): WishItem {
  return {
    id: i?.id || uid(),
    name: str(i?.name),
    price: num(i?.price),
    urls: Array.isArray(i?.urls)
      ? i.urls.filter((u: unknown) => typeof u === "string")
      : typeof i?.url === "string" ? [i.url] : [""],
    done: !!i?.done,
    priority: PRIORITIES.includes(i?.priority) ? i.priority : "media",
    date: /^\d{4}-\d{2}-\d{2}$/.test(i?.date) ? i.date : "",
    saved: num(i?.saved),
  };
}

export function normalize(raw: any): AppData {
  const seed = seedData();
  if (!raw || typeof raw !== "object") return seed;
  const months: Month[] =
    Array.isArray(raw.months) && raw.months.length ? raw.months.map(normalizeMonth) : seed.months;
  const activeId = months.find((m) => m.id === raw.activeId) ? raw.activeId : months[0].id;
  return {
    version: 4,
    activeId,
    months,
    market: normalizeMarket(raw.market),
    wishlist: { items: Array.isArray(raw.wishlist?.items) ? raw.wishlist.items.map(normalizeWish) : [] },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- Cálculos ----------
export const monthIncome = (m: Month) => m.incomes.reduce((s, i) => s + (i.amount || 0), 0);

export function summarizeMonth(m: Month): MonthSummary {
  const income = monthIncome(m);
  const byCategory = emptyByCategory();
  let spent = 0;
  let paid = 0;
  for (const i of m.items) {
    spent += i.amount || 0;
    if (i.paid) paid += i.amount || 0;
    byCategory[i.category] += i.amount || 0;
  }
  return {
    id: m.id,
    label: m.label,
    period: m.period,
    income,
    spent,
    paid,
    pending: spent - paid,
    balance: income - spent,
    goal: m.goal,
    byCategory,
  };
}

/** Crea el mes siguiente: copia ingresos, meta, gastos fijos con su monto,
 *  cuotas pendientes (avanzando una) y el resto de gastos en $0. */
export function buildNextMonth(base: Month | undefined): Month {
  const period = base?.period ? nextPeriod(base.period) : currentPeriod();
  const items: Expense[] = [];
  for (const i of base?.items || []) {
    if (i.installment) {
      if (i.installment.current >= i.installment.total) continue;
      items.push({ ...i, id: uid(), paid: false, installment: { current: i.installment.current + 1, total: i.installment.total } });
    } else {
      items.push({ ...i, id: uid(), paid: false, amount: i.fixed ? i.amount : 0 });
    }
  }
  return {
    id: uid(),
    label: periodName(period) || "Nuevo mes",
    period,
    incomes: (base?.incomes || [{ id: "", name: "Sueldo", amount: 0 }]).map((x) => ({ ...x, id: uid() })),
    goal: base?.goal || 0,
    items,
  };
}

// ---------- Supermercado ----------
export const priceKey = (name: string) =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Registra el precio pagado hoy en el historial del producto. */
export function recordPrice(market: Market, name: string, price: number) {
  const key = priceKey(name);
  if (!key || price <= 0) return;
  const date = todayISO();
  const pts = (market.history[key] ||= []);
  const last = pts[pts.length - 1];
  if (last && last.date === date) last.price = price;
  else pts.push({ date, price });
  if (pts.length > 24) pts.splice(0, pts.length - 24);
}

/** Último precio registrado distinto de hoy, para comparar. */
export function previousPrice(market: Market, name: string) {
  const pts = market.history[priceKey(name)] || [];
  const today = todayISO();
  for (let i = pts.length - 1; i >= 0; i--) if (pts[i].date !== today) return pts[i];
  return null;
}
