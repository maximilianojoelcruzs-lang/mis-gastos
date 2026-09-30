// Datos de ejemplo, normalización (con migración de versiones anteriores)
// y cálculos. Se comparte entre el navegador y el servidor, así el backend
// valida lo mismo que el front.
import type {
  AisleId, AppData, BenefitCard, Category, CategoryId, DailyExpense, Expense, FrequentProduct, Market, MarketItem, Month,
  MonthSummary, PaletteKey, PricePoint, Priority, Purchase, WishItem, YearSummary,
} from "./types";
import { uid } from "./format";

// ---------- Categorías ----------
// Los colores viven en el CSS (--p-<clave>) con una variante para tema oscuro
// y otra para claro, validadas para daltonismo y contraste.
export const PALETTE: { key: PaletteKey; label: string }[] = [
  { key: "blue", label: "Azul" },
  { key: "orange", label: "Naranja" },
  { key: "aqua", label: "Turquesa" },
  { key: "yellow", label: "Amarillo" },
  { key: "magenta", label: "Rosa" },
  { key: "green", label: "Verde" },
  { key: "violet", label: "Violeta" },
  { key: "red", label: "Rojo" },
  { key: "cyan", label: "Celeste" },
  { key: "slate", label: "Gris" },
];
const PALETTE_KEYS = PALETTE.map((p) => p.key);
export const catColor = (key: string) => `var(--p-${PALETTE_KEYS.includes(key as PaletteKey) ? key : "slate"})`;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "hogar", label: "Hogar", color: "blue" },
  { id: "servicios", label: "Servicios", color: "orange" },
  { id: "comida", label: "Comida", color: "aqua" },
  { id: "deudas", label: "Deudas", color: "yellow" },
  { id: "transporte", label: "Transporte", color: "magenta" },
  { id: "salud", label: "Salud", color: "green" },
  { id: "ocio", label: "Ocio", color: "violet" },
  { id: "otros", label: "Otros", color: "slate" },
];
const FALLBACK: Category = DEFAULT_CATEGORIES[7];

export const catOf = (categories: Category[], id: CategoryId): Category =>
  categories.find((c) => c.id === id) || categories.find((c) => c.id === "otros") || FALLBACK;

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const KEYWORDS: [CategoryId, RegExp][] = [
  ["servicios", /\bluz\b|\bagua\b|\bgas\b|internet|entel|movistar|\bwom\b|claro|\bvtr\b|celular|telefono|cable|enel|\bcge\b/],
  ["hogar", /casa|arriendo|dividendo|gastos? comunes|condominio|hogar|aseo|ferreteria|muebles?/],
  ["comida", /comida|feria|super|almuerzo|mercado|panader|carnicer|lider|jumbo|unimarc|cafe|almacen|kiosco|kiosko|snack|colacion|completo|sushi|pizza|helado|bebida|\bpan\b|empanada|desayuno|once|cena|restaurant|delivery|pedidosya|rappi/],
  ["deudas", /cmr|tarjeta|credito|prestamo|deuda|cuota|ripley|paris|visa|mastercard/],
  ["transporte", /uber|cabify|bencina|metro|\bbip\b|\bauto\b|micro|taxi|peaje|\btag\b|estacionamiento|transporte|pasaje/],
  ["salud", /farmacia|doctor|medic|isapre|fonasa|dentista|salud|remedio|examen|consulta/],
  ["ocio", /netflix|spotify|disney|hbo|cine|match|salida|juego|gimnasio|\bgym\b|viaje|ocio|bar\b|carrete|entradas?/],
];

/** Sugiere una categoría según el nombre; respeta las categorías propias del usuario. */
export function guessCategory(name: string, categories: Category[] = DEFAULT_CATEGORIES): CategoryId {
  const n = norm(name);
  if (!n) return "otros";
  for (const c of categories) {
    const l = norm(c.label);
    if (l.length >= 3 && c.id !== "otros" && n.includes(l)) return c.id;
  }
  for (const [id, re] of KEYWORDS) if (re.test(n) && categories.some((c) => c.id === id)) return id;
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

export function shiftPeriod(period: string, delta: number) {
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  const [y, m] = period.split("-").map(Number);
  const t = y * 12 + (m - 1) + delta;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const nextPeriod = (period: string) => shiftPeriod(period, 1);

export function periodName(period: string) {
  if (!/^\d{4}-\d{2}$/.test(period)) return "";
  const [y, m] = period.split("-").map(Number);
  return MESES[m - 1][0].toUpperCase() + MESES[m - 1].slice(1) + " " + y;
}

export const daysInPeriod = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

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
  const day = Math.min(item.dueDay, daysInPeriod(period));
  const diff = daysUntil(`${period}-${String(day).padStart(2, "0")}`)!;
  if (diff < 0) return { tone: "late", text: diff === -1 ? "Atrasada 1 día" : `Atrasada ${-diff} días` };
  if (diff === 0) return { tone: "soon", text: "Vence hoy" };
  if (diff <= 3) return { tone: "soon", text: diff === 1 ? "Vence mañana" : `Vence en ${diff} días` };
  return { tone: "ok", text: `Vence el ${day}` };
}

// ---------- Supermercado: pasillos y tiendas ----------
export const AISLES: { id: AisleId; label: string }[] = [
  { id: "frutas", label: "Frutas y verduras" },
  { id: "carnes", label: "Carnes y pescados" },
  { id: "lacteos", label: "Lácteos y huevos" },
  { id: "panaderia", label: "Panadería" },
  { id: "despensa", label: "Despensa" },
  { id: "bebidas", label: "Bebidas" },
  { id: "alcohol", label: "Licores y alcohol" },
  { id: "congelados", label: "Congelados" },
  { id: "aseo", label: "Aseo y hogar" },
  { id: "higiene", label: "Higiene y salud" },
  { id: "otros", label: "Otros" },
];
const AISLE_IDS = AISLES.map((a) => a.id);
export const aisleLabel = (id: AisleId) => AISLES.find((a) => a.id === id)?.label || "Otros";

// El orden importa: lo más específico primero.
const AISLE_KEYWORDS: [AisleId, RegExp][] = [
  ["congelados", /congelad|helado|pizza|nugget|papas fritas|hielo|hamburguesas? congel/],
  ["aseo", /detergente|cloro|lavaloza|papel higienico|toalla nova|\bnova\b|limpia|esponja|bolsas? (de )?basura|suavizante|desinfectante|virutilla|lysoform|aseo|pano|confort/],
  ["higiene", /shampoo|champu|jabon|pasta dental|dental|desodorante|cepillo|panal|pañal|protector|afeitar|crema corporal|acondicionador|paracetamol|remedio|alcohol|toallitas|algodon/],
  ["alcohol", /cerveza|vino|pisco|\bron\b|whisky|espumante|licor|vodka|gin\b|champagne|schop/],
  ["bebidas", /\bagua\b|jugo|bebida|coca|fanta|sprite|gaseosa|energetica|\bkem\b|nectar|isotonica/],
  ["lacteos", /leche|yogur|queso|mantequilla|huevo|crema|quesillo|manjar|margarina/],
  ["carnes", /pollo|carne|vacuno|cerdo|pescado|salmon|jamon|longaniza|salchicha|hamburguesa|molida|filete|costilla|pavo|atun|marisco|chorizo|tocino|mortadela|vienesa|pechuga|lomo/],
  ["frutas", /manzana|platano|banana|palta|tomate|lechuga|cebolla|papa\b|papas\b|zanahoria|limon|naranja|fruta|verdura|zapallo|pepino|\bajo\b|pimenton|uva|choclo|apio|espinaca|champi|pera\b|durazno|sandia|melon|frutilla|arandano|cilantro|perejil|aji\b|kiwi|mandarina|platano|brocoli|coliflor/],
  ["panaderia", /\bpan\b|marraqueta|hallulla|tortilla|torta|kuchen|queque|panader|pan de molde|croissant/],
  ["despensa", /arroz|fideo|aceite|azucar|\bsal\b|harina|lenteja|poroto|garbanzo|salsa|conserva|cereal|avena|\bcafe\b|\bte\b|mermelada|mayonesa|ketchup|especia|pure|sopa|galleta|chocolate|snack|mani|nuez|pasas|miel|vinagre|atun en lata/],
];

export function guessAisle(name: string): AisleId {
  const n = norm(name);
  if (!n) return "otros";
  for (const [id, re] of AISLE_KEYWORDS) if (re.test(n)) return id;
  return "otros";
}

// ---------- Tarjetas de alimentación ----------
// Las reglas reales dependen de cada tarjeta y comercio: estos pasillos son
// solo el valor inicial y se pueden cambiar tarjeta por tarjeta.
export const DEFAULT_CARD_AISLES: AisleId[] = ["frutas", "carnes", "lacteos", "panaderia", "despensa", "bebidas", "congelados"];

export const CARD_PRESETS: { name: string; color: PaletteKey }[] = [
  { name: "Amipass", color: "orange" },
  { name: "Sodexo", color: "blue" },
  { name: "Edenred", color: "green" },
  { name: "Otra tarjeta", color: "violet" },
];

export type PaymentSplit = {
  total: number;
  perCard: { card: BenefitCard; used: number; left: number }[];
  /** Lo que pagan las tarjetas. */
  covered: number;
  /** Lo que sale de tu bolsillo. */
  pocket: number;
  /** De ese bolsillo: productos que ninguna tarjeta activa acepta… */
  notAccepted: number;
  /** …y lo que excede el saldo de las tarjetas. */
  overflow: number;
  /** Pasillos con productos que no acepta ninguna tarjeta activa. */
  rejectedAisles: AisleId[];
};

/** Reparte la compra entre las tarjetas activas (en orden) y tu bolsillo. */
export function splitPayment(items: MarketItem[], cards: BenefitCard[]): PaymentSplit {
  const active = cards.filter((c) => c.use);
  const lines = items
    .map((i) => ({ aisle: i.aisle, amount: Math.max(0, (Number(i.price) || 0) * (Number(i.qty) || 1)) }))
    .filter((l) => l.amount > 0);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const rejected = lines.filter((l) => !active.some((c) => c.aisles.includes(l.aisle)));
  const notAccepted = rejected.reduce((s, l) => s + l.amount, 0);
  const remain = lines.map((l) => ({ ...l }));
  const perCard = active.map((card) => {
    let bal = Math.max(0, card.balance);
    let used = 0;
    for (const r of remain) {
      if (bal <= 0) break;
      if (r.amount <= 0 || !card.aisles.includes(r.aisle)) continue;
      const take = Math.min(r.amount, bal);
      r.amount -= take;
      bal -= take;
      used += take;
    }
    return { card, used, left: Math.max(0, card.balance) - used };
  });
  const covered = perCard.reduce((s, p) => s + p.used, 0);
  return {
    total,
    perCard,
    covered,
    pocket: total - covered,
    notAccepted,
    overflow: Math.max(0, total - covered - notAccepted),
    rejectedAisles: [...new Set(rejected.map((l) => l.aisle))],
  };
}

export const DEFAULT_STORES = ["Líder", "Jumbo", "Unimarc", "Santa Isabel", "Tottus"];

export const priceKey = (name: string) => norm(name);

/** Registra el precio observado hoy (uno por producto, día y tienda). */
export function recordPrice(market: Market, name: string, price: number, store = "") {
  const key = priceKey(name);
  if (!key || price <= 0) return;
  const date = todayISO();
  const pts = (market.history[key] ||= []);
  const same = pts.find((p) => p.date === date && p.store === store);
  if (same) same.price = price;
  else pts.push({ date, price, store });
  pts.sort((a, b) => a.date.localeCompare(b.date));
  if (pts.length > 60) pts.splice(0, pts.length - 60);
}

/** Último precio conocido en cada tienda. */
export function latestByStore(market: Market, name: string): Record<string, PricePoint> {
  const out: Record<string, PricePoint> = {};
  for (const p of market.history[priceKey(name)] || []) {
    if (!p.store) continue;
    if (!out[p.store] || p.date >= out[p.store].date) out[p.store] = p;
  }
  return out;
}

/** Último precio de un día anterior (misma tienda si se indica). */
export function previousPrice(market: Market, name: string, store = "") {
  const pts = market.history[priceKey(name)] || [];
  const today = todayISO();
  const pick = (only: boolean) => {
    for (let i = pts.length - 1; i >= 0; i--) if (pts[i].date !== today && (!only || pts[i].store === store)) return pts[i];
    return null;
  };
  return (store ? pick(true) : null) || pick(false);
}

export type StoreQuote = { store: string; total: number; covered: number; count: number };

/** ¿Cuánto costaría toda la lista en cada tienda, según los últimos precios conocidos? */
export function storeComparison(market: Market): { quotes: StoreQuote[]; best: string | null; count: number } {
  const items = market.items.filter((i) => i.name.trim());
  const quotes = market.stores.map((store) => {
    let total = 0;
    let covered = 0;
    for (const it of items) {
      const p = latestByStore(market, it.name)[store];
      if (p) {
        total += p.price * (it.qty || 1);
        covered++;
      }
    }
    return { store, total, covered, count: items.length };
  });
  const maxCovered = Math.max(0, ...quotes.map((q) => q.covered));
  const comparable = quotes.filter((q) => q.covered === maxCovered && q.covered > 0);
  const best = comparable.length > 1 ? comparable.reduce((a, b) => (b.total < a.total ? b : a)).store : null;
  return { quotes: quotes.sort((a, b) => b.covered - a.covered || a.total - b.total), best, count: items.length };
}

// ---------- Semilla ----------
const exp = (id: string, name: string, amount: number, category: CategoryId, fixed = true, dueDay: number | null = null): Expense =>
  ({ id, name, amount, paid: false, category, fixed, dueDay, installment: null });

export function seedMarket(): Market {
  return { items: [], templates: [], history: {}, stores: [...DEFAULT_STORES], store: "", cards: [], budget: 0, purchases: [], frequent: {}, shared: null };
}

export function seedData(): AppData {
  const period = currentPeriod();
  return {
    version: 5,
    activeId: "m1",
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
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
    daily: [],
    market: seedMarket(),
    wishlist: { items: [] },
  };
}

// ---------- Normalización ----------
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => Number(v) || 0;
const PRIORITIES: Priority[] = ["alta", "media", "baja"];
const FIXED_BY_DEFAULT: CategoryId[] = ["hogar", "servicios", "deudas"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalizeCategories(raw: any): Category[] {
  const out: Category[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const c of raw) {
      const id = str(c?.id);
      const label = str(c?.label).trim().slice(0, 30);
      if (!id || !label || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label, color: PALETTE_KEYS.includes(c?.color) ? c.color : "slate" });
    }
  }
  if (!out.length) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  if (!seen.has("otros")) out.push({ ...FALLBACK });
  return out;
}

function pickCategory(value: any, name: string, categories: Category[]): CategoryId {
  if (typeof value === "string" && categories.some((c) => c.id === value)) return value;
  return guessCategory(name, categories);
}

function normalizeExpense(i: any, categories: Category[]): Expense {
  const name = str(i?.name);
  const category = pickCategory(i?.category, name, categories);
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

function normalizeMonth(m: any, categories: Category[]): Month {
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
    items: Array.isArray(m?.items) ? m.items.map((i: any) => normalizeExpense(i, categories)) : [],
  };
}

function normalizeDaily(d: any, categories: Category[]): DailyExpense {
  const name = str(d?.name);
  return {
    id: d?.id || uid(),
    date: isDate(d?.date) ? d.date : todayISO(),
    name,
    amount: num(d?.amount),
    category: pickCategory(d?.category, name, categories),
    card: str(d?.card),
    cardAmount: str(d?.card) ? Math.min(Math.max(0, num(d?.cardAmount)), num(d?.amount)) : 0,
  };
}

function normalizeMarket(raw: any): Market {
  const items: MarketItem[] = Array.isArray(raw?.items)
    ? raw.items.map((i: any) => {
        const name = str(i?.name);
        return {
          id: i?.id || uid(),
          name,
          qty: Number(i?.qty) || 1,
          price: num(i?.price),
          done: !!i?.done,
          aisle: AISLE_IDS.includes(i?.aisle) ? i.aisle : guessAisle(name),
        };
      })
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
        .filter((p: any) => isDate(p?.date) && num(p?.price) > 0)
        .map((p: any) => ({ date: p.date, price: num(p.price), store: str(p?.store).slice(0, 30) }))
        .slice(-60);
    }
  }
  const stores = Array.isArray(raw?.stores)
    ? [...new Set<string>(raw.stores.filter((s: unknown) => typeof s === "string" && s.trim()).map((s: string) => s.trim().slice(0, 30)))]
    : [...DEFAULT_STORES];
  const store = typeof raw?.store === "string" && stores.includes(raw.store) ? raw.store : "";
  const cards: BenefitCard[] = Array.isArray(raw?.cards)
    ? raw.cards.map((c: any) => ({
        id: c?.id || uid(),
        name: str(c?.name, "Tarjeta").trim().slice(0, 30) || "Tarjeta",
        balance: Math.max(0, num(c?.balance)),
        aisles: Array.isArray(c?.aisles) ? c.aisles.filter((a: unknown) => AISLE_IDS.includes(a as AisleId)) : [...DEFAULT_CARD_AISLES],
        color: PALETTE_KEYS.includes(c?.color) ? c.color : "violet",
        use: !!c?.use,
      }))
    : [];
  const purchases: Purchase[] = Array.isArray(raw?.purchases)
    ? raw.purchases
        .filter((p: any) => isDate(p?.date))
        .map((p: any) => ({
          id: p?.id || uid(), date: p.date, total: num(p?.total), card: num(p?.card), pocket: num(p?.pocket),
          store: str(p?.store).slice(0, 30), count: Math.floor(num(p?.count)),
        }))
        .slice(-200)
    : [];
  const frequent: Record<string, FrequentProduct> = {};
  if (raw?.frequent && typeof raw.frequent === "object") {
    for (const [k, f] of Object.entries<any>(raw.frequent)) {
      const dates = Array.isArray(f?.dates) ? [...new Set<string>(f.dates.filter(isDate))].sort().slice(-24) : [];
      if (!k || !dates.length) continue;
      frequent[k] = { name: str(f?.name, k).slice(0, 60), qty: Math.max(1, Math.floor(num(f?.qty)) || 1), price: num(f?.price), dates };
    }
  }
  const sh = raw?.shared;
  const shared = sh && typeof sh.id === "string" && sh.id && typeof sh.code === "string"
    ? { id: sh.id, name: str(sh.name, "Lista compartida").slice(0, 40), code: sh.code } : null;
  return {
    items, templates, history, stores, store, cards,
    budget: Math.max(0, num(raw?.budget)), purchases, frequent: trimFrequent(frequent), shared,
  };
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
    date: isDate(i?.date) ? i.date : "",
    saved: num(i?.saved),
  };
}

export function normalize(raw: any): AppData {
  const seed = seedData();
  if (!raw || typeof raw !== "object") return seed;
  const categories = normalizeCategories(raw.categories);
  const months: Month[] =
    Array.isArray(raw.months) && raw.months.length ? raw.months.map((m: any) => normalizeMonth(m, categories)) : seed.months;
  const activeId = months.find((m) => m.id === raw.activeId) ? raw.activeId : months[months.length - 1].id;
  return {
    version: 5,
    activeId,
    categories,
    months,
    daily: Array.isArray(raw.daily) ? raw.daily.map((d: any) => normalizeDaily(d, categories)) : [],
    market: normalizeMarket(raw.market),
    wishlist: { items: Array.isArray(raw.wishlist?.items) ? raw.wishlist.items.map(normalizeWish) : [] },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------- Cálculos ----------
export const monthIncome = (m: Month) => m.incomes.reduce((s, i) => s + (i.amount || 0), 0);

/** Resume un mes. Los gastos diarios se suman según el mes calendario (`period`). */
export function summarizeMonth(m: Month, daily: DailyExpense[] = []): MonthSummary {
  const income = monthIncome(m);
  const byCategory: Record<CategoryId, number> = {};
  let bills = 0;
  let paid = 0;
  for (const i of m.items) {
    bills += i.amount || 0;
    if (i.paid) paid += i.amount || 0;
    byCategory[i.category] = (byCategory[i.category] || 0) + (i.amount || 0);
  }
  // Los gastos diarios pagados con tarjeta de alimentación no salen de tu sueldo:
  // solo cuenta la parte que pagaste de tu bolsillo.
  let dailyTotal = 0;
  let dailyCard = 0;
  if (m.period) {
    for (const d of daily) {
      if (!d.date.startsWith(m.period)) continue;
      const card = Math.min(d.cardAmount || 0, d.amount || 0);
      const pocket = (d.amount || 0) - card;
      dailyTotal += pocket;
      dailyCard += card;
      byCategory[d.category] = (byCategory[d.category] || 0) + pocket;
    }
  }
  const spent = bills + dailyTotal;
  return {
    id: m.id,
    label: m.label,
    period: m.period,
    income,
    bills,
    daily: dailyTotal,
    dailyCard,
    spent,
    paid,
    pending: bills - paid,
    balance: income - spent,
    goal: m.goal,
    byCategory,
  };
}

export const summarizeAll = (data: AppData) => data.months.map((m) => summarizeMonth(m, data.daily));

export function yearsOf(data: AppData): string[] {
  const set = new Set<string>();
  for (const m of data.months) if (m.period) set.add(m.period.slice(0, 4));
  return [...set].sort();
}

export function summarizeYear(data: AppData, year: string): YearSummary {
  const months = summarizeAll(data).filter((m) => m.period.startsWith(year));
  const sum = (f: (m: MonthSummary) => number) => months.reduce((s, m) => s + f(m), 0);
  const income = sum((m) => m.income);
  const spent = sum((m) => m.spent);
  const byCategory: Record<CategoryId, number> = {};
  for (const m of months) for (const [k, v] of Object.entries(m.byCategory)) byCategory[k] = (byCategory[k] || 0) + v;
  const withData = months.filter((m) => m.spent > 0 || m.income > 0);
  return {
    year,
    months,
    income,
    spent,
    bills: sum((m) => m.bills),
    daily: sum((m) => m.daily),
    balance: income - spent,
    rate: income > 0 ? Math.round(((income - spent) / income) * 100) : 0,
    avgSpent: withData.length ? spent / withData.length : 0,
    biggestMonth: months.length ? months.reduce((a, b) => (b.spent > a.spent ? b : a)) : null,
    bestMonth: months.length ? months.reduce((a, b) => (b.balance > a.balance ? b : a)) : null,
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

/** Gastos diarios frecuentes (mismo nombre repetido) para registrarlos con un toque. */
export function frequentDaily(daily: DailyExpense[], limit = 6) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const min = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  const map = new Map<string, { name: string; amount: number; category: CategoryId; count: number; last: string }>();
  for (const d of daily) {
    if (d.date < min || !d.name.trim()) continue;
    const k = norm(d.name);
    const cur = map.get(k);
    if (!cur) map.set(k, { name: d.name, amount: d.amount, category: d.category, count: 1, last: d.date });
    else {
      cur.count++;
      if (d.date >= cur.last) Object.assign(cur, { amount: d.amount, category: d.category, last: d.date, name: d.name });
    }
  }
  return [...map.values()].filter((f) => f.count >= 2).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, limit);
}

// ---------- Presupuesto, productos frecuentes y compras ----------
const MAX_FREQUENT = 150;

function trimFrequent(f: Record<string, FrequentProduct>) {
  const keys = Object.keys(f);
  if (keys.length <= MAX_FREQUENT) return f;
  const keep = keys
    .sort((a, b) => f[b].dates.length - f[a].dates.length || f[b].dates[f[b].dates.length - 1].localeCompare(f[a].dates[f[a].dates.length - 1]))
    .slice(0, MAX_FREQUENT);
  return Object.fromEntries(keep.map((k) => [k, f[k]]));
}

/** Anota que hoy compraste este producto (cuenta un día por producto). */
export function recordFrequent(market: Market, item: { name: string; qty: number; price: number }) {
  const key = priceKey(item.name);
  if (!key) return;
  const today = todayISO();
  const cur = (market.frequent[key] ||= { name: item.name, qty: item.qty || 1, price: item.price || 0, dates: [] });
  cur.name = item.name;
  cur.qty = item.qty || 1;
  if (item.price > 0) cur.price = item.price;
  if (!cur.dates.includes(today)) cur.dates.push(today);
  if (cur.dates.length > 24) cur.dates.splice(0, cur.dates.length - 24);
  market.frequent = trimFrequent(market.frequent);
}

/** Productos que compras seguido (2 días distintos o más), los más habituales primero. */
export function frequentProducts(market: Market, limit = 12) {
  return Object.entries(market.frequent)
    .map(([key, f]) => ({ key, ...f, times: f.dates.length, last: f.dates[f.dates.length - 1] }))
    .filter((f) => f.times >= 2)
    .sort((a, b) => b.times - a.times || b.last.localeCompare(a.last))
    .slice(0, limit);
}

/** Gasto del súper (tarjeta + bolsillo) en un mes "YYYY-MM". */
export function superSpent(market: Market, period: string) {
  return market.purchases.filter((p) => p.date.startsWith(period)).reduce((s, p) => s + p.total, 0);
}

export function logPurchase(market: Market, p: Omit<Purchase, "id" | "date">) {
  market.purchases.push({ id: uid(), date: todayISO(), ...p });
  if (market.purchases.length > 200) market.purchases.splice(0, market.purchases.length - 200);
}

/** Precio sugerido para un producto: el de la tienda elegida, el último conocido o el habitual. */
export function suggestedPrice(market: Market, name: string): number {
  const key = priceKey(name);
  if (!key) return 0;
  const byStore = latestByStore(market, name);
  if (market.store && byStore[market.store]) return byStore[market.store].price;
  const pts = market.history[key] || [];
  if (pts.length) return pts[pts.length - 1].price;
  return market.frequent[key]?.price || 0;
}

/** Agrega productos a la lista; si ya está (y no está en el carro) suma la cantidad. */
export function addProducts(market: Market, list: { name: string; qty: number }[]) {
  let changed = 0;
  for (const p of list) {
    const key = priceKey(p.name);
    if (!key) continue;
    const existing = market.items.find((i) => priceKey(i.name) === key && !i.done);
    if (existing) existing.qty = (existing.qty || 1) + (p.qty || 1);
    else
      market.items.push({
        id: uid(), name: p.name, qty: p.qty || 1, price: suggestedPrice(market, p.name), done: false, aisle: guessAisle(p.name),
      });
    changed++;
  }
  return changed;
}

/** Marca un producto como comprado y guarda su precio e historial. */
export function markBought(market: Market, it: MarketItem) {
  it.done = true;
  recordPrice(market, it.name, it.price, market.store);
  recordFrequent(market, it);
}

/** Marca o desmarca un producto del carro. */
export function toggleItem(market: Market, id: string) {
  const it = market.items.find((i) => i.id === id);
  if (!it) return;
  if (it.done) it.done = false;
  else markBought(market, it);
}

// ---------- Gastos diarios pagados con tarjeta ----------
/** Descuenta de la tarjeta lo que alcance y devuelve cuánto cubrió. */
export function chargeCard(market: Market, cardId: string, amount: number) {
  const card = market.cards.find((c) => c.id === cardId);
  if (!card || amount <= 0) return 0;
  const covered = Math.min(Math.max(0, card.balance), amount);
  card.balance -= covered;
  return covered;
}

/** Devuelve a la tarjeta lo que cubrió (al borrar o achicar un gasto). */
export function refundCard(market: Market, cardId: string, amount: number) {
  const card = market.cards.find((c) => c.id === cardId);
  if (card && amount > 0) card.balance += amount;
}
