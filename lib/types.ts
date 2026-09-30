export type Expense = { id: string; name: string; amount: number; paid: boolean };

export type Month = { id: string; label: string; income: number; items: Expense[] };

export type MarketItem = { id: string; name: string; qty: number; price: number; done: boolean };

export type WishItem = { id: string; name: string; price: number; urls: string[]; done: boolean };

export type AppData = {
  version: 3;
  activeId: string;
  months: Month[];
  market: { items: MarketItem[] };
  wishlist: { items: WishItem[] };
};

export type PriceResult = {
  producto?: string;
  precio_clp: number;
  tienda?: string;
  url?: string;
  nota?: string;
};

export type MonthSummary = {
  id: string;
  label: string;
  income: number;
  spent: number;
  paid: number;
  pending: number;
  balance: number;
};
