"use client";
import { useState } from "react";
import { buildNextMonth, catColor, catOf, dueStatus, guessCategory, seedData, summarizeMonth } from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { AppData, CategoryId, Expense, Income, Month } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import Distribution from "./Distribution";
import {
  IAlert, ICheck, IClock, ILayers, IMore, IPlus, IRepeat, IRotate, ITarget, ITrash, IX,
} from "./icons";
import type { SetData, Update } from "./Tracker";

type Props = { data: AppData; setData: SetData; update: Update };

export default function GastosTab({ data, setData, update }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryId | "all">("all");

  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const sum = summarizeMonth(month, data.daily);
  const over = sum.balance < 0;
  const spentPct = sum.income > 0 ? Math.min(100, (sum.spent / sum.income) * 100) : sum.spent > 0 ? 100 : 0;
  const goalPct = month.goal > 0 ? Math.max(0, Math.min(100, (sum.balance / month.goal) * 100)) : 0;

  const statuses = month.items.map((i) => dueStatus(i, month.period));
  const late = statuses.filter((s) => s?.tone === "late").length;
  const soon = statuses.filter((s) => s?.tone === "soon").length;

  const itemCats = data.categories.filter((c) => month.items.some((i) => i.category === c.id));
  const visible = month.items.filter((i) => filter === "all" || i.category === filter);

  const onMonth = (fn: (m: Month) => void) =>
    update((d) => fn(d.months.find((m) => m.id === d.activeId)!));
  const onItem = (id: string, fn: (i: Expense) => void) =>
    onMonth((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it) fn(it);
    });
  const onIncome = (id: string, fn: (i: Income) => void) =>
    onMonth((m) => {
      const it = m.incomes.find((i) => i.id === id);
      if (it) fn(it);
    });

  const addExpense = (installments = false) => {
    const id = uid();
    onMonth((m) => {
      m.items.push({
        id, name: "", amount: 0, paid: false,
        category: filter === "all" ? "otros" : filter,
        fixed: false, dueDay: null,
        installment: installments ? { current: 1, total: 3 } : null,
      });
    });
    setOpen(installments ? id : null);
  };

  const addMonth = () =>
    update((d) => {
      const base = d.months.find((m) => m.id === d.activeId) || d.months[d.months.length - 1];
      const next = buildNextMonth(base);
      d.months.push(next);
      d.activeId = next.id;
    });

  const deleteMonth = () => {
    if (data.months.length <= 1 || !confirm('¿Eliminar "' + month.label + '"?')) return;
    update((d) => {
      d.months = d.months.filter((m) => m.id !== d.activeId);
      d.activeId = d.months[d.months.length - 1].id;
    });
  };

  const reset = () => {
    if (confirm("Esto borra todos tus datos (meses, gastos diarios, súper y compras) y vuelve a los datos de ejemplo. ¿Continuar?"))
      setData(seedData());
  };

  return (
    <div>
      <div className="months">
        {data.months.map((m) => (
          <button key={m.id} className={"chip " + (m.id === data.activeId ? "on" : "")}
            onClick={() => { setOpen(null); setData((s) => ({ ...s, activeId: m.id })); }}>
            {m.label || "Sin nombre"}
          </button>
        ))}
        <button className="chip" onClick={addMonth} title="Crea el mes siguiente con tus gastos fijos y cuotas">
          <IPlus size={14} /> Nuevo mes
        </button>
      </div>

      {/* Resumen del mes */}
      <section className="card">
        <div className="month-h">
          <input className="bare title" value={month.label} placeholder="Nombre del mes"
            onChange={(e) => onMonth((m) => { m.label = e.target.value; })} />
          <input className="field sm" type="month" value={month.period} title="Mes calendario (para vencimientos y gastos diarios)"
            onChange={(e) => onMonth((m) => { m.period = e.target.value; })} />
          {data.months.length > 1 && (
            <button className="btn ghost icon sm danger" onClick={deleteMonth} title="Eliminar mes"><IX size={15} /></button>
          )}
        </div>

        <div className="hero">
          <div>
            <div className="l">{over ? <><IAlert size={14} /> Déficit del mes</> : "Te queda este mes"}</div>
            <div className={"v " + (over ? "neg" : "")}>{clp(Math.abs(sum.balance))}</div>
          </div>
        </div>

        <div className="stats">
          <div className="stat"><span className="l">Ingresos</span><span className="v">{clp(sum.income)}</span></div>
          <div className="stat"><span className="l">Cuentas</span><span className="v">{clp(sum.bills)}</span></div>
          <div className="stat"><span className="l">Gastos diarios</span><span className="v">{clp(sum.daily)}</span></div>
          <div className="stat"><span className="l">Por pagar</span><span className="v">{clp(sum.pending)}</span></div>
        </div>
        {!month.period && (
          <p className="muted" style={{ margin: "10px 0 0", fontSize: 12.5 }}>
            Elige el mes calendario arriba para que los gastos diarios se sumen a este mes.
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          <div className="bar"><i className={over ? "bad" : ""} style={{ width: spentPct + "%" }} /></div>
          <div className="bar-l">
            <span>Gastado {sum.income > 0 ? Math.round((sum.spent / sum.income) * 100) + "%" : "—"} del ingreso</span>
            <span>{sum.bills > 0 ? Math.round((sum.paid / sum.bills) * 100) : 0}% de las cuentas pagado</span>
          </div>
        </div>

        <hr className="hr" />

        {/* Meta de ahorro */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: 1, minWidth: 140 }}>
            <ITarget size={15} /> Meta de ahorro
          </span>
          <CurrencyInput className="field sm amount" value={month.goal} placeholder="$0"
            onChange={(v) => onMonth((m) => { m.goal = v; })} />
        </div>
        {month.goal > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="bar"><i className={sum.balance >= month.goal ? "good" : ""} style={{ width: goalPct + "%" }} /></div>
            <div className="bar-l">
              {sum.balance >= month.goal ? (
                <span className="badge good"><ICheck size={11} /> Meta cumplida</span>
              ) : (
                <span>Te faltan {clp(month.goal - Math.max(0, sum.balance))} para tu meta</span>
              )}
              <span>{Math.round(goalPct)}%</span>
            </div>
          </div>
        )}
      </section>

      {/* Alertas de vencimiento */}
      {(late > 0 || soon > 0) && (
        <div className={"alert " + (late > 0 ? "bad" : "warn")}>
          {late > 0 ? <IAlert size={16} /> : <IClock size={16} />}
          <span>
            {late > 0 && <b>{late} {late === 1 ? "cuenta atrasada" : "cuentas atrasadas"}</b>}
            {late > 0 && soon > 0 && " · "}
            {soon > 0 && <span>{soon} {soon === 1 ? "vence pronto" : "vencen pronto"}</span>}
          </span>
        </div>
      )}

      <div className="grid2" style={{ marginBottom: 16 }}>
        {/* Ingresos */}
        <section className="card">
          <div className="card-h">
            <h2>Ingresos</h2>
            <span className="muted num">{clp(sum.income)}</span>
          </div>
          <div className="rows">
            {month.incomes.map((inc) => (
              <div className="row" key={inc.id}>
                <input className="bare name" value={inc.name} placeholder="Sueldo, extra, bono…"
                  onChange={(e) => onIncome(inc.id, (x) => { x.name = e.target.value; })} />
                <CurrencyInput className="bare amount" value={inc.amount} placeholder="$0"
                  onChange={(v) => onIncome(inc.id, (x) => { x.amount = v; })} />
                <button className="btn ghost icon sm danger" title="Quitar ingreso"
                  onClick={() => onMonth((m) => { m.incomes = m.incomes.filter((x) => x.id !== inc.id); })}>
                  <ITrash size={14} />
                </button>
              </div>
            ))}
            {month.incomes.length === 0 && <div className="empty">Sin ingresos este mes.</div>}
          </div>
          <div className="add-row">
            <button className="btn dashed"
              onClick={() => onMonth((m) => { m.incomes.push({ id: uid(), name: "", amount: 0 }); })}>
              <IPlus size={14} /> Agregar ingreso
            </button>
          </div>
        </section>

        {/* En qué se va la plata */}
        <section className="card">
          <div className="card-h">
            <div>
              <h2>En qué se va la plata</h2>
              <div className="sub">Cuentas + gastos diarios</div>
            </div>
          </div>
          <Distribution categories={data.categories} byCategory={sum.byCategory} />
        </section>
      </div>

      {/* Lista de cuentas */}
      <section className="card">
        <div className="card-h">
          <h2>Cuentas</h2>
          <span className="muted">{month.items.length} {month.items.length === 1 ? "ítem" : "ítems"}</span>
        </div>
        {itemCats.length > 1 && (
          <div className="chips" style={{ marginBottom: 10 }}>
            <button className={"chip " + (filter === "all" ? "on" : "")} onClick={() => setFilter("all")}>Todas</button>
            {itemCats.map((c) => (
              <button key={c.id} className={"chip " + (filter === c.id ? "on" : "")} onClick={() => setFilter(c.id)}>
                <i className="dot" style={{ background: catColor(c.color) }} /> {c.label}
              </button>
            ))}
          </div>
        )}
        <div className="rows">
          {visible.length === 0 && <div className="empty">No hay cuentas aquí. Agrega la primera abajo.</div>}
          {visible.map((it) => {
            const st = dueStatus(it, month.period);
            const cat = catOf(data.categories, it.category);
            const isOpen = open === it.id;
            return (
              <div key={it.id}>
                <div className={"row " + (it.paid ? "done" : "")}>
                  <button className={"check " + (it.paid ? "on" : "")} title={it.paid ? "Marcar como no pagado" : "Marcar como pagado"}
                    onClick={() => onItem(it.id, (x) => { x.paid = !x.paid; })}>
                    {it.paid && <ICheck size={12} />}
                  </button>
                  <i className="dot" style={{ background: catColor(cat.color) }} title={cat.label} />
                  <div className="cell">
                    <input className="bare name" value={it.name} placeholder="Nombre de la cuenta"
                      onChange={(e) => onItem(it.id, (x) => { x.name = e.target.value; })}
                      onBlur={(e) => onItem(it.id, (x) => {
                        if (x.category === "otros" && e.target.value) x.category = guessCategory(e.target.value, data.categories);
                      })} />
                    {(it.installment || it.fixed || st) && (
                      <div className="tags">
                        {st && (
                          <span className={"badge " + (st.tone === "late" ? "bad" : st.tone === "soon" ? "warn" : "")}>
                            {st.tone === "late" ? <IAlert size={11} /> : <IClock size={11} />} {st.text}
                          </span>
                        )}
                        {it.installment && (
                          <span className="badge"><ILayers size={11} /> Cuota {it.installment.current}/{it.installment.total}</span>
                        )}
                        {it.fixed && !it.installment && <span className="badge"><IRepeat size={11} /> Fijo</span>}
                      </div>
                    )}
                  </div>
                  <CurrencyInput className="bare amount" value={it.amount} placeholder="$0"
                    onChange={(v) => onItem(it.id, (x) => { x.amount = v; })} />
                  <button className={"btn icon sm " + (isOpen ? "" : "ghost")} title="Opciones"
                    onClick={() => setOpen(isOpen ? null : it.id)}>
                    <IMore size={15} />
                  </button>
                </div>

                {isOpen && (
                  <div className="detail fade">
                    <label className="f">
                      <span>Categoría</span>
                      <select className="field sm" value={it.category}
                        onChange={(e) => onItem(it.id, (x) => { x.category = e.target.value; })}>
                        {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </select>
                    </label>
                    <label className="f">
                      <span>Vence el día</span>
                      <input className="field sm" type="number" min={1} max={31} placeholder="Sin fecha"
                        value={it.dueDay ?? ""}
                        onChange={(e) => onItem(it.id, (x) => {
                          const n = parseInt(e.target.value, 10);
                          x.dueDay = n >= 1 && n <= 31 ? n : null;
                        })} />
                    </label>
                    <div className="f">
                      <span>Gasto fijo</span>
                      <div className="inline">
                        <button className={"toggle " + (it.fixed ? "on" : "")} disabled={!!it.installment}
                          onClick={() => onItem(it.id, (x) => { x.fixed = !x.fixed; })} aria-label="Gasto fijo" />
                        <span className="muted" style={{ fontSize: 12.5 }}>
                          {it.installment ? "Las cuotas se copian solas" : it.fixed ? "Se copia con su monto" : "Se copia en $0"}
                        </span>
                      </div>
                    </div>
                    <div className="f">
                      <span>Cuotas (actual / total)</span>
                      <div className="inline">
                        <input className="field sm" type="number" min={1} value={it.installment?.current ?? ""} placeholder="—"
                          onChange={(e) => onItem(it.id, (x) => {
                            const n = Math.max(1, parseInt(e.target.value, 10) || 1);
                            x.installment = { current: Math.min(n, x.installment?.total || n), total: Math.max(x.installment?.total || 2, n) };
                          })} />
                        <span className="muted">/</span>
                        <input className="field sm" type="number" min={0} value={it.installment?.total ?? ""} placeholder="—"
                          onChange={(e) => onItem(it.id, (x) => {
                            const n = parseInt(e.target.value, 10) || 0;
                            x.installment = n >= 2 ? { current: Math.min(x.installment?.current || 1, n), total: n } : null;
                          })} />
                      </div>
                    </div>
                    <div className="foot">
                      <span className="muted" style={{ fontSize: 12 }}>
                        {it.installment
                          ? `Quedan ${it.installment.total - it.installment.current} cuotas después de esta (${clp(it.amount * (it.installment.total - it.installment.current))}).`
                          : "Deja el total de cuotas vacío si no es en cuotas."}
                      </span>
                      <button className="btn sm danger"
                        onClick={() => { onMonth((m) => { m.items = m.items.filter((i) => i.id !== it.id); }); setOpen(null); }}>
                        <ITrash size={13} /> Eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="add-row">
          <button className="btn dashed" onClick={() => addExpense(false)}><IPlus size={14} /> Agregar cuenta</button>
          <button className="btn dashed" onClick={() => addExpense(true)}><ILayers size={14} /> Compra en cuotas</button>
        </div>
      </section>

      <div className="foot-note">
        <span>&quot;Nuevo mes&quot; copia tus ingresos, cuentas fijas y cuotas pendientes.</span>
        <button className="btn ghost sm" onClick={reset}><IRotate size={13} /> Restablecer todo</button>
      </div>
    </div>
  );
}
