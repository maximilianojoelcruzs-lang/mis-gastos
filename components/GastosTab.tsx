"use client";
import { seedData, summarizeMonth } from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { AppData, Expense, Month } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { ICheck, IDown, IPig, IPlus, IRotate, ITrash, IWallet, IX } from "./icons";
import type { SetData, Update } from "./Tracker";

type Props = { data: AppData; setData: SetData; update: Update };

export default function GastosTab({ data, setData, update }: Props) {
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const { spent, paid, pending, balance } = summarizeMonth(month);
  const over = balance < 0;
  const spentPct = month.income > 0 ? Math.min(100, (spent / month.income) * 100) : spent > 0 ? 100 : 0;
  const paidPct = spent > 0 ? Math.min(100, (paid / spent) * 100) : 0;

  const onMonth = (fn: (m: Month) => void) =>
    update((d) => fn(d.months.find((m) => m.id === d.activeId)!));
  const setItem = <K extends keyof Expense>(id: string, key: K, value: Expense[K]) =>
    onMonth((m) => {
      const it = m.items.find((i) => i.id === id);
      if (it) it[key] = value;
    });

  const addMonth = () =>
    update((d) => {
      const base = d.months.find((m) => m.id === d.activeId) || d.months[0];
      const id = uid();
      d.months.push({
        id,
        label: "Nuevo mes",
        income: base ? base.income : 0,
        items: base ? base.items.map((i) => ({ id: uid(), name: i.name, amount: 0, paid: false })) : [],
      });
      d.activeId = id;
    });

  const deleteMonth = () => {
    if (data.months.length <= 1 || !confirm('¿Eliminar "' + month.label + '"?')) return;
    update((d) => {
      d.months = d.months.filter((m) => m.id !== d.activeId);
      d.activeId = d.months[0].id;
    });
  };

  const reset = () => {
    if (confirm("Esto borra todos los meses y vuelve a los datos de ejemplo. ¿Continuar?")) setData(seedData());
  };

  return (
    <div>
      <div className="mg-months">
        {data.months.map((m) => (
          <button key={m.id} className={"mg-tab " + (m.id === data.activeId ? "active" : "")}
            onClick={() => setData((s) => ({ ...s, activeId: m.id }))}>
            {m.label || "Sin nombre"}
          </button>
        ))}
        <button className="mg-tab add" onClick={addMonth}><IPlus size={15} /> Mes</button>
      </div>

      <section className="mg-card">
        <div className="mg-monthhead">
          <input className="mg-label" value={month.label} placeholder="Nombre del mes"
            onChange={(e) => onMonth((m) => { m.label = e.target.value; })} />
          {data.months.length > 1 && (
            <button className="mg-delmonth" onClick={deleteMonth} title="Eliminar mes"><IX size={16} /></button>
          )}
        </div>
        <div className="mg-hero">
          <div className="mg-heroval">
            <span className="mg-herolabel">{over ? "Te falta" : "Ahorro del mes"}</span>
            <strong className={over ? "neg" : "pos"}>{clp(Math.abs(balance))}</strong>
            <span className="mg-herosub">Ingreso − gastos</span>
          </div>
          <div className="mg-bar">
            <div className="mg-bartrack">
              <div className={"mg-barfill " + (over ? "over" : "")} style={{ width: spentPct + "%" }} />
            </div>
            <div className="mg-barlegend">
              <span><i className="dot spent" /> Gastado {month.income > 0 ? Math.round(spentPct) + "%" : ""}</span>
              {!over && <span><i className="dot save" /> Libre {month.income > 0 ? Math.round(100 - spentPct) + "%" : ""}</span>}
            </div>
          </div>
        </div>
        <div className="mg-stats">
          <div className="mg-stat income">
            <span><IWallet size={14} /> Ingreso</span>
            <CurrencyInput className="mg-statinput" value={month.income} placeholder="$0"
              onChange={(v) => onMonth((m) => { m.income = v; })} />
          </div>
          <div className="mg-stat spent">
            <span><IDown size={14} /> Total gastos</span>
            <strong>{clp(spent)}</strong>
          </div>
          <div className={"mg-stat " + (over ? "over" : "save")}>
            <span><IPig size={14} /> {over ? "Déficit" : "Ahorro"}</span>
            <strong>{clp(Math.abs(balance))}</strong>
          </div>
        </div>
      </section>

      <section className="mg-card">
        <div className="mg-listhead">
          <h2>Gastos</h2>
          <span>{month.items.length} {month.items.length === 1 ? "ítem" : "ítems"}</span>
        </div>
        {month.items.length > 0 && (
          <div>
            <div className="mg-paybar">
              <span className="paid"><ICheck size={12} /> Pagado {clp(paid)}</span>
              <span className="pending">Por pagar {clp(pending)}</span>
            </div>
            <div className="mg-paytrack"><div className="mg-payfill" style={{ width: paidPct + "%" }} /></div>
          </div>
        )}
        <div className="mg-list">
          {month.items.length === 0 && <div className="mg-empty">Aún no hay gastos. Agrega el primero abajo.</div>}
          {month.items.map((it) => {
            const pct = month.income > 0 ? (it.amount / month.income) * 100 : 0;
            return (
              <div className={"mg-row " + (it.paid ? "paid" : "")} key={it.id}>
                <button className={"mg-check " + (it.paid ? "on" : "")} onClick={() => setItem(it.id, "paid", !it.paid)}
                  title={it.paid ? "Marcar como no pagado" : "Marcar como pagado"}>
                  {it.paid && <ICheck size={13} />}
                </button>
                <input className="mg-name" value={it.name} placeholder="Nombre del gasto"
                  onChange={(e) => setItem(it.id, "name", e.target.value)} />
                <span className="mg-pct">{pct >= 0.5 ? Math.round(pct) + "%" : ""}</span>
                <CurrencyInput className="mg-amount" value={it.amount} placeholder="$0"
                  onChange={(v) => setItem(it.id, "amount", v)} />
                <button className="mg-del" title="Eliminar"
                  onClick={() => onMonth((m) => { m.items = m.items.filter((i) => i.id !== it.id); })}>
                  <ITrash size={15} />
                </button>
              </div>
            );
          })}
        </div>
        <button className="mg-add"
          onClick={() => onMonth((m) => { m.items.push({ id: uid(), name: "", amount: 0, paid: false }); })}>
          <IPlus size={16} /> Agregar gasto
        </button>
      </section>

      <footer className="mg-footer">
        <span>Marca el círculo cuando ya pagaste cada cuenta.</span>
        <div className="right">
          <button className="mg-reset" onClick={reset}><IRotate size={13} /> Restablecer</button>
        </div>
      </footer>
    </div>
  );
}
