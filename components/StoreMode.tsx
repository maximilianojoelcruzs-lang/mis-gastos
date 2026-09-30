"use client";
import { useEffect, useState } from "react";
import { AISLES, splitPayment, toggleItem } from "@/lib/data";
import { clp } from "@/lib/format";
import type { SharedList } from "@/lib/useSharedList";
import type { AppData } from "@/lib/types";
import AddMany from "./AddMany";
import CurrencyInput from "./CurrencyInput";
import { ICheck, IUsers, IX } from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = {
  data: AppData;
  update: Update;
  notify: Notify;
  shared: SharedList;
  onClose: () => void;
  onRegister: () => void;
};

/** Pantalla de compra: botones grandes, lista por pasillo y pantalla siempre encendida. */
export default function StoreMode({ data, update, notify, shared, onClose, onRegister }: Props) {
  const { items, stores, store, cards } = data.market;
  const [showDone, setShowDone] = useState(false);

  // Mantiene la pantalla encendida mientras compras (si el navegador lo permite).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = (navigator as any).wakeLock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lock: any = null;
    const request = async () => {
      try {
        lock = await wl?.request("screen");
      } catch {
        /* sin permiso o sin soporte: se ignora */
      }
    };
    request();
    const onVis = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVis);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("keydown", onKey);
      lock?.release?.();
    };
  }, [onClose]);

  const line = (i: { price: number; qty: number }) => (Number(i.price) || 0) * (Number(i.qty) || 1);
  const cart = items.filter((i) => i.done);
  const cartTotal = cart.reduce((s, i) => s + line(i), 0);
  const missing = items.filter((i) => !i.done).reduce((s, i) => s + line(i), 0);
  const pct = items.length ? (cart.length / items.length) * 100 : 0;
  const split = splitPayment(cart, cards);
  const activeCards = cards.some((c) => c.use);

  const groups = AISLES.map((a) => ({
    aisle: a,
    list: items.filter((i) => i.aisle === a.id && (showDone || !i.done)),
  })).filter((g) => g.list.length);

  return (
    <div className="storemode" role="dialog" aria-modal="true" aria-label="Modo tienda">
      <header className="sm-head">
        <button className="btn" onClick={onClose}><IX size={15} /> Salir</button>
        <div className="sm-title">
          <b>Modo tienda</b>
          {shared.link && <span className="badge"><IUsers size={11} /> {shared.link.name}</span>}
        </div>
        <button className="btn primary" onClick={onRegister} disabled={!cart.length && !items.length}>Registrar</button>
      </header>

      <div className="sm-sum">
        <div className="sm-nums">
          <div><span>En el carro</span><b className="num">{clp(cartTotal)}</b></div>
          <div><span>Falta</span><b className="num">{clp(missing)}</b></div>
          {activeCards && cart.length > 0 && <div><span>Tu bolsillo</span><b className="num">{clp(split.pocket)}</b></div>}
        </div>
        <div className="bar lg"><i style={{ width: pct + "%" }} /></div>
        <div className="bar-l"><span>{cart.length} de {items.length} en el carro</span>
          <button className="linkbtn" onClick={() => setShowDone(!showDone)}>{showDone ? "Ocultar comprados" : "Mostrar comprados"}</button>
        </div>
        {stores.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {stores.map((s) => (
              <button key={s} className={"chip " + (store === s ? "on" : "")} aria-pressed={store === s}
                onClick={() => update((d) => { d.market.store = d.market.store === s ? "" : s; })}>{s}</button>
            ))}
          </div>
        )}
      </div>

      <div className="sm-body">
        {groups.length === 0 ? (
          <div className="empty" style={{ padding: "40px 0" }}>
            {items.length === 0 ? "Tu lista está vacía. Agrega productos abajo." : "Ya tienes todo en el carro."}
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.aisle.id}>
              <div className="sm-aisle">{g.aisle.label}</div>
              {g.list.map((it) => (
                <div key={it.id} role="button" tabIndex={0} className={"sm-row " + (it.done ? "done" : "")}
                  aria-pressed={it.done}
                  onClick={() => update((d) => { toggleItem(d.market, it.id); })}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); update((d) => { toggleItem(d.market, it.id); }); } }}>
                  <span className={"sm-check " + (it.done ? "on" : "")}>{it.done && <ICheck size={20} />}</span>
                  <span className="sm-name">{it.name || "Sin nombre"}{it.qty > 1 && <em> ×{it.qty}</em>}</span>
                  <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <CurrencyInput className="bare amount sm-price" value={it.price} placeholder="$0"
                      onChange={(v) => update((d) => { const x = d.market.items.find((y) => y.id === it.id); if (x) x.price = v; })} />
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      <footer className="sm-foot">
        <AddMany data={data} update={update} notify={notify} size="lg" />
      </footer>
    </div>
  );
}
