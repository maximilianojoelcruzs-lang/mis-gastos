"use client";
import { useMemo, useState } from "react";
import {
  catColor, catOf, chargeCard, currentPeriod, daysInPeriod, guessCategory, periodName, refundCard, shiftPeriod, summarizeMonth, todayISO,
} from "@/lib/data";
import { clp, dayLabel, uid } from "@/lib/format";
import type { AppData, CategoryId, DailyExpense } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import Distribution from "./Distribution";
import { IChevL, IChevR, ICoffee, IPlus, ITrash } from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; period: string; setPeriod: (p: string) => void; notify: Notify };

export default function DiarioTab({ data, update, period, setPeriod, notify }: Props) {
  const today = todayISO();
  const isCurrent = period === currentPeriod();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [manualCat, setManualCat] = useState<string | null>(null);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const cards = data.market.cards;
  const [payer, setPayer] = useState<string>(() => {
    try {
      const p = localStorage.getItem("mg-payer") || "";
      return cards.some((c) => c.id === p) ? p : "";
    } catch {
      return "";
    }
  });
  const payerCard = cards.find((c) => c.id === payer);

  const formDate = dateOverride && dateOverride.startsWith(period) ? dateOverride : isCurrent ? today : `${period}-01`;
  const category = manualCat ?? guessCategory(name, data.categories);

  const list = useMemo(() => data.daily.filter((d) => d.date.startsWith(period)), [data.daily, period]);
  const total = list.reduce((s, d) => s + d.amount, 0);
  const byCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of list) out[d.category] = (out[d.category] || 0) + d.amount;
    return out;
  }, [list]);
  const cardTotal = list.reduce((s, d) => s + (d.cardAmount || 0), 0);
  const usedCats = data.categories.filter((c) => (byCategory[c.id] || 0) > 0);
  const visible = list.filter((d) => filter === "all" || d.category === filter);

  // Agrupa por día (más reciente primero)
  const groups = useMemo(() => {
    const map = new Map<string, DailyExpense[]>();
    for (const d of visible) map.set(d.date, [...(map.get(d.date) || []), d]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  // Estadísticas
  const dayNow = Number(today.slice(8, 10));
  const elapsed = isCurrent ? dayNow : daysInPeriod(period);
  const todayTotal = list.filter((d) => d.date === today).reduce((s, d) => s + d.amount, 0);
  const weekTotal = (() => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const min = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    return data.daily.filter((d) => d.date >= min && d.date <= today).reduce((s, d) => s + d.amount, 0);
  })();
  const perDayTotals = new Map<string, number>();
  for (const d of list) perDayTotals.set(d.date, (perDayTotals.get(d.date) || 0) + d.amount);
  const priciest = [...perDayTotals.entries()].sort((a, b) => b[1] - a[1])[0];

  // Presupuesto del mes: lo que queda después de cuentas y gastos diarios
  const month = data.months.find((m) => m.period === period);
  const sum = month ? summarizeMonth(month, data.daily) : null;
  const daysLeft = daysInPeriod(period) - dayNow + 1;

  const add = () => {
    if (amount <= 0) return notify("Escribe cuánto gastaste");
    const finalName = name.trim() || catOf(data.categories, category).label;
    const covered = payerCard ? Math.min(Math.max(0, payerCard.balance), amount) : 0;
    update((d) => {
      const cardAmount = payer ? chargeCard(d.market, payer, amount) : 0;
      d.daily.push({ id: uid(), date: formDate, name: finalName, amount, category, card: payer, cardAmount });
    });
    try { localStorage.setItem("mg-payer", payer); } catch { /* sin almacenamiento */ }
    notify(payerCard && covered > 0 ? `Anotado: ${finalName} ${clp(amount)} · ${payerCard.name} ${clp(covered)}` : `Anotado: ${finalName} ${clp(amount)}`);
    setName(""); setAmount(0); setManualCat(null);
  };

  // Si el gasto se pagó con tarjeta, achicarlo o borrarlo devuelve el saldo.
  const setDailyAmount = (id: string, v: number) =>
    update((dr) => {
      const x = dr.daily.find((y) => y.id === id);
      if (!x) return;
      x.amount = v;
      if (x.card && x.cardAmount > 0) {
        const keep = Math.min(x.cardAmount, v);
        refundCard(dr.market, x.card, x.cardAmount - keep);
        x.cardAmount = keep;
      }
    });
  const deleteDaily = (id: string) =>
    update((dr) => {
      const x = dr.daily.find((y) => y.id === id);
      if (x?.card && x.cardAmount > 0) refundCard(dr.market, x.card, x.cardAmount);
      dr.daily = dr.daily.filter((y) => y.id !== id);
    });

  const onDaily = (id: string, fn: (d: DailyExpense) => void) =>
    update((dr) => {
      const it = dr.daily.find((x) => x.id === id);
      if (it) fn(it);
    });

  return (
    <div>
      <div className="monthnav">
        <button className="btn icon sm" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Mes anterior"><IChevL size={15} /></button>
        <div className="t">{periodName(period)}</div>
        <button className="btn icon sm" onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Mes siguiente"><IChevR size={15} /></button>
        {!isCurrent && <button className="btn sm" onClick={() => setPeriod(currentPeriod())}>Ir a hoy</button>}
      </div>

      <section className="card">
        <div className="card-h"><h2>Anotar gasto</h2></div>
        <div className="qadd">
          <input className="field name-f" value={name} placeholder="Café, pan, micro…" maxLength={60}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <CurrencyInput className="field amount" value={amount} placeholder="$0" onChange={setAmount} onEnter={add}
          />
          <select className="field" value={category} onChange={(e) => setManualCat(e.target.value)} aria-label="Categoría">
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="btn primary" style={{ height: 36 }} onClick={add}><IPlus size={14} /> Agregar</button>
        </div>
        <div className="qadd-2">
          <input className="field sm" type="date" value={formDate} min={`${period}-01`} max={`${period}-${String(daysInPeriod(period)).padStart(2, "0")}`}
            onChange={(e) => setDateOverride(e.target.value)} style={{ width: 160 }} aria-label="Fecha" />
          {cards.length > 0 && (
            <select className="field sm" value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Pagar con" style={{ width: "auto", maxWidth: 210 }}>
              <option value="">Pago: mi bolsillo</option>
              {cards.map((c) => <option key={c.id} value={c.id}>Pago: {c.name} ({clp(c.balance)})</option>)}
            </select>
          )}
          <span className="muted" style={{ fontSize: 12 }}>Tip: usa el botón + de abajo para anotar desde cualquier pantalla.</span>
        </div>
      </section>

      <section className="card">
        <div className="stats">
          {isCurrent ? (
            <>
              <div className="stat"><span className="l">Hoy</span><span className="v">{clp(todayTotal)}</span></div>
              <div className="stat"><span className="l">Últimos 7 días</span><span className="v">{clp(weekTotal)}</span></div>
            </>
          ) : (
            <>
              <div className="stat"><span className="l">Gastos anotados</span><span className="v">{list.length}</span></div>
              <div className="stat"><span className="l">Día más caro</span><span className="v">{priciest ? clp(priciest[1]) : "—"}</span></div>
            </>
          )}
          <div className="stat"><span className="l">Total del mes</span><span className="v">{clp(total)}</span></div>
          <div className="stat"><span className="l">Promedio por día</span><span className="v">{clp(total / Math.max(1, elapsed))}</span></div>
        </div>
        {cardTotal > 0 && (
          <p className="muted" style={{ margin: "12px 0 0", fontSize: 12.5 }}>
            De esto, <b className="num" style={{ color: "var(--ink)" }}>{clp(cardTotal)}</b> lo pagaste con tarjetas de alimentación y no sale de tu sueldo.
          </p>
        )}
        {sum && isCurrent && (
          <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
            {sum.balance >= 0 ? (
              <>Después de tus cuentas y gastos, te quedan <b className="num">{clp(sum.balance)}</b>: puedes gastar unos <b className="num">{clp(sum.balance / daysLeft)}</b> por día hasta fin de mes.</>
            ) : (
              <span className="badge bad">Ya te pasaste del presupuesto del mes por {clp(-sum.balance)}</span>
            )}
          </div>
        )}
        {!sum && <p className="muted" style={{ margin: "14px 0 0", fontSize: 12.5 }}>No hay un mes en “Cuentas” para {periodName(period)}, así que estos gastos no se descuentan de ningún presupuesto.</p>}
      </section>

      {usedCats.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>En qué gastas a diario</h2></div>
          <Distribution categories={data.categories} byCategory={byCategory} />
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <h2>Movimientos</h2>
          <span className="muted">{visible.length} {visible.length === 1 ? "gasto" : "gastos"}</span>
        </div>
        {usedCats.length > 1 && (
          <div className="chips" style={{ marginBottom: 8 }}>
            <button className={"chip " + (filter === "all" ? "on" : "")} onClick={() => setFilter("all")}>Todas</button>
            {usedCats.map((c) => (
              <button key={c.id} className={"chip " + (filter === c.id ? "on" : "")} onClick={() => setFilter(c.id)}>
                <i className="dot" style={{ background: catColor(c.color) }} /> {c.label}
              </button>
            ))}
          </div>
        )}
        {groups.length === 0 ? (
          <div className="empty"><ICoffee size={20} /><div style={{ marginTop: 8 }}>Aún no hay gastos en {periodName(period)}.</div></div>
        ) : (
          groups.map(([date, items]) => (
            <div key={date}>
              <div className="group-h">
                <span>{dayLabel(date, today)}</span>
                <span className="num">{clp(items.reduce((s, d) => s + d.amount, 0))}</span>
              </div>
              <div className="rows">
                {items.map((d) => {
                  const cat = catOf(data.categories, d.category);
                  return (
                    <div className="row" key={d.id}>
                      <i className="dot" style={{ background: catColor(cat.color) }} title={cat.label} />
                      <div className="cell">
                        <input className="bare name" value={d.name} placeholder="¿En qué?"
                          onChange={(e) => onDaily(d.id, (x) => { x.name = e.target.value; })} />
                        {d.card && d.cardAmount > 0 && (
                          <div className="tags">
                            <span className="badge">{cards.find((c) => c.id === d.card)?.name || "Tarjeta"} {clp(d.cardAmount)}
                              {d.amount > d.cardAmount ? ` · bolsillo ${clp(d.amount - d.cardAmount)}` : ""}</span>
                          </div>
                        )}
                      </div>
                      <select className="bare cat" value={d.category} aria-label="Categoría"
                        onChange={(e) => onDaily(d.id, (x) => { x.category = e.target.value; })}>
                        {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                      <CurrencyInput className="bare amount" value={d.amount} placeholder="$0"
                        onChange={(v) => setDailyAmount(d.id, v)} />
                      <button className="btn ghost icon sm danger" title={d.cardAmount > 0 ? "Eliminar (devuelve el saldo a la tarjeta)" : "Eliminar"}
                        onClick={() => deleteDaily(d.id)}>
                        <ITrash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
