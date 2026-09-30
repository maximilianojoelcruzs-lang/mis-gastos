/** Colores disponibles para categorías (los valores viven en el CSS, con variante clara y oscura). */
export type PaletteKey =
  | "blue" | "orange" | "aqua" | "yellow" | "magenta"
  | "green" | "violet" | "red" | "cyan" | "slate";

export type CategoryId = string;

export type Category = { id: CategoryId; label: string; color: PaletteKey };

export type Installment = { current: number; total: number };

export type Expense = {
  id: string;
  name: string;
  amount: number;
  paid: boolean;
  category: CategoryId;
  /** Gasto fijo: se copia con su monto al crear un mes nuevo. */
  fixed: boolean;
  /** Día del mes en que vence (1–31) o null. */
  dueDay: number | null;
  /** Compra en cuotas: cuota actual y total. */
  installment: Installment | null;
};

export type Income = { id: string; name: string; amount: number };

export type Month = {
  id: string;
  label: string;
  /** Mes calendario "YYYY-MM" ("" si no se conoce). */
  period: string;
  incomes: Income[];
  /** Meta de ahorro del mes. */
  goal: number;
  items: Expense[];
};

/** Micro-gasto del día a día (café, almacén, micro…). */
export type DailyExpense = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  name: string;
  amount: number;
  category: CategoryId;
};

export type AisleId =
  | "frutas" | "carnes" | "lacteos" | "panaderia" | "despensa"
  | "bebidas" | "alcohol" | "congelados" | "aseo" | "higiene" | "otros";

export type MarketItem = {
  id: string;
  name: string;
  qty: number;
  price: number;
  done: boolean;
  aisle: AisleId;
};

/** Tarjeta de alimentación (Amipass, Sodexo/Pluxee, Edenred…) con saldo y pasillos que acepta. */
export type BenefitCard = {
  id: string;
  name: string;
  /** Saldo disponible. */
  balance: number;
  /** Pasillos donde se puede pagar con esta tarjeta. */
  aisles: AisleId[];
  color: PaletteKey;
  /** ¿Se usa en la compra actual? */
  use: boolean;
};

export type MarketTemplate = { id: string; name: string; items: { name: string; qty: number; price: number }[] };

/** Precio observado de un producto; `store` vacío = tienda no registrada. */
export type PricePoint = { date: string; price: number; store: string };

export type Market = {
  items: MarketItem[];
  templates: MarketTemplate[];
  /** Historial de precios por producto (clave normalizada). */
  history: Record<string, PricePoint[]>;
  /** Supermercados que comparas. */
  stores: string[];
  /** Dónde estás comprando hoy ("" = sin elegir). */
  store: string;
  /** Tarjetas de alimentación para repartir la compra entre la tarjeta y tu bolsillo. */
  cards: BenefitCard[];
};

export type Priority = "alta" | "media" | "baja";

export type WishItem = {
  id: string;
  name: string;
  price: number;
  urls: string[];
  done: boolean;
  priority: Priority;
  /** Fecha objetivo "YYYY-MM-DD" ("" si no tiene). */
  date: string;
  /** Lo que ya llevas ahorrado para esta compra. */
  saved: number;
};

export type AppData = {
  version: 5;
  activeId: string;
  categories: Category[];
  months: Month[];
  daily: DailyExpense[];
  market: Market;
  wishlist: { items: WishItem[] };
};

export type MonthSummary = {
  id: string;
  label: string;
  period: string;
  income: number;
  /** Cuentas del mes (gastos mensuales). */
  bills: number;
  /** Gastos diarios del mes calendario. */
  daily: number;
  /** bills + daily */
  spent: number;
  /** De las cuentas: lo ya pagado / lo que falta. */
  paid: number;
  pending: number;
  balance: number;
  goal: number;
  /** Cuentas + diarios por categoría. */
  byCategory: Record<CategoryId, number>;
};

export type YearSummary = {
  year: string;
  months: MonthSummary[];
  income: number;
  spent: number;
  bills: number;
  daily: number;
  balance: number;
  rate: number;
  avgSpent: number;
  biggestMonth: MonthSummary | null;
  bestMonth: MonthSummary | null;
  byCategory: Record<CategoryId, number>;
};
