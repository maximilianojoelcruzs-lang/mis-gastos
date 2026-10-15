"use client";
import { useState } from "react";
import {
  AISLES, CARD_PRESETS, DEFAULT_CARD_AISLES, SUPER_LINE, aisleLabel, catColor, currentPeriod, periodName, superPlan, syncSuperLine, todayISO,
  type PaymentSplit,
} from "@/lib/data";
import { clp, dayLabel, uid } from "@/lib/format";
import type { AppData, BenefitCard } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { IAlert, ICard, ICheck, IPlus, ISettings, ITrash, IWallet, IX } from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; notify: Notify; split: PaymentSplit; scope: string; pendingTotal: number };

/** Plan mensual del súper: carga de cada tarjeta de alimentación + un extra de tu bolsillo que sale de Cuentas. */
export default function SuperBudget({ data, update, notify, split, scope, pendingTotal }: Props) {
  const { market } = data;
  const { cards } = market;
  const period = currentPeriod();
  const plan = superPlan(market, period);
  const hasPlan = plan.budget > 0;
  // Si se entra sin plan, el editor queda abierto hasta tocar "Listo" (no se cierra al escribir el primer monto).
  const [editing, setEditing] = useState(!hasPlan);
  const showEdit = editing || !hasPlan;
  const today = todayISO();
  const month = data.months.find((m) => m.period === period);

  const left = plan.budget - plan.spent;
  const projected = plan.spent + pendingTotal;
  const pct = (v: number) => (plan.budget > 0 ? Math.min(100, (v / plan.budget) * 100) : 0);
  const toLoad = cards.filter((c) => c.monthly > 0 && c.loaded !== period);
  const active = cards.filter((c) => c.use);
  // De lo que falta comprar, cuánto saldría de tu bolsillo y cuánto queda de tu extra.
  const extraLeft = Math.max(0, plan.extra - plan.pocketUsed);
  const overExtra = split.total > 0 ? Math.max(0, split.pocket - extraLeft) : 0;

  const onCard = (id: string, fn: (c: BenefitCard) => void) =>
    update((d) => { const c = d.market.cards.find((x) => x.id === id); if (c) fn(c); });
  const addCard = (preset: (typeof CARD_PRESETS)[number]) =>
    update((d) => {
      d.market.cards.push({ id: uid(), name: preset.name, balance: 0, aisles: [...DEFAULT_CARD_AISLES], color: preset.color, use: true, monthly: 0, loaded: period });
    });
  const setExtra = (v: number) => update((d) => { d.market.extra = v; syncSuperLine(d, period); });
  const loadCard = (c: BenefitCard, add: boolean) => {
    update((d) => {
      const x = d.market.cards.find((y) => y.id === c.id);
      if (!x) return;
      if (add) x.balance += x.monthly;
      x.loaded = period;
    });
    if (add) notify(`${c.name}: sumé ${clp(c.monthly)} al saldo`);
  };
  const removePurchase = (id: string) =>
    update((d) => { d.market.purchases = d.market.purchases.filter((x) => x.id !== id); syncSuperLine(d, period); });

  return (
    <section className="card sb">
      <div className="card-h">
        <div>
          <h2>Presupuesto del súper</h2>
          <div className="sub">{periodName(period)} · tus tarjetas de alimentación + un extra de tu bolsillo</div>
        </div>
        {hasPlan && (
          <button className={"btn sm " + (editing ? "primary" : "")} onClick={() => setEditing(!editing)}>
            {editing ? <><ICheck size={13} /> Listo</> : <><ISettings size={13} /> Editar plan</>}
          </button>
        )}
      </div>

      {toLoad.length > 0 && (
        <div className="sb-load">
          {toLoad.map((c) => (
            <div key={c.id} className="r">
              <span><b>{c.name}</b>: ¿ya te cargaron {clp(c.monthly)} de {periodName(period).split(" ")[0].toLowerCase()}?</span>
              <span className="a">
                <button className="btn sm primary" onClick={() => loadCard(c, true)}>Sumar al saldo</button>
                <button className="btn sm ghost" onClick={() => loadCard(c, false)}>Ya está</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {hasPlan && (
        <>
          <div className="hero sb-hero">
            <div>
              <div className="l">{left < 0 ? <><IAlert size={14} /> Te pasaste este mes</> : "Te queda para el súper"}</div>
              <div className={"v " + (left < 0 ? "neg" : "")}>{clp(Math.abs(left))}</div>
            </div>
            <div className="sb-total">
              <span className="muted">de</span> <b className="num">{clp(plan.budget)}</b>
            </div>
          </div>
          <div className="bar lg stack" role="img"
            aria-label={`Gastado ${clp(plan.spent)} de ${clp(plan.budget)}; con lo que falta de la lista llegarías a ${clp(projected)}`}>
            <i className="plan" style={{ width: pct(projected) + "%" }} />
            <i className={"now " + (plan.spent > plan.budget ? "bad" : "")} style={{ width: pct(plan.spent) + "%" }} />
          </div>
          <div className="bar-l">
            <span>Gastado <b className="num" style={{ color: "var(--ink)" }}>{clp(plan.spent)}</b></span>
            {pendingTotal > 0 && <span>Con la lista: <b className="num" style={{ color: "var(--ink)" }}>{clp(projected)}</b></span>}
          </div>
          {pendingTotal > 0 && (
            <div style={{ marginTop: 10 }}>
              {projected > plan.budget
                ? <span className="badge bad"><IAlert size={11} /> Con la lista te pasarías por {clp(projected - plan.budget)}</span>
                : <span className="badge good"><ICheck size={11} /> Con la lista te quedarían {clp(plan.budget - projected)}</span>}
            </div>
          )}

          <div className="sb-rows">
            {plan.cards.map(({ card, plan: p, used }) => (
              <div className="sb-row" key={card.id}>
                <i className="dot lg" style={{ background: catColor(card.color) }} />
                <div className="n">
                  <b>{card.name}</b>
                  <small>{p > 0 ? `Carga ${clp(p)} al mes` : "Sin carga mensual"} · saldo {clp(card.balance)}</small>
                </div>
                <div className="m">
                  <span className="num">{clp(used)}{p > 0 && <span className="muted"> / {clp(p)}</span>}</span>
                  {p > 0 && <div className="bar"><i className={used > p ? "bad" : ""} style={{ width: Math.min(100, (used / p) * 100) + "%" }} /></div>}
                </div>
              </div>
            ))}
            <div className="sb-row">
              <span className="sb-ico"><IWallet size={13} /></span>
              <div className="n">
                <b>Extra de tu bolsillo</b>
                <small>{plan.extra > 0 ? `Planeado ${clp(plan.extra)} · sale de tus Cuentas` : "Sin extra planeado"}</small>
              </div>
              <div className="m">
                <span className="num">{clp(plan.pocketUsed)}{plan.extra > 0 && <span className="muted"> / {clp(plan.extra)}</span>}</span>
                {plan.extra > 0 && <div className="bar"><i className={plan.pocketUsed > plan.extra ? "bad" : ""} style={{ width: Math.min(100, (plan.pocketUsed / plan.extra) * 100) + "%" }} /></div>}
              </div>
            </div>
          </div>
          {plan.fromSalary > 0 && (
            <p className="muted sb-note">
              En <b>Cuentas</b>{month ? ` de ${month.label}` : ""} se reservan <b className="num">{clp(plan.fromSalary)}</b> en “{SUPER_LINE}”
              {plan.pocketUsed > plan.extra ? " (gastaste más que tu extra)" : ""}.
              {!month && " Crea el mes en Cuentas para que se descuente de tu sueldo."}
            </p>
          )}
        </>
      )}

      {showEdit && (
        <div className="sb-edit fade">
          {!hasPlan && !cards.length && (
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>
              Arma tu presupuesto como en Cuentas: agrega tus tarjetas de alimentación con lo que te cargan al mes y,
              si quieres, un extra de tu bolsillo (por ejemplo $30.000) para completar la compra.
            </p>
          )}
          {cards.map((c) => (
            <CardEditor key={c.id} card={c} onCard={onCard}
              onDelete={() => confirm(`¿Quitar "${c.name}"?`) && update((d) => { d.market.cards = d.market.cards.filter((x) => x.id !== c.id); })} />
          ))}
          <div className="chips" style={{ margin: "10px 0 14px" }}>
            {CARD_PRESETS.map((p) => (
              <button key={p.name} className="chip dashed" onClick={() => addCard(p)}><IPlus size={13} /> {p.name}</button>
            ))}
          </div>
          <div className="sb-extra">
            <span className="sb-ico"><IWallet size={13} /></span>
            <div className="n">
              <b>Extra de mi bolsillo al mes</b>
              <small>Lo que pones tú además de las tarjetas. Se descuenta de tus Cuentas.</small>
            </div>
            <CurrencyInput className="field sm amount" value={market.extra} placeholder="$0" onChange={setExtra} aria-label="Extra de mi bolsillo al mes" />
          </div>
        </div>
      )}

      {cards.length > 0 && split.total > 0 && (
        <div className="split" aria-live="polite">
          <div className="split-h">
            <span className="muted" style={{ fontSize: 12 }}>Cómo pagarías {scope}</span>
            <div className="chips">
              {cards.map((c) => (
                <button key={c.id} className={"chip sm " + (c.use ? "on" : "")} aria-pressed={c.use}
                  title={c.use ? `No usar ${c.name} en esta compra` : `Usar ${c.name} en esta compra`}
                  onClick={() => onCard(c.id, (x) => { x.use = !x.use; })}>
                  <ICard size={11} /> {c.name}
                </button>
              ))}
            </div>
          </div>
          {split.perCard.map((p) => (
            <div className="line" key={p.card.id}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <i className="dot" style={{ background: catColor(p.card.color) }} /> {p.card.name}
              </span>
              <span className="num">{clp(p.used)} <span className="muted">· queda {clp(p.left)}</span></span>
            </div>
          ))}
          <div className="line big">
            <span>De tu bolsillo</span>
            <span className="num">{clp(active.length ? split.pocket : split.total)}</span>
          </div>
          {active.length > 0 && split.pocket === 0 && <div className="note"><span className="badge good">Todo cubierto por tus tarjetas</span></div>}
          {overExtra > 0 && plan.extra > 0 && (
            <div className="note">Esto es {clp(overExtra)} más de lo que te queda de tu extra ({clp(extraLeft)}).</div>
          )}
          {split.notAccepted > 0 && active.length > 0 && (
            <div className="note">
              {clp(split.notAccepted)} son productos que tus tarjetas no aceptan ({split.rejectedAisles.map(aisleLabel).join(", ")}).
              Si tu tarjeta sí los acepta, cámbialo en “Editar plan → Acepta”.
            </div>
          )}
          {split.overflow > 0 && <div className="note">El saldo de tus tarjetas no alcanza para {clp(split.overflow)} más.</div>}
        </div>
      )}

      {plan.purchases.length > 0 && (
        <div className="mini-list">
          <div className="muted" style={{ fontSize: 12, marginBottom: 2 }}>Compras de este mes</div>
          {[...plan.purchases].reverse().slice(0, 5).map((p) => (
            <div className="r" key={p.id}>
              <span className="n">
                {dayLabel(p.date, today)}{p.store ? ` · ${p.store}` : ""} · {p.count} {p.count === 1 ? "producto" : "productos"}
                {p.card > 0 && ` · tarjeta ${clp(p.card)}`}{p.pocket > 0 && ` · bolsillo ${clp(p.pocket)}`}
              </span>
              <b>{clp(p.total)}</b>
              <button className="btn ghost icon sm danger" title="Quitar del presupuesto (no devuelve saldo a las tarjetas)" aria-label="Quitar compra"
                onClick={() => removePurchase(p.id)}>
                <IX size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CardEditor({ card, onCard, onDelete }: { card: BenefitCard; onCard: (id: string, fn: (c: BenefitCard) => void) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sb-card">
      <div className="sb-card-h">
        <i className="dot lg" style={{ background: catColor(card.color) }} />
        <input className="bare name" value={card.name} maxLength={30} aria-label="Nombre de la tarjeta"
          onChange={(e) => onCard(card.id, (c) => { c.name = e.target.value; })} />
        <button className={"btn sm " + (open ? "on" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>Acepta</button>
        <button className="btn ghost icon sm danger" title="Quitar tarjeta" aria-label={`Quitar ${card.name}`} onClick={onDelete}><ITrash size={14} /></button>
      </div>
      <div className="sb-card-f">
        <label>
          <span>Carga mensual</span>
          <CurrencyInput className="field sm amount" value={card.monthly} placeholder="$0" aria-label={`Carga mensual de ${card.name}`}
            onChange={(v) => onCard(card.id, (c) => { c.monthly = v; })} />
        </label>
        <label>
          <span>Saldo actual</span>
          <CurrencyInput className="field sm amount" value={card.balance} placeholder="$0" aria-label={`Saldo de ${card.name}`}
            onChange={(v) => onCard(card.id, (c) => { c.balance = v; })} />
        </label>
      </div>
      {open && (
        <div className="fade" style={{ paddingTop: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Marca los pasillos donde puedes pagar con {card.name}. Cada comercio tiene sus reglas: ajústalo a tu caso.
          </div>
          <div className="chips">
            {AISLES.map((a) => {
              const on = card.aisles.includes(a.id);
              return (
                <button key={a.id} className={"chip sm " + (on ? "on" : "")} aria-pressed={on}
                  onClick={() => onCard(card.id, (c) => { c.aisles = on ? c.aisles.filter((x) => x !== a.id) : [...c.aisles, a.id]; })}>
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
