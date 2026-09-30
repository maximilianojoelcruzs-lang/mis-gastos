"use client";
import { previousPrice, recordPrice, todayISO } from "@/lib/data";
import { clp, uid } from "@/lib/format";
import type { AppData, MarketItem } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { IArrowDown, IArrowRight, IArrowUp, IBookmark, ICheck, IPlus, ITrash, IX } from "./icons";
import type { Notify, Update } from "./Tracker";

type Props = { data: AppData; update: Update; notify: Notify };

export default function MarketTab({ data, update, notify }: Props) {
  const { items, templates } = data.market;
  const lineTotal = (i: MarketItem) => (Number(i.price) || 0) * (Number(i.qty) || 1);
  const total = items.reduce((s, i) => s + lineTotal(i), 0);
  const cart = items.filter((i) => i.done);
  const cartTotal = cart.reduce((s, i) => s + lineTotal(i), 0);
  const donePct = items.length > 0 ? (cart.length / items.length) * 100 : 0;
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];

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
      if (it.done) recordPrice(d.market, it.name, it.price);
    });

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
        for (const t of missing) d.market.items.push({ id: uid(), name: t.name, qty: t.qty, price: t.price, done: false });
      });
    notify(missing.length
      ? `${tpl.name}: ${missing.length} ${missing.length === 1 ? "producto agregado" : "productos agregados"}`
      : `${tpl.name}: ya tenías todo en la lista`);
  };

  const sendToExpenses = () => {
    const amount = cart.length ? cartTotal : total;
    if (!amount) return;
    const [, m, d] = todayISO().split("-");
    if (!confirm(`¿Agregar ${clp(amount)} como gasto "Supermercado ${d}/${m}" en ${month.label}?`)) return;
    update((draft) => {
      const target = draft.months.find((x) => x.id === draft.activeId) || draft.months[0];
      target.items.push({
        id: uid(), name: `Supermercado ${d}/${m}`, amount, paid: true,
        category: "comida", fixed: false, dueDay: null, installment: null,
      });
    });
    notify(`Agregado a Gastos de ${month.label}`);
  };

  const clearDone = () => {
    if (confirm("¿Quitar los productos ya comprados de la lista?"))
      update((d) => { d.market.items = d.market.items.filter((i) => !i.done); });
  };

  return (
    <div>
      <section className="card">
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="l">Total estimado</div>
            <div className="v">{clp(total)}</div>
          </div>
          <button className="btn" onClick={sendToExpenses} disabled={!total}
            title="Registra el total como un gasto del mes activo">
            <IArrowRight size={14} /> Pasar {cart.length ? "carro" : "total"} a Gastos
          </button>
        </div>
        <div className="bar"><i style={{ width: donePct + "%" }} /></div>
        <div className="bar-l">
          <span>{cart.length} de {items.length} en el carro</span>
          <span className="num">{clp(cartTotal)}</span>
        </div>
      </section>

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
          <span className="muted">{items.length} {items.length === 1 ? "producto" : "productos"}</span>
        </div>
        <div className="rows">
          {items.length === 0 && <div className="empty">Tu lista está vacía. Agrega un producto o carga una lista guardada.</div>}
          {items.map((it) => {
            const prev = it.price > 0 ? previousPrice(data.market, it.name) : null;
            const diff = prev ? Math.round(((it.price - prev.price) / prev.price) * 100) : 0;
            return (
              <div className={"row " + (it.done ? "done" : "")} key={it.id}>
                <button className={"check " + (it.done ? "on" : "")} onClick={() => toggle(it.id)} title="Marcar como comprado">
                  {it.done && <ICheck size={12} />}
                </button>
                <div className="cell">
                  <input className="bare name" value={it.name} placeholder="Producto"
                    onChange={(e) => setItem(it.id, "name", e.target.value)} />
                  {prev && (
                    <div className="sub" title={`Último precio registrado: ${prev.date}`}>
                      {diff > 0 ? <IArrowUp size={11} /> : diff < 0 ? <IArrowDown size={11} /> : null}
                      {diff === 0 ? "Mismo precio que la última vez" : `${diff > 0 ? "Subió" : "Bajó"} ${Math.abs(diff)}%`} · antes {clp(prev.price)}
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
                <button className="btn ghost icon sm danger" title="Eliminar"
                  onClick={() => update((d) => { d.market.items = d.market.items.filter((i) => i.id !== it.id); })}>
                  <ITrash size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="add-row">
          <button className="btn dashed"
            onClick={() => update((d) => { d.market.items.push({ id: uid(), name: "", qty: 1, price: 0, done: false }); })}>
            <IPlus size={14} /> Agregar producto
          </button>
        </div>
      </section>

      <div className="foot-note">
        <span>Al marcar un producto como comprado se guarda su precio en el historial.</span>
        {cart.length > 0 && <button className="btn ghost sm" onClick={clearDone}><ITrash size={13} /> Quitar comprados</button>}
      </div>
    </div>
  );
}
