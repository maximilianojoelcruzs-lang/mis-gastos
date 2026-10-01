"use client";
import { useMemo, useState } from "react";
import {
  allTags, balances, catColor, catOf, chargeCard, currentPeriod, dailyParts, daysInPeriod, learnCategory, limitAlert, limitStatus,
  periodName, refundCard, shiftPeriod, spentByCategory, summarizeMonth, todayISO,
} from "@/lib/data";
import { clp, dayLabel, uid } from "@/lib/format";
import type { AppData, CategoryId, DailyExpense } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import Distribution from "./Distribution";
import SplitPicker, { type SplitValue } from "./SplitPicker";
import TagInput from "./TagInput";
import { IAlert, ICheck, IChevL, IChevR, ICoffee, IMore, IPlus, ITrash, IUsers, IX } from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; period: string; setPeriod: (p: string) => void; notify: Notify };

export default function DiarioTab({ data, update, period, setPeriod, notify }: Props) {
  const today = todayISO();
  const isCurrent = period === currentPeriod();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(0);
  const [manualCat, setManualCat] = useState<string | null>(null);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitValue>({ paidBy: "", split: [] });
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const cards = data.market.cards;
  const people = data.people;
  const [payer, setPayer] = useState<string>(() => {
    try {
      const p = localStorage.getItem("mg-payer") || "";
      return cards.some((c) => c.id === p) ? p : "";
    } catch {
      return "";
    }
  });
  const payerCard = split.paidBy ? undefined : cards.find((c) => c.id === payer);
  const tagList = useMemo(() => allTags(data), [data]);

  const formDate = dateOverride && dateOverride.startsWith(period) ? dateOverride : isCurrent ? today : `${period}-01`;
  const learned = learnCategory(data, name);
  const category = manualCat ?? learned.id;

  const list = useMemo(() => data.daily.filter((d) => d.date.startsWith(period)), [data.daily, period]);
  // Los totales usan "mi parte": en un gasto compartido solo cuenta lo que me toca.
  const total = list.reduce((s, d) => s + dailyParts(d).mine, 0);
  const byCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of list) out[d.category] = (out[d.category] || 0) + dailyParts(d).mine;
    return out;
  }, [list]);
  const cardTotal = list.reduce((s, d) => s + dailyParts(d).card, 0);
  const usedCats = data.categories.filter((c) => (byCategory[c.id] || 0) > 0);
  const monthTags = [...new Set(list.flatMap((d) => d.tags))].sort();
  const visible = list.filter((d) => (filter === "all" || d.category === filter) && (!tagFilter || d.tags.includes(tagFilter)));
  const visibleTotal = visible.reduce((s, d) => s + dailyParts(d).mine, 0);

  // Agrupa por día (más reciente primero)
  const groups = useMemo(() => {
    const map = new Map<string, DailyExpense[]>();
    for (const d of visible) map.set(d.date, [...(map.get(d.date) || []), d]);
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  // Estadísticas
  const dayNow = Number(today.slice(8, 10));
  const elapsed = isCurrent ? dayNow : daysInPeriod(period);
  const todayTotal = list.filter((d) => d.date === today).reduce((s, d) => s + dailyParts(d).mine, 0);
  const weekTotal = (() => {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const min = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
    return data.daily.filter((d) => d.date >= min && d.date <= today).reduce((s, d) => s + dailyParts(d).mine, 0);
  })();
  const perDayTotals = new Map<string, number>();
  for (const d of list) perDayTotals.set(d.date, (perDayTotals.get(d.date) || 0) + dailyParts(d).mine);
  const priciest = [...perDayTotals.entries()].sort((a, b) => b[1] - a[1])[0];

  // Presupuesto del mes: lo que queda después de cuentas y gastos diarios
  const month = data.months.find((m) => m.period === period);
  const sum = month ? summarizeMonth(month, data.daily) : null;
  const daysLeft = daysInPeriod(period) - dayNow + 1;
  const limits = limitStatus(data.categories, spentByCategory(data, period)).filter((l) => l.tone !== "ok");
  const owed = balances(data);

  const add = () => {
    if (amount <= 0) return notify("Escribe cuánto gastaste");
    const finalName = name.trim() || catOf(data.categories, category).label;
    const card = payerCard ? payerCard.id : "";
    const covered = payerCard ? Math.min(Math.max(0, payerCard.balance), amount) : 0;
    const entry: DailyExpense = { id: uid(), date: formDate, name: finalName, amount, category, card, cardAmount: 0, tags, paidBy: split.paidBy, split: split.split };
    update((d) => {
      d.daily.push({ ...entry, cardAmount: card ? chargeCard(d.market, card, amount) : 0 });
    });
    try { localStorage.setItem("mg-payer", payer); } catch { /* sin almacenamiento */ }
    const alert = limitAlert({ ...data, daily: [...data.daily, { ...entry, cardAmount: covered }] }, category, formDate.slice(0, 7));
    const base = payerCard && covered > 0 ? `Anotado: ${finalName} ${clp(amount)} · ${payerCard.name} ${clp(covered)}` : `Anotado: ${finalName} ${clp(amount)}`;
    notify(alert ? `${base}. ${alert}` : base);
    setName(""); setAmount(0); setManualCat(null); setTags([]);
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
  const setDailySplit = (id: string, v: SplitValue) =>
    update((dr) => {
      const x = dr.daily.find((y) => y.id === id);
      if (!x) return;
      x.split = v.split;
      x.paidBy = v.paidBy;
      // Si ahora pagó otra persona, lo que cubrió mi tarjeta vuelve a su saldo.
      if (v.paidBy && x.card) {
        refundCard(dr.market, x.card, x.cardAmount);
        x.card = "";
        x.cardAmount = 0;
      }
    });

  const onDaily = (id: string, fn: (d: DailyExpense) => void) =>
    update((dr) => {
      const it = dr.daily.find((x) => x.id === id);
      if (it) fn(it);
    });

  const settle = (personId: string, amount: number) => {
    const p = people.find((x) => x.id === personId);
    if (!p || !amount) return;
    const text = amount > 0 ? `¿${p.name} te pagó ${clp(amount)}?` : `¿Le pagaste ${clp(-amount)} a ${p.name}?`;
    if (!confirm(text + " Esto deja las cuentas en cero.")) return;
    update((d) => { d.settlements.push({ id: uid(), date: today, person: personId, amount }); });
    notify(`Cuentas saldadas con ${p.name}`);
  };

  return (
    <div>
      <div className="monthnav">
        <button className="btn icon sm" onClick={() => setPeriod(shiftPeriod(period, -1))} aria-label="Mes anterior"><IChevL size={15} /></button>
        <div className="t">{periodName(period)}</div>
        <button className="btn icon sm" onClick={() => setPeriod(shiftPeriod(period, 1))} aria-label="Mes siguiente"><IChevR size={15} /></button>
        {!isCurrent && <button className="btn sm" onClick={() => setPeriod(currentPeriod())}>Ir a hoy</button>}
      </div>

      {limits.length > 0 && (
        <div className={"alert " + (limits.some((l) => l.tone === "over") ? "bad" : "warn")} role="status">
          <IAlert size={16} />
          <span>
            {limits.map((l, i) => (
              <span key={l.cat.id}>
                {i > 0 && " · "}
                <b>{l.cat.label}</b> {l.tone === "over" ? `pasó su límite (${l.pct}%)` : `va en ${l.pct}% de su límite`}
              </span>
            ))}
          </span>
        </div>
      )}

      <section className="card">
        <div className="card-h"><h2>Anotar gasto</h2></div>
        <div className="qadd">
          <input className="field name-f" value={name} placeholder="Café, pan, micro…" maxLength={60}
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <CurrencyInput className="field amount" value={amount} placeholder="$0" onChange={setAmount} onEnter={add}
          />
          <select className="field" value={category} onChange={(e) => setManualCat(e.target.value)} aria-label="Categoría"
            title={manualCat === null && learned.learned ? "Categoría según tu historial" : undefined}>
            {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="btn primary" style={{ height: 36 }} onClick={add}><IPlus size={14} /> Agregar</button>
        </div>
        <div className="qadd-2">
          <input className="field sm" type="date" value={formDate} min={`${period}-01`} max={`${period}-${String(daysInPeriod(period)).padStart(2, "0")}`}
            onChange={(e) => setDateOverride(e.target.value)} style={{ width: 160 }} aria-label="Fecha" />
          {cards.length > 0 && !split.paidBy && (
            <select className="field sm" value={payer} onChange={(e) => setPayer(e.target.value)} aria-label="Pagar con" style={{ width: "auto", maxWidth: 210 }}>
              <option value="">Pago: mi bolsillo</option>
              {cards.map((c) => <option key={c.id} value={c.id}>Pago: {c.name} ({clp(c.balance)})</option>)}
            </select>
          )}
          <div style={{ flex: "1 1 220px", minWidth: 200 }}>
            <TagInput value={tags} onChange={setTags} suggestions={tagList} placeholder="#etiqueta (opcional)" />
          </div>
        </div>
        {manualCat === null && learned.learned && name.trim() && (
          <p className="muted hint" style={{ marginTop: 8 }}>Categoría “{catOf(data.categories, category).label}” según lo que anotaste antes.</p>
        )}
        {people.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <SplitPicker people={people} value={split} onChange={setSplit} amount={amount} />
          </div>
        )}
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

      {people.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Cuentas claras</h2>
              <div className="sub">Gastos compartidos en partes iguales · todos los meses</div>
            </div>
          </div>
          {owed.map((b) => (
            <div className="delta" key={b.person.id}>
              <span className="n">
                <b>{b.person.name}</b>
                <small className="muted" style={{ marginLeft: 8 }}>{b.count} {b.count === 1 ? "gasto compartido" : "gastos compartidos"}</small>
              </span>
              <span className={"v " + (b.balance > 0 ? "down" : b.balance < 0 ? "up" : "")}>
                {b.balance === 0 ? <><ICheck size={12} /> Están a mano</> : b.balance > 0 ? <>Te debe {clp(b.balance)}</> : <>Le debes {clp(-b.balance)}</>}
              </span>
              {b.balance !== 0 && <button className="btn sm" onClick={() => settle(b.person.id, b.balance)}>Saldar</button>}
            </div>
          ))}
        </section>
      )}

      {usedCats.length > 0 && (
        <section className="card">
          <div className="card-h"><h2>En qué gastas a diario</h2></div>
          <Distribution categories={data.categories} byCategory={byCategory} />
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <h2>Movimientos</h2>
          <span className="muted">
            {visible.length} {visible.length === 1 ? "gasto" : "gastos"}{(filter !== "all" || tagFilter) && <> · <span className="num">{clp(visibleTotal)}</span></>}
          </span>
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
        {monthTags.length > 0 && (
          <div className="chips" style={{ marginBottom: 8 }} aria-label="Filtrar por etiqueta">
            {monthTags.map((t) => (
              <button key={t} className={"chip sm " + (tagFilter === t ? "on" : "")} onClick={() => setTagFilter(tagFilter === t ? null : t)}>
                #{t}{tagFilter === t && <IX size={11} />}
              </button>
            ))}
          </div>
        )}
        {groups.length === 0 ? (
          <div className="empty"><ICoffee size={20} /><div style={{ marginTop: 8 }}>{list.length ? "Nada con ese filtro." : `Aún no hay gastos en ${periodName(period)}.`}</div></div>
        ) : (
          groups.map(([date, items]) => (
            <div key={date}>
              <div className="group-h">
                <span>{dayLabel(date, today)}</span>
                <span className="num">{clp(items.reduce((s, d) => s + dailyParts(d).mine, 0))}</span>
              </div>
              <div className="rows">
                {items.map((d) => {
                  const cat = catOf(data.categories, d.category);
                  const parts = dailyParts(d);
                  const payerName = people.find((p) => p.id === d.paidBy)?.name;
                  const withNames = d.split.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(", ");
                  const isOpen = open === d.id;
                  const hasTags = (d.card && d.cardAmount > 0) || d.tags.length > 0 || d.split.length > 0;
                  return (
                    <div key={d.id}>
                      <div className="row">
                        <i className="dot" style={{ background: catColor(cat.color) }} title={cat.label} />
                        <div className="cell">
                          <input className="bare name" value={d.name} placeholder="¿En qué?"
                            onChange={(e) => onDaily(d.id, (x) => { x.name = e.target.value; })} />
                          {hasTags && (
                            <div className="tags">
                              {d.card && d.cardAmount > 0 && (
                                <span className="badge">{cards.find((c) => c.id === d.card)?.name || "Tarjeta"} {clp(d.cardAmount)}
                                  {parts.mine > d.cardAmount ? ` · bolsillo ${clp(parts.mine - Math.min(d.cardAmount, parts.mine))}` : ""}</span>
                              )}
                              {d.split.length > 0 && (
                                <span className="badge" title={`Compartido con ${withNames}`}>
                                  <IUsers size={11} /> {payerName ? `Pagó ${payerName}` : "Pagaste tú"} · tu parte {clp(parts.mine)}
                                </span>
                              )}
                              {d.tags.map((t) => (
                                <button key={t} className="badge tagbadge" onClick={() => setTagFilter(t)} title="Filtrar por esta etiqueta">#{t}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <select className="bare cat" value={d.category} aria-label="Categoría"
                          onChange={(e) => onDaily(d.id, (x) => { x.category = e.target.value; })}>
                          {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                        </select>
                        <CurrencyInput className="bare amount" value={d.amount} placeholder="$0"
                          onChange={(v) => setDailyAmount(d.id, v)} />
                        <button className={"btn icon sm " + (isOpen ? "" : "ghost")} title="Etiquetas y más" aria-label="Etiquetas y más"
                          onClick={() => setOpen(isOpen ? null : d.id)}>
                          <IMore size={15} />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="detail fade">
                          <div className="f" style={{ gridColumn: "1 / -1" }}>
                            <span>Etiquetas</span>
                            <TagInput value={d.tags} onChange={(t) => onDaily(d.id, (x) => { x.tags = t; })} suggestions={tagList} />
                          </div>
                          {people.length > 0 && (
                            <div className="f" style={{ gridColumn: "1 / -1" }}>
                              <SplitPicker people={people} value={{ paidBy: d.paidBy, split: d.split }} amount={d.amount}
                                onChange={(v) => setDailySplit(d.id, v)} />
                            </div>
                          )}
                          <div className="foot">
                            <span className="muted" style={{ fontSize: 12 }}>
                              {d.cardAmount > 0 ? "Al eliminarlo, el saldo vuelve a la tarjeta." : ""}
                            </span>
                            <button className="btn sm danger" onClick={() => { deleteDaily(d.id); setOpen(null); }}>
                              <ITrash size={13} /> Eliminar
                            </button>
                          </div>
                        </div>
                      )}
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
