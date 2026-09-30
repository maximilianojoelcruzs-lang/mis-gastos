"use client";
import { daysUntil } from "@/lib/data";
import { clp, openUrl, uid } from "@/lib/format";
import type { AppData, Priority, WishItem } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { ICalendar, ICheck, IExternal, IPlus, ISearch, ITrash, IX } from "./icons";
import type { Update } from "./Tracker";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "alta", label: "Urgente" },
  { id: "media", label: "Puede esperar" },
  { id: "baja", label: "Capricho" },
];
const RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };

function countdown(date: string) {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { tone: "bad", text: d === -1 ? "Fue ayer" : `Pasó hace ${-d} días` };
  if (d === 0) return { tone: "warn", text: "Es hoy" };
  if (d <= 7) return { tone: "warn", text: d === 1 ? "Falta 1 día" : `Faltan ${d} días` };
  return { tone: "", text: `Faltan ${d} días` };
}

export default function WishlistTab({ data, update }: { data: AppData; update: Update }) {
  const items = [...data.wishlist.items].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      RANK[a.priority] - RANK[b.priority] ||
      (a.date || "9999").localeCompare(b.date || "9999")
  );
  const pending = items.filter((i) => !i.done);
  const pendingTotal = pending.reduce((s, i) => s + (Number(i.price) || 0), 0);
  const savedTotal = pending.reduce((s, i) => s + Math.min(i.saved || 0, i.price || i.saved || 0), 0);
  const savedPct = pendingTotal > 0 ? Math.min(100, (savedTotal / pendingTotal) * 100) : 0;

  const onItem = (id: string, fn: (it: WishItem) => void) =>
    update((d) => {
      const it = d.wishlist.items.find((i) => i.id === id);
      if (it) fn(it);
    });

  return (
    <div>
      <section className="card">
        <div className="hero" style={{ marginBottom: 14 }}>
          <div>
            <div className="l">Por comprar</div>
            <div className="v">{clp(pendingTotal)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="l" style={{ justifyContent: "flex-end" }}>Ya ahorrado</div>
            <div className="num" style={{ fontSize: 20, fontWeight: 500 }}>{clp(savedTotal)}</div>
          </div>
        </div>
        <div className="bar"><i style={{ width: savedPct + "%" }} /></div>
        <div className="bar-l">
          <span>{pending.length} {pending.length === 1 ? "pendiente" : "pendientes"}</span>
          <span>{Math.round(savedPct)}% ahorrado</span>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Próximas compras y regalos</h2>
            <div className="sub">Ordenadas por prioridad y fecha.</div>
          </div>
          <button className="btn sm"
            onClick={() => update((d) => {
              d.wishlist.items.unshift({ id: uid(), name: "", price: 0, urls: [""], done: false, priority: "media", date: "", saved: 0 });
            })}>
            <IPlus size={13} /> Agregar
          </button>
        </div>

        {items.length === 0 && <div className="empty">Agrega algo que quieras comprar o regalar más adelante.</div>}

        {items.map((it) => {
          const urls = it.urls.length ? it.urls : [""];
          const cd = it.date && !it.done ? countdown(it.date) : null;
          const pct = it.price > 0 ? Math.min(100, ((it.saved || 0) / it.price) * 100) : 0;
          return (
            <div className={"wish " + (it.done ? "done" : "")} key={it.id}>
              <div className="wish-top">
                <button className={"check " + (it.done ? "on" : "")}
                  onClick={() => onItem(it.id, (x) => { x.done = !x.done; })}
                  title={it.done ? "Marcar como pendiente" : "Marcar como comprado"}>
                  {it.done && <ICheck size={12} />}
                </button>
                <input className="bare name" value={it.name} placeholder="¿Qué quieres comprar o regalar?"
                  onChange={(e) => onItem(it.id, (x) => { x.name = e.target.value; })} />
                <CurrencyInput className="bare amount" value={it.price} placeholder="$0"
                  onChange={(v) => onItem(it.id, (x) => { x.price = v; })} />
                <button className="btn ghost icon sm danger" title="Eliminar"
                  onClick={() => update((d) => { d.wishlist.items = d.wishlist.items.filter((i) => i.id !== it.id); })}>
                  <ITrash size={14} />
                </button>
              </div>

              {!it.done && (
                <>
                  <div className="wish-opts">
                    <div className="seg" role="group" aria-label="Prioridad">
                      {PRIORITIES.map((p) => (
                        <button key={p.id} className={it.priority === p.id ? "on" : ""}
                          onClick={() => onItem(it.id, (x) => { x.priority = p.id; })}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <input className="field sm" type="date" value={it.date} title="Fecha objetivo o del regalo"
                      onChange={(e) => onItem(it.id, (x) => { x.date = e.target.value; })} />
                    {cd && <span className={"badge " + cd.tone}><ICalendar size={11} /> {cd.text}</span>}
                  </div>

                  <div className="wish-save">
                    <span>Llevo</span>
                    <CurrencyInput className="field sm amount" value={it.saved} placeholder="$0"
                      onChange={(v) => onItem(it.id, (x) => { x.saved = v; })} />
                    <div className="bar"><i className={pct >= 100 ? "good" : ""} style={{ width: pct + "%" }} /></div>
                    <span className="num">{it.price > 0 ? Math.round(pct) + "%" : "—"}</span>
                  </div>

                  {urls.map((url, idx) => (
                    <div className="url" key={idx}>
                      <input className="field sm" value={url} placeholder="https://enlace-de-la-oferta.cl/..."
                        onChange={(e) => onItem(it.id, (x) => { if (!x.urls.length) x.urls = [""]; x.urls[idx] = e.target.value; })} />
                      <button className="btn icon sm" onClick={() => openUrl(url)} title="Abrir enlace" disabled={!url}>
                        <IExternal size={13} />
                      </button>
                      {urls.length > 1 && (
                        <button className="btn icon sm danger" title="Quitar enlace"
                          onClick={() => onItem(it.id, (x) => { x.urls.splice(idx, 1); if (!x.urls.length) x.urls = [""]; })}>
                          <IX size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="wish-actions">
                    <button className="btn ghost sm" onClick={() => onItem(it.id, (x) => { x.urls.push(""); })}>
                      <IPlus size={13} /> Otro enlace
                    </button>
                    <button className="btn sm" disabled={!it.name}
                      onClick={() => openUrl("https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(it.name))}>
                      <ISearch size={13} /> Google Shopping
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
