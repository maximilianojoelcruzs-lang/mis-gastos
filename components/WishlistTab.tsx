"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { clp, openUrl, uid } from "@/lib/format";
import type { AppData, PriceResult, WishItem } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { ICheck, IExternal, IPlus, ISearch, ISpark, ISpin, ITrash, IX } from "./icons";
import type { Update } from "./Tracker";

type AiState = { loading?: boolean; error?: string; result?: PriceResult; raw?: string };

export default function WishlistTab({ data, update }: { data: AppData; update: Update }) {
  const [ai, setAi] = useState<Record<string, AiState>>({});
  const items = data.wishlist.items;
  const pending = items.filter((i) => !i.done);
  const pendingTotal = pending.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const ready = items.length - pending.length;

  const onItem = (id: string, fn: (it: WishItem) => void) =>
    update((d) => {
      const it = d.wishlist.items.find((i) => i.id === id);
      if (it) fn(it);
    });

  const searchAi = async (it: WishItem) => {
    if (!it.name) return;
    setAi((s) => ({ ...s, [it.id]: { loading: true } }));
    try {
      const r = await api.buscarPrecio(it.name);
      setAi((s) => ({ ...s, [it.id]: "result" in r ? { result: r.result } : { raw: r.raw } }));
    } catch (e) {
      setAi((s) => ({ ...s, [it.id]: { error: (e as Error).message || "No se pudo consultar la IA." } }));
    }
  };

  const applyPrice = (id: string, r: PriceResult) =>
    onItem(id, (it) => {
      if (r.precio_clp) it.price = Number(r.precio_clp) || 0;
      if (r.url) {
        if (it.urls.length === 1 && !it.urls[0]) it.urls[0] = r.url;
        else if (!it.urls.includes(r.url)) it.urls.push(r.url);
      }
    });

  return (
    <div>
      <section className="mg-card">
        <div className="mg-hero">
          <div className="mg-heroval">
            <span className="mg-herolabel">Estimado por comprar</span>
            <strong className="pos">{clp(pendingTotal)}</strong>
            <span className="mg-herosub">
              {pending.length} {pending.length === 1 ? "pendiente" : "pendientes"}
              {ready > 0 ? ` · ${ready} listos` : ""}
            </span>
          </div>
        </div>
      </section>

      <section className="mg-card">
        <div className="mg-listhead">
          <h2>Próximas compras y regalos</h2>
          <span>{items.length} {items.length === 1 ? "ítem" : "ítems"}</span>
        </div>
        {items.length === 0 && <div className="mg-empty">Agrega algo que quieras comprar o regalar más adelante.</div>}
        {items.map((it) => {
          const urls = it.urls.length ? it.urls : [""];
          const a = ai[it.id];
          return (
            <div className={"mg-wcard " + (it.done ? "done" : "")} key={it.id}>
              <div className="mg-wtop">
                <button className={"mg-check " + (it.done ? "on" : "")} onClick={() => onItem(it.id, (x) => { x.done = !x.done; })}
                  title={it.done ? "Marcar como pendiente" : "Marcar como comprado"}>
                  {it.done && <ICheck size={13} />}
                </button>
                <input className="mg-wname" value={it.name} placeholder="¿Qué quieres comprar o regalar?"
                  onChange={(e) => onItem(it.id, (x) => { x.name = e.target.value; })} />
                <CurrencyInput className="mg-wprice" value={it.price} placeholder="$0"
                  onChange={(v) => onItem(it.id, (x) => { x.price = v; })} />
                <button className="mg-iconbtn danger" title="Eliminar"
                  onClick={() => update((d) => { d.wishlist.items = d.wishlist.items.filter((i) => i.id !== it.id); })}>
                  <ITrash size={15} />
                </button>
              </div>
              {urls.map((url, idx) => (
                <div className="mg-urlrow" key={idx}>
                  <input className="mg-url" value={url} placeholder="https://enlace-de-la-oferta.cl/..."
                    onChange={(e) => onItem(it.id, (x) => { if (!x.urls.length) x.urls = [""]; x.urls[idx] = e.target.value; })} />
                  <button className="mg-iconbtn" onClick={() => openUrl(url)} title="Abrir enlace"><IExternal size={14} /></button>
                  {urls.length > 1 && (
                    <button className="mg-iconbtn danger" title="Quitar enlace"
                      onClick={() => onItem(it.id, (x) => { x.urls.splice(idx, 1); if (!x.urls.length) x.urls = [""]; })}>
                      <IX size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button className="mg-waddurl" onClick={() => onItem(it.id, (x) => { x.urls.push(""); })}>
                <IPlus size={13} /> Agregar otro enlace
              </button>
              <div className="mg-wactions">
                <button className="mg-shopbtn" disabled={!it.name}
                  onClick={() => openUrl("https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(it.name))}>
                  <ISearch size={13} /> Google Shopping
                </button>
                <button className="mg-shopbtn ai" disabled={!it.name || !!a?.loading} onClick={() => searchAi(it)}>
                  {a?.loading ? <ISpin size={13} /> : <ISpark size={13} />} Buscar con IA
                </button>
              </div>
              {a && (a.error || a.result || a.raw) && (
                <div className="mg-airesult">
                  {a.error && <span className="err">{a.error}</span>}
                  {a.result && (
                    <div>
                      <div className="line">
                        <b>{clp(a.result.precio_clp)}</b>
                        {a.result.tienda ? " · " + a.result.tienda : ""}
                      </div>
                      {a.result.nota && <div className="nota">{a.result.nota}</div>}
                      <div className="acts">
                        {a.result.url && (
                          <button onClick={() => openUrl(a.result!.url!)}><IExternal size={12} /> Ver oferta</button>
                        )}
                        <button onClick={() => applyPrice(it.id, a.result!)}><ICheck size={12} /> Usar este precio</button>
                      </div>
                    </div>
                  )}
                  {!a.result && a.raw && <div className="nota">{a.raw}</div>}
                </div>
              )}
            </div>
          );
        })}
        <button className="mg-add"
          onClick={() => update((d) => { d.wishlist.items.unshift({ id: uid(), name: "", price: 0, urls: [""], done: false }); })}>
          <IPlus size={16} /> Agregar compra
        </button>
      </section>

      <footer className="mg-footer">
        <span>&quot;Buscar con IA&quot; usa Gemini para estimar el precio más bajo. Es una estimación, revisa el enlace.</span>
      </footer>
    </div>
  );
}
