"use client";
import { useEffect, useState } from "react";
import {
  AISLES, SUPER_LINE, addProducts, aisleLabel, currentPeriod, frequentProducts, guessAisle, latestByStore, logPurchase, markBought,
  previousPrice, priceKey, recordPrice, splitPayment, storeComparison, syncSuperLine, todayISO, toggleItem,
} from "@/lib/data";
import { clp, dayLabel, uid } from "@/lib/format";
import type { SharedList } from "@/lib/useSharedList";
import type { AisleId, AppData, MarketItem } from "@/lib/types";
import AddMany from "./AddMany";
import SuperBudget from "./SuperBudget";
import CurrencyInput from "./CurrencyInput";
import Modal from "./Modal";
import {
  IArrowDown, IArrowRight, IArrowUp, IBookmark, ICheck, IExpand, IMore, IPlus, IStore, ITrash, IUsers, IX,
} from "./icons";
import SharedListCard from "./SharedListCard";
import StoreMode from "./StoreMode";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; notify: Notify; shared: SharedList };
type View = "lista" | "pasillos";

export default function MarketTab({ data, update, notify, shared }: Props) {
  const { market } = data;
  const { items, templates, stores, store, cards } = market;
  const [view, setView] = useState<View>("lista");
  const [open, setOpen] = useState<string | null>(null);
  const [storeMode, setStoreMode] = useState(false);
  const [clearing, setClearing] = useState(false);

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
  const pendingTotal = items.filter((i) => !i.done).reduce((s, i) => s + lineTotal(i), 0);
  const donePct = items.length > 0 ? (cart.length / items.length) * 100 : 0;
  const today = todayISO();

  // La compra a repartir es el carro; si aún no hay nada marcado, toda la lista.
  const base = cart.length ? cart : items;
  const split = splitPayment(base, cards);
  const usingCards = split.perCard.length > 0;
  const scope = cart.length ? `el carro (${cart.length} ${cart.length === 1 ? "producto" : "productos"})` : "toda la lista";
  const comparison = storeComparison(market);

  const period = currentPeriod();

  // Lo que sueles comprar (y que aún no está en la lista)
  const inList = new Set(items.filter((i) => !i.done).map((i) => priceKey(i.name)));
  const usual = frequentProducts(market).filter((f) => !inList.has(f.key));

  const setItem = <K extends keyof MarketItem>(id: string, key: K, value: MarketItem[K]) =>
    update((d) => {
      const it = d.market.items.find((i) => i.id === id);
      if (it) it[key] = value;
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

  const addUsual = (list: { name: string; qty: number }[]) => {
    update((d) => { addProducts(d.market, list); });
    notify(list.length === 1 ? `Agregué ${list[0].name}` : `Agregué ${list.length} productos`);
  };

  // Registra la compra: descuenta de las tarjetas, suma a Gastos lo que pagas tú
  // y la anota en el presupuesto del súper.
  const registerPurchase = () => {
    if (!base.length || !split.total) return;
    const pocket = usingCards ? split.pocket : split.total;
    const used = split.perCard.filter((p) => p.used > 0);
    const message = `Compra de ${clp(split.total)}: ` +
      [...used.map((p) => `${p.card.name} ${clp(p.used)}`), ...(pocket > 0 ? [`${clp(pocket)} de tu bolsillo`] : [])].join(" + ") +
      (used.length ? ".\n\nSe descontará del saldo de tus tarjetas" : ".\n\nSe registrará en tu presupuesto del súper") +
      (pocket > 0 ? ` y lo de tu bolsillo se suma a "${SUPER_LINE}" en Cuentas` : "") +
      `. Los productos comprados salen de la lista. ¿Continuar?`;
    if (!confirm(message)) return;
    const ids = new Set(base.map((i) => i.id));
    update((draft) => {
      for (const p of used) {
        const card = draft.market.cards.find((c) => c.id === p.card.id);
        if (card) card.balance = Math.max(0, card.balance - p.used);
      }
      logPurchase(draft.market, {
        total: split.total, card: usingCards ? split.covered : 0, pocket, store: draft.market.store, count: base.length,
        byCard: Object.fromEntries(used.map((p) => [p.card.id, p.used])),
      });
      // Lo de tu bolsillo queda en una sola línea del mes en Cuentas (no una por compra).
      syncSuperLine(draft, period);
      // Guarda precios y frecuentes de lo comprado y lo saca de la lista, para no registrarlo dos veces.
      for (const it of draft.market.items) if (ids.has(it.id) && !it.done) markBought(draft.market, it);
      draft.market.items = draft.market.items.filter((it) => !ids.has(it.id));
    });
    notify(used.length
      ? pocket > 0 ? `Compra registrada: ${clp(pocket)} de tu bolsillo, el resto con tarjeta` : "Compra registrada: pagada con tu tarjeta"
      : `Compra registrada: ${clp(pocket)} de tu bolsillo`);
  };

  // Solo saca productos de la lista: los precios, el historial y lo que compras seguido se mantienen.
  const clearList = (all: boolean) => {
    const n = all ? items.length : cart.length;
    update((d) => { d.market.items = all ? [] : d.market.items.filter((i) => !i.done); });
    setClearing(false);
    setOpen(null);
    notify(all ? `Lista vaciada (${n} ${n === 1 ? "producto" : "productos"})` : `Quitaste ${n} ${n === 1 ? "producto comprado" : "productos comprados"}`);
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
          <button className={"check " + (it.done ? "on" : "")} onClick={() => update((d) => { toggleItem(d.market, it.id); })} title="Marcar como comprado">
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
      <SuperBudget data={data} update={update} notify={notify} split={split} scope={scope} pendingTotal={pendingTotal} />

      <section className="card">
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="l">
              Total estimado
              {shared.link && <span className="badge"><IUsers size={11} /> Compartida{shared.members.length > 1 ? ` · ${shared.members.length} personas` : ""}</span>}
            </div>
            <div className="v">{clp(total)}</div>
            {usingCards && (
              <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                De tu bolsillo: <b className="num" style={{ color: "var(--ink)" }}>{clp(split.pocket)}</b>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setStoreMode(true)} title="Pantalla grande para comprar en la tienda">
              <IExpand size={14} /> Modo tienda
            </button>
            {items.length > 0 && (
              <button className="btn" onClick={() => setClearing(true)} title="Quitar productos de la lista">
                <ITrash size={14} /> Limpiar
              </button>
            )}
            <button className="btn" onClick={registerPurchase} disabled={!split.total}
              title="Registra la compra en tus gastos del mes activo">
              <IArrowRight size={14} /> Registrar compra
            </button>
          </div>
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

      {usual.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Lo que sueles comprar</h2>
              <div className="sub">Productos que has comprado en más de un día. Toca uno para agregarlo.</div>
            </div>
            <button className="btn sm" onClick={() => addUsual(usual.map((u) => ({ name: u.name, qty: u.qty })))}>
              <IPlus size={13} /> Agregar todos ({usual.length})
            </button>
          </div>
          <div className="chips">
            {usual.map((u) => (
              <button key={u.key} className="chip" onClick={() => addUsual([{ name: u.name, qty: u.qty }])}
                title={`Comprado ${u.times} días · última vez ${dayLabel(u.last, today)}`}>
                <IPlus size={12} /> {u.name}{u.qty > 1 ? ` ×${u.qty}` : ""}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-h">
          <h2>Lista de compra</h2>
          <div className="seg" role="group" aria-label="Vista">
            <button className={view === "lista" ? "on" : ""} onClick={() => changeView("lista")}>Lista</button>
            <button className={view === "pasillos" ? "on" : ""} onClick={() => changeView("pasillos")}>Por pasillo</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <AddMany data={data} update={update} notify={notify} />
        </div>
        {items.length === 0 ? (
          <div className="empty">Tu lista está vacía. Agrega productos arriba o carga una lista guardada.</div>
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
            <IPlus size={14} /> Agregar un producto
          </button>
        </div>
      </section>


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

      <SharedListCard market={market} shared={shared} notify={notify} />

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

      <div className="foot-note">
        <span>Al marcar un producto como comprado se guarda su precio{store ? ` en ${store}` : ""} y aprendo lo que compras seguido.</span>
        {cart.length > 0 && <button className="btn ghost sm" onClick={() => setClearing(true)}><ITrash size={13} /> Quitar comprados</button>}
      </div>

      {clearing && (
        <Modal onClose={() => setClearing(false)} label="Limpiar lista">
          <h2>Limpiar lista</h2>
          <p className="lead">
            Tienes {items.length} {items.length === 1 ? "producto" : "productos"}, {cart.length} ya en el carro.
            Los precios guardados y lo que compras seguido no se borran.
            {shared.link ? " La lista es compartida: también se limpiará para las demás personas." : ""}
          </p>
          <div className="clear-opts">
            <button className="btn" disabled={!cart.length} onClick={() => clearList(false)}>
              <ICheck size={14} /> Quitar los comprados ({cart.length})
            </button>
            <button className="btn danger" onClick={() => clearList(true)}>
              <ITrash size={14} /> Vaciar toda la lista ({items.length})
            </button>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => setClearing(false)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {storeMode && (
        <StoreMode data={data} update={update} notify={notify} shared={shared}
          onClose={() => setStoreMode(false)} onRegister={registerPurchase} />
      )}
    </div>
  );
}
