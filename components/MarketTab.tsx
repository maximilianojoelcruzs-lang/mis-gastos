"use client";
import { clp, uid } from "@/lib/format";
import type { AppData, MarketItem } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { ICheck, IPlus, ITrash } from "./icons";
import type { Update } from "./Tracker";

export default function MarketTab({ data, update }: { data: AppData; update: Update }) {
  const items = data.market.items;
  const total = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
  const done = items.filter((i) => i.done).length;
  const donePct = items.length > 0 ? (done / items.length) * 100 : 0;

  const setItem = <K extends keyof MarketItem>(id: string, key: K, value: MarketItem[K]) =>
    update((d) => {
      const it = d.market.items.find((i) => i.id === id);
      if (it) it[key] = value;
    });

  const clearDone = () => {
    if (confirm("¿Quitar los productos ya comprados de la lista?"))
      update((d) => { d.market.items = d.market.items.filter((i) => !i.done); });
  };

  return (
    <div>
      <section className="mg-card">
        <div className="mg-hero">
          <div className="mg-heroval">
            <span className="mg-herolabel">Total estimado</span>
            <strong className="pos">{clp(total)}</strong>
            <span className="mg-herosub">{items.length} {items.length === 1 ? "producto" : "productos"}</span>
          </div>
          <div className="mg-bar">
            <div className="mg-bartrack"><div className="mg-barfill" style={{ width: donePct + "%" }} /></div>
            <div className="mg-barlegend">
              <span><i className="dot spent" /> {done} de {items.length} en el carro</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mg-card">
        <div className="mg-listhead">
          <h2>Lista de compra</h2>
          <span>{items.length} {items.length === 1 ? "producto" : "productos"}</span>
        </div>
        <div className="mg-list">
          {items.length === 0 && <div className="mg-empty">Tu lista está vacía. Agrega el primer producto abajo.</div>}
          {items.map((it) => (
            <div className={"mg-prow " + (it.done ? "done" : "")} key={it.id}>
              <button className={"mg-check " + (it.done ? "on" : "")} onClick={() => setItem(it.id, "done", !it.done)}
                title="Marcar como comprado">
                {it.done && <ICheck size={13} />}
              </button>
              <input className="mg-pname" value={it.name} placeholder="Producto"
                onChange={(e) => setItem(it.id, "name", e.target.value)} />
              <input className="mg-qty" inputMode="numeric" value={it.qty || 1} title="Cantidad"
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                  setItem(it.id, "qty", n > 0 ? n : 1);
                }} />
              <CurrencyInput className="mg-amount" value={it.price} placeholder="$0"
                onChange={(v) => setItem(it.id, "price", v)} />
              <button className="mg-del" title="Eliminar"
                onClick={() => update((d) => { d.market.items = d.market.items.filter((i) => i.id !== it.id); })}>
                <ITrash size={15} />
              </button>
            </div>
          ))}
        </div>
        <button className="mg-add"
          onClick={() => update((d) => { d.market.items.push({ id: uid(), name: "", qty: 1, price: 0, done: false }); })}>
          <IPlus size={16} /> Agregar producto
        </button>
      </section>

      <footer className="mg-footer">
        <span>Marca cada producto al echarlo al carro. La cantidad multiplica el precio.</span>
        <div className="right">
          {done > 0 && <button className="mg-reset" onClick={clearDone}><ITrash size={13} /> Quitar comprados</button>}
        </div>
      </footer>
    </div>
  );
}
