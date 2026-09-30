"use client";
import { useEffect, useState } from "react";
import {
  AISLES, aisleLabel, guessAisle, latestByStore, previousPrice, priceKey, recordPrice, splitPayment, storeComparison, todayISO,
} from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { AisleId, AppData, MarketItem } from "@/lib/types";
import BenefitCards from "./BenefitCards";
import CurrencyInput from "./CurrencyInput";
import {
  IArrowDown, IArrowRight, IArrowUp, IBookmark, ICheck, IMore, IPlus, IStore, ITrash, IX,
} from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; notify: Notify };
type View = "lista" | "pasillos";

export default function MarketTab({ data, update, notify }: Props) {
  const { market } = data;
  const { items, templates, stores, store, cards } = market;
  const [view, setView] = useState<View>("lista");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("mg-market-view") === "pasillos") setView("pasillos");
    } catch { /* sin almacenamiento */ }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem("mg-market-view", v); } catch { /* sin almacenamiento */ }
  };

  const lineTotal = (i: MarketItem) => (Number(i.price) || 0) * (Number(i.qty) || 1);
  const total = items.reduce((s, i) => s + lineTotal(i), 0);
  const cart = items.filter((i) => i.done);
  const cartTotal = cart.reduce((s, i) => s + lineTotal(i), 0);
  const donePct = items.length > 0 ? (cart.length / items.length) * 100 : 0;
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];

  // La compra a repartir es el carro; si aún no hay nada marcado, toda la lista.
  const base = cart.length ? cart : items;
  const split = splitPayment(base, cards);
  const usingCards = split.perCard.length > 0;
  const scope = cart.length ? `el carro (${cart.length} ${cart.length === 1 ? "producto" : "productos"})` : "toda la lista";
  const comparison = storeComparison(market);

  const setItem = <K extends keyof MarketItem>(id: string, key: K, value: MarketItem[K]) =>
    update((d) => {
      const it = d.market.items.find((i) => i.id === id);
      if (it) it[key] = value;
    });

  const toggle = (id: string) =>
    update((d) => {
      const it = d.market.items.find((i) => i.id === id);
      if (!it) return;
      it.done = !it.done;
      if (it.done) recordPrice(d.market, it.name, it.price, d.market.store);
    });

  const setStorePrice = (id: string, storeName: string, price: number) =>
    update((d) => {
      const it = d.market.items.find((i) => i.id === id);
      if (!it || !it.name.trim()) return;
      if (price > 0) recordPrice(d.market, it.name, price, storeName);
      else {
        const k = priceKey(it.name);
        if (d.market.history[k]) d.market.history[k] = d.market.history[k].filter((p) => !(p.date === todayISO() && p.store === storeName));
      }
    });

  const applyStorePrices = () => {
    if (!store) return;
    const changes = items.filter((i) => {
      const p = latestByStore(market, i.name)[store];
      return p && p.price !== i.price;
    }).length;
    if (!changes) return notify(`No hay precios distintos guardados de ${store}`);
    update((d) => {
      for (const it of d.market.items) {
        const p = latestByStore(d.market, it.name)[d.market.store];
        if (p) it.price = p.price;
      }
    });
    notify(`Precios de ${store} aplicados a ${changes} ${changes === 1 ? "producto" : "productos"}`);
  };

  const saveTemplate = () => {
    if (!items.length) return;
    const name = prompt("Nombre de la lista (ej: Compra semanal):", "Compra semanal");
    if (!name?.trim()) return;
    update((d) => {
      const existing = d.market.templates.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
      const tplItems = d.market.items.filter((i) => i.name.trim()).map((i) => ({ name: i.name, qty: i.qty, price: i.price }));
      if (existing) existing.items = tplItems;
      else d.market.templates.push({ id: uid(), name: name.trim(), items: tplItems });
    });
    notify(`Lista "${name.trim()}" guardada`);
  };

  const loadTemplate = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const have = new Set(items.map((i) => i.name.trim().toLowerCase()));
    const missing = tpl.items.filter((t) => !have.has(t.name.trim().toLowerCase()));
    if (missing.length)
      update((d) => {
        for (const t of missing)
          d.market.items.push({ id: uid(), name: t.name, qty: t.qty, price: t.price, done: false, aisle: guessAisle(t.name) });
      });
    notify(missing.length
      ? `${tpl.name}: ${missing.length} ${missing.length === 1 ? "producto agregado" : "productos agregados"}`
      : `${tpl.name}: ya tenías todo en la lista`);
  };

  // Registra la compra: descuenta de las tarjetas y suma a Gastos solo lo que pagas tú.
  const registerPurchase = () => {
    if (!base.length || !split.total) return;
    const [, m, d] = todayISO().split("-");
    const pocket = usingCards ? split.pocket : split.total;
    const used = split.perCard.filter((p) => p.used > 0);
    const message = usingCards
      ? `Compra de ${clp(split.total)}: ${used.map((p) => `${p.card.name} ${clp(p.used)}`).join(" + ") || "sin usar tarjetas"}` +
        `${pocket > 0 ? ` y ${clp(pocket)} de tu bolsillo` : ""}.\n\nSe descontará de los saldos de tus tarjetas` +
        `${pocket > 0 ? ` y se agregarán ${clp(pocket)} a los gastos de ${month.label}` : ""}. ¿Continuar?`
      : `¿Agregar ${clp(pocket)} como gasto "Supermercado ${d}/${m}" en ${month.label}?`;
    if (!confirm(message)) return;
    update((draft) => {
      for (const p of used) {
        const card = draft.market.cards.find((c) => c.id === p.card.id);
        if (card) card.balance = Math.max(0, card.balance - p.used);
      }
      if (pocket > 0) {
        const target = draft.months.find((x) => x.id === draft.activeId) || draft.months[0];
        target.items.push({
          id: uid(), name: `Supermercado ${d}/${m}${draft.market.store ? ` · ${draft.market.store}` : ""}`, amount: pocket, paid: true,
          category: draft.categories.some((c) => c.id === "comida") ? "comida" : "otros", fixed: false, dueDay: null, installment: null,
        });
      }
    });
    notify(usingCards
      ? pocket > 0 ? `Registrado: ${clp(pocket)} a Gastos, el resto con tarjeta` : "Registrado: pagado con tu tarjeta"
      : `Agregado a Gastos de ${month.label}`);
  };

  const clearDone = () => {
    if (confirm("¿Quitar los productos ya comprados de la lista?"))
      update((d) => { d.market.items = d.market.items.filter((i) => !i.done); });
  };

  const renderItem = (it: MarketItem) => {
    const prev = it.price > 0 ? previousPrice(market, it.name, store) : null;
    const diff = prev ? Math.round(((it.price - prev.price) / prev.price) * 100) : 0;
    const known = latestByStore(market, it.name);
    const knownPrices = Object.values(known).map((p) => p.price);
    const cheapest = knownPrices.length > 1 ? Math.min(...knownPrices) : 0;
    const isOpen = open === it.id;
    return (
      <div key={it.id}>
        <div className={"row " + (it.done ? "done" : "")}>
          <button className={"check " + (it.done ? "on" : "")} onClick={() => toggle(it.id)} title="Marcar como comprado">
            {it.done && <ICheck size={12} />}
          </button>
          <div className="cell">
            <input className="bare name" value={it.name} placeholder="Producto"
              onChange={(e) => setItem(it.id, "name", e.target.value)}
              onBlur={(e) => { if (it.aisle === "otros" && e.target.value) setItem(it.id, "aisle", guessAisle(e.target.value)); }} />
            {(prev || view === "lista") && (
              <div className="sub">
                {view === "lista" && <span>{aisleLabel(it.aisle)}</span>}
                {prev && (
                  <>
                    {view === "lista" && <span>·</span>}
                    {diff > 0 ? <IArrowUp size={11} /> : diff < 0 ? <IArrowDown size={11} /> : null}
                    <span title={`Último precio registrado: ${prev.date}${prev.store ? ` en ${prev.store}` : ""}`}>
                      {diff === 0 ? "Igual que la última vez" : `${diff > 0 ? "Subió" : "Bajó"} ${Math.abs(diff)}%`} · antes {clp(prev.price)}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <input className="bare qty" inputMode="numeric" value={it.qty || 1} title="Cantidad"
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
              setItem(it.id, "qty", n > 0 ? n : 1);
            }} />
          <CurrencyInput className="bare amount" value={it.price} placeholder="$0"
            onChange={(v) => setItem(it.id, "price", v)} />
          <button className={"btn icon sm " + (isOpen ? "" : "ghost")} title="Opciones" onClick={() => setOpen(isOpen ? null : it.id)}>
            <IMore size={15} />
          </button>
        </div>
        {isOpen && (
          <div className="detail fade">
            <label className="f">
              <span>Pasillo</span>
              <select className="field sm" value={it.aisle} onChange={(e) => setItem(it.id, "aisle", e.target.value as AisleId)}>
                {AISLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <div className="f">
              <span>Subtotal</span>
              <b className="num" style={{ fontWeight: 500, lineHeight: "30px" }}>{clp(lineTotal(it))}</b>
            </div>
            <div className="f wide">
              <span>Precio por supermercado (hoy)</span>
              {!it.name.trim() ? (
                <span className="muted" style={{ fontSize: 12.5 }}>Escribe el nombre del producto para guardar precios por tienda.</span>
              ) : stores.length === 0 ? (
                <span className="muted" style={{ fontSize: 12.5 }}>Agrega supermercados en Ajustes para comparar precios.</span>
              ) : (
                <div className="pricegrid">
                  {stores.map((s) => {
                    const p = known[s];
                    return (
                      <div key={s} className={"pricecell " + (p && cheapest && p.price === cheapest ? "best" : "")}>
                        <span className="n" title={s}>{s}</span>
                        <CurrencyInput className="bare amount" value={p?.price || 0} placeholder="$0"
                          onChange={(v) => setStorePrice(it.id, s, v)} />
                        {p && cheapest > 0 && p.price === cheapest && <span className="badge good">Más barato</span>}
                        {p && p.price !== it.price && (
                          <button className="btn sm" onClick={() => setItem(it.id, "price", p.price)}>Usar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="foot">
              <span className="muted" style={{ fontSize: 12 }}>Los precios se guardan con la fecha, para ver cuándo sube o baja.</span>
              <button className="btn sm danger" onClick={() => { update((d) => { d.market.items = d.market.items.filter((i) => i.id !== it.id); }); setOpen(null); }}>
                <ITrash size={13} /> Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const grouped = AISLES.map((a) => ({ aisle: a, list: items.filter((i) => i.aisle === a.id) })).filter((g) => g.list.length);

  return (
    <div>
      <section className="card">
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="l">Total estimado</div>
            <div className="v">{clp(total)}</div>
            {usingCards && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                De tu bolsillo: <b className="num" style={{ color: "var(--ink)" }}>{clp(split.pocket)}</b>
              </div>
            )}
          </div>
          <button className="btn" onClick={registerPurchase} disabled={!split.total}
            title="Registra la compra en tus gastos del mes activo">
            <IArrowRight size={14} /> {usingCards ? "Registrar compra" : `Pasar ${cart.length ? "carro" : "total"} a Gastos`}
          </button>
        </div>
        <div className="bar"><i style={{ width: donePct + "%" }} /></div>
        <div className="bar-l">
          <span>{cart.length} de {items.length} en el carro</span>
          <span className="num">{clp(cartTotal)}</span>
        </div>

        {stores.length > 0 && (
          <>
            <hr className="hr" />
            <div className="storebar">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IStore size={14} /> Comprando en</span>
              {stores.map((s) => (
                <button key={s} className={"chip " + (store === s ? "on" : "")} aria-pressed={store === s}
                  onClick={() => update((d) => { d.market.store = d.market.store === s ? "" : s; })}>
                  {s}
                </button>
              ))}
              {store && (
                <button className="btn sm" onClick={applyStorePrices} title={`Rellena los precios con lo último que anotaste en ${store}`}>
                  Aplicar precios de {store}
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <BenefitCards market={market} update={update} split={split} scope={scope} />

      {items.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2>¿Dónde conviene comprar?</h2>
              <div className="sub">Según los últimos precios que anotaste en cada supermercado.</div>
            </div>
          </div>
          {comparison.quotes.every((q) => q.covered === 0) ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Aún no hay precios por tienda. Abre las opciones (⋯) de un producto y anota su precio en cada supermercado,
              o elige dónde estás comprando y marca los productos al echarlos al carro.
            </div>
          ) : (
            comparison.quotes.filter((q) => q.covered > 0).map((q) => (
              <div className="quote" key={q.store}>
                <span className="n">
                  {q.store}
                  {comparison.best === q.store && <span className="badge good"><ICheck size={11} /> Más barato</span>}
                </span>
                <span className="c">{q.covered}/{q.count} con precio</span>
                <span className="v">{clp(q.total)}</span>
              </div>
            ))
          )}
          {comparison.quotes.some((q) => q.covered > 0 && q.covered < q.count) && (
            <p className="muted" style={{ fontSize: 12, margin: "10px 0 0" }}>
              Los totales incluyen solo los productos con precio en esa tienda; compara tiendas con la misma cantidad de precios.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Listas guardadas</h2>
            <div className="sub">Carga una lista para agregar solo lo que falta.</div>
          </div>
          <button className="btn sm" onClick={saveTemplate} disabled={!items.length}>
            <IBookmark size={13} /> Guardar lista actual
          </button>
        </div>
        {templates.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Aún no tienes listas. Arma tu compra y guárdala para reutilizarla.</div>
        ) : (
          <div className="chips">
            {templates.map((t) => (
              <button key={t.id} className="chip" onClick={() => loadTemplate(t.id)} title={`Cargar ${t.items.length} productos`}>
                {t.name} <span className="muted">· {t.items.length}</span>
                <span className="x" role="button" aria-label="Eliminar lista"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`¿Eliminar la lista "${t.name}"?`))
                      update((d) => { d.market.templates = d.market.templates.filter((x) => x.id !== t.id); });
                  }}>
                  <IX size={12} />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-h">
          <h2>Lista de compra</h2>
          <div className="seg" role="group" aria-label="Vista">
            <button className={view === "lista" ? "on" : ""} onClick={() => changeView("lista")}>Lista</button>
            <button className={view === "pasillos" ? "on" : ""} onClick={() => changeView("pasillos")}>Por pasillo</button>
          </div>
        </div>
        {items.length === 0 ? (
          <div className="empty">Tu lista está vacía. Agrega un producto o carga una lista guardada.</div>
        ) : view === "lista" ? (
          <div className="rows">{items.map(renderItem)}</div>
        ) : (
          grouped.map((g) => (
            <div key={g.aisle.id}>
              <div className="group-h">
                <span>{g.aisle.label}</span>
                <span className="num">{clp(g.list.reduce((s, i) => s + lineTotal(i), 0))}</span>
              </div>
              <div className="rows">{g.list.map(renderItem)}</div>
            </div>
          ))
        )}
        <div className="add-row">
          <button className="btn dashed"
            onClick={() => update((d) => { d.market.items.push({ id: uid(), name: "", qty: 1, price: 0, done: false, aisle: "otros" }); })}>
            <IPlus size={14} /> Agregar producto
          </button>
        </div>
      </section>

      <div className="foot-note">
        <span>Al marcar un producto como comprado se guarda su precio{store ? ` en ${store}` : ""} en el historial.</span>
        {cart.length > 0 && <button className="btn ghost sm" onClick={clearDone}><ITrash size={13} /> Quitar comprados</button>}
      </div>
    </div>
  );
}
