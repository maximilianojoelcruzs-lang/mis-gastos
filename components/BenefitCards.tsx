"use client";
import { useState } from "react";
import { AISLES, CARD_PRESETS, DEFAULT_CARD_AISLES, aisleLabel, catColor } from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { BenefitCard, Market } from "@/lib/types";
import type { PaymentSplit } from "@/lib/data";
import CurrencyInput from "./CurrencyInput";
import { ICard, IPlus, ITrash } from "./icons";
import type { Update } from "./Tracker";

type Props = { market: Market; update: Update; split: PaymentSplit; scope: string };

/** Tarjetas de alimentación: saldo, pasillos que aceptan y reparto tarjeta / bolsillo. */
export default function BenefitCards({ market, update, split, scope }: Props) {
  const { cards } = market;
  const onCard = (id: string, fn: (c: BenefitCard) => void) =>
    update((d) => {
      const c = d.market.cards.find((x) => x.id === id);
      if (c) fn(c);
    });
  const addCard = (preset: (typeof CARD_PRESETS)[number]) =>
    update((d) => {
      d.market.cards.push({ id: uid(), name: preset.name, balance: 0, aisles: [...DEFAULT_CARD_AISLES], color: preset.color, use: true });
    });
  const active = cards.filter((c) => c.use);

  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Tarjetas de alimentación</h2>
          <div className="sub">Amipass, Sodexo, Edenred u otra: calcula cuánto cubre la tarjeta y cuánto pones tú.</div>
        </div>
      </div>

      {cards.map((c) => (
        <CardRow key={c.id} card={c} onCard={onCard}
          onDelete={() => confirm(`¿Quitar "${c.name}"?`) && update((d) => { d.market.cards = d.market.cards.filter((x) => x.id !== c.id); })} />
      ))}

      <div className="chips" style={{ marginTop: cards.length ? 12 : 0 }}>
        {CARD_PRESETS.map((p) => (
          <button key={p.name} className="chip dashed" onClick={() => addCard(p)}>
            <IPlus size={13} /> {p.name}
          </button>
        ))}
      </div>

      {active.length > 0 && (
        <div className="split" aria-live="polite">
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Calculado sobre {scope}</div>
          {split.perCard.map((p) => (
            <div className="line" key={p.card.id}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <i className="dot" style={{ background: catColor(p.card.color) }} /> {p.card.name}
              </span>
              <span className="num">
                {clp(p.used)} <span className="muted">· queda {clp(p.left)}</span>
              </span>
            </div>
          ))}
          <div className="line big">
            <span>De tu bolsillo</span>
            <span className="num">{clp(split.pocket)}</span>
          </div>
          {split.total > 0 && split.pocket === 0 && (
            <div className="note">
              <span className="badge good">Todo cubierto por tus tarjetas</span>
            </div>
          )}
          {split.notAccepted > 0 && (
            <div className="note">
              {clp(split.notAccepted)} son productos que tus tarjetas no aceptan ({split.rejectedAisles.map(aisleLabel).join(", ")}).
              Si tu tarjeta sí los acepta, actívalo en “Acepta”.
            </div>
          )}
          {split.overflow > 0 && (
            <div className="note">El saldo de tus tarjetas no alcanza para {clp(split.overflow)} más.</div>
          )}
        </div>
      )}
      {cards.length > 0 && active.length === 0 && (
        <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>Activa una tarjeta para ver cómo se reparte tu compra.</p>
      )}
    </section>
  );
}


function CardRow({ card, onCard, onDelete }: { card: BenefitCard; onCard: (id: string, fn: (c: BenefitCard) => void) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className="cardrow">
        <button className={"toggle " + (card.use ? "on" : "")} aria-label={`Usar ${card.name} en esta compra`} aria-pressed={card.use}
          onClick={() => onCard(card.id, (c) => { c.use = !c.use; })} />
        <ICard size={15} />
        <i className="dot lg" style={{ background: catColor(card.color) }} />
        <input className="bare name" value={card.name} maxLength={30} aria-label="Nombre de la tarjeta"
          onChange={(e) => onCard(card.id, (c) => { c.name = e.target.value; })} />
        <span className="saldo">
          <span className="muted" style={{ fontSize: 12 }}>Saldo</span>
          <CurrencyInput className="bare amount" value={card.balance} placeholder="$0"
            onChange={(v) => onCard(card.id, (c) => { c.balance = v; })} />
        </span>
        <span className="saldo">
          <button className={"btn sm " + (open ? "on" : "")} onClick={() => setOpen(!open)}>Acepta</button>
          <button className="btn ghost icon sm danger" title="Quitar tarjeta" onClick={onDelete}><ITrash size={14} /></button>
        </span>
      </div>
      {open && (
        <div className="fade" style={{ padding: "4px 0 12px 4px" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Marca los pasillos donde puedes pagar con {card.name}. Cada comercio tiene sus reglas: ajústalo a tu caso.
          </div>
          <div className="chips">
            {AISLES.map((a) => {
              const on = card.aisles.includes(a.id);
              return (
                <button key={a.id} className={"chip " + (on ? "on" : "")} aria-pressed={on}
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
