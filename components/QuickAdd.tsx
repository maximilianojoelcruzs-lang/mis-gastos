"use client";
import { useState } from "react";
import { allTags, catColor, catOf, chargeCard, currentPeriod, frequentDaily, learnCategory, limitAlert, nextPeriod, periodName, todayISO } from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { AppData } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import Modal from "./Modal";
import SplitPicker, { type SplitValue } from "./SplitPicker";
import TagInput from "./TagInput";
import type { Notify, Update } from "./Tracker";

type Props = {
  data: AppData;
  update: Update;
  notify: Notify;
  onClose: () => void;
  /** Mes del presupuesto donde quedó el gasto ("YYYY-MM"). */
  onSaved?: (period: string) => void;
};

/** Ventana para anotar un gasto del día en un par de segundos. */
export default function QuickAdd({ data, update, notify, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(0);
  const [name, setName] = useState("");
  const [manualCat, setManualCat] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  // Mes del presupuesto: por defecto el de la fecha; se puede elegir el siguiente (ej. ya te pagaron noviembre).
  const [budget, setBudget] = useState<string | null>(null);
  const datePeriod = date.slice(0, 7);
  const target = budget ?? datePeriod;
  const monthOptions = [...new Set([currentPeriod(), nextPeriod(currentPeriod()), datePeriod, nextPeriod(datePeriod)])].sort();
  const targetMonth = data.months.find((m) => m.period === target);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [split, setSplit] = useState<SplitValue>({ paidBy: "", split: [] });
  const cards = data.market.cards;
  // Recuerda con qué pagaste la última vez (típico: el almuerzo con la tarjeta).
  const [payer, setPayer] = useState<string>(() => {
    try {
      const p = localStorage.getItem("mg-payer") || "";
      return cards.some((c) => c.id === p) ? p : "";
    } catch {
      return "";
    }
  });
  // Si pagó otra persona, no se usa mi tarjeta.
  const payCard = split.paidBy ? undefined : cards.find((c) => c.id === payer);
  const covered = payCard ? Math.min(Math.max(0, payCard.balance), amount) : 0;

  const learned = learnCategory(data, name);
  const category = manualCat ?? learned.id;
  const frequent = frequentDaily(data.daily);

  const submit = () => {
    if (amount <= 0) return setError("Escribe cuánto gastaste.");
    const finalName = name.trim() || catOf(data.categories, category).label;
    const card = payCard ? payCard.id : "";
    const entry = { id: uid(), date, name: finalName, amount, category, card, cardAmount: 0, tags, paidBy: split.paidBy, split: split.split,
      period: target === datePeriod ? "" : target };
    update((d) => {
      d.daily.push({ ...entry, cardAmount: card ? chargeCard(d.market, card, amount) : 0 });
    });
    try { localStorage.setItem("mg-payer", payer); } catch { /* sin almacenamiento */ }
    const alert = limitAlert({ ...data, daily: [...data.daily, { ...entry, cardAmount: covered }] }, category, target);
    const base = payCard && covered > 0
      ? `Anotado: ${finalName} ${clp(amount)} · ${payCard.name} ${clp(covered)}${amount > covered ? ` + bolsillo ${clp(amount - covered)}` : ""}`
      : `Anotado: ${finalName} ${clp(amount)}`;
    notify(alert ? `${base}. ${alert}` : base);
    onSaved?.(target);
    onClose();
  };

  return (
    <Modal onClose={onClose} label="Gasto rápido">
      <h2>Gasto rápido</h2>
      <p className="lead">Anótalo en segundos. Queda en tus gastos diarios.</p>

      <label className="f">
        <span>Monto</span>
        <CurrencyInput className="field bigamount" value={amount} placeholder="$0" autoFocus
          onChange={(v) => { setAmount(v); setError(""); }} onEnter={submit} />
      </label>
      <label className="f">
        <span>¿En qué?</span>
        <input className="field" value={name} placeholder="Café, pan, micro…" maxLength={60}
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      </label>

      {frequent.length > 0 && (
        <div className="freq" style={{ margin: "-4px 0 12px" }}>
          <span>Frecuentes</span>
          {frequent.map((f) => (
            <button key={f.name} className="chip" type="button"
              onClick={() => { setName(f.name); setAmount(f.amount); setManualCat(f.category); setError(""); }}>
              {f.name} · {clp(f.amount)}
            </button>
          ))}
        </div>
      )}

      <div className="f" style={{ marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>
          Categoría{manualCat === null && learned.learned && name.trim() ? <span className="hintinline"> · según tu historial</span> : null}
        </span>
        <div className="chips">
          {data.categories.map((c) => (
            <button key={c.id} type="button" className={"chip " + (category === c.id ? "on" : "")} onClick={() => setManualCat(c.id)}>
              <i className="dot" style={{ background: catColor(c.color) }} /> {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="f" style={{ marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>Etiquetas</span>
        <TagInput value={tags} onChange={setTags} suggestions={allTags(data)} />
      </div>

      {data.people.length > 0 && (
        <div className="f" style={{ marginBottom: 12 }}>
          <SplitPicker people={data.people} value={split} onChange={setSplit} amount={amount} />
        </div>
      )}

      {cards.length > 0 && !split.paidBy && (
        <div className="f" style={{ marginBottom: 12 }}>
          <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>Pagar con</span>
          <div className="payer">
            <button type="button" className={"chip " + (payer === "" ? "on" : "")} onClick={() => setPayer("")}>Mi bolsillo</button>
            {cards.map((c) => (
              <button key={c.id} type="button" className={"chip " + (payer === c.id ? "on" : "")} onClick={() => setPayer(c.id)}>
                <i className="dot" style={{ background: catColor(c.color) }} /> {c.name} · {clp(c.balance)}
              </button>
            ))}
          </div>
          {payCard && amount > 0 && amount > covered && (
            <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>
              {covered > 0 ? `El saldo no alcanza: ${clp(covered)} con ${payCard.name} y ${clp(amount - covered)} de tu bolsillo.` : `${payCard.name} no tiene saldo: se pagará con tu bolsillo.`}
            </p>
          )}
        </div>
      )}

      <label className="f">
        <span>Fecha</span>
        <input className="field sm" type="date" value={date}
          onChange={(e) => { setDate(e.target.value || todayISO()); setBudget(null); }} style={{ width: 170 }} />
      </label>
      <div className="f" style={{ marginBottom: 4 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>Se descuenta de</span>
        <div className="seg" role="group" aria-label="Mes del presupuesto">
          {monthOptions.map((p) => (
            <button key={p} type="button" className={target === p ? "on" : ""} aria-pressed={target === p} onClick={() => setBudget(p === datePeriod ? null : p)}>
              {periodName(p)}
            </button>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}>
          {target !== datePeriod
            ? `Queda con su fecha real, pero se descuenta del presupuesto de ${periodName(target)} (por ejemplo, si ya te pagaron ese mes).`
            : "Se descuenta del mes de la fecha."}
          {!targetMonth && ` Aún no tienes ${periodName(target)} en Cuentas: créalo con “Nuevo mes” para que se descuente de tu sueldo.`}
        </p>
      </div>

      {error && <div className="auth-err" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{error}</div>}
      <div className="actions">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={submit}>Anotar gasto</button>
      </div>
    </Modal>
  );
}
