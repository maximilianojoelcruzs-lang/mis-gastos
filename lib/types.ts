export type CategoryId =
  | "hogar"
  | "servicios"
  | "comida"
  | "deudas"
  | "transporte"
  | "salud"
  | "ocio"
  | "otros";

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

export type MarketItem = { id: string; name: string; qty: number; price: number; done: boolean };

export type MarketTemplate = { id: string; name: string; items: { name: string; qty: number; price: number }[] };

export type PricePoint = { date: string; price: number };

export type Market = {
  items: MarketItem[];
  templates: MarketTemplate[];
  /** Historial de precios por producto (clave normalizada). */
  history: Record<string, PricePoint[]>;
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
  version: 4;
  activeId: string;
  months: Month[];
  market: Market;
  wishlist: { items: WishItem[] };
};

export type MonthSummary = {
  id: string;
  label: string;
  period: string;
  income: number;
  spent: number;
  paid: number;
  pending: number;
  balance: number;
  goal: number;
  byCategory: Record<CategoryId, number>;
};
