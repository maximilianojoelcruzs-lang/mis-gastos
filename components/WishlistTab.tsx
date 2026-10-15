"use client";
import { useEffect, useState } from "react";
import { PALETTE, catColor } from "@/lib/data";
import { INTERESTS, OCCASIONS, RELATIONS, countdownText, nextDate, occasionOf, relationOf, suggestGifts } from "@/lib/gifts";
import { clp, openUrl, uid } from "@/lib/format";
import type { AppData, GiftPerson, Priority, WishItem } from "@/lib/types";
import CurrencyInput from "./CurrencyInput";
import { ICalendar, ICheck, ICopy, IExternal, IGift, IMore, IPlus, ISearch, ISettings, ITrash, IX } from "./icons";
import type { Notify, Update } from "./Tracker";

const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "alta", label: "Urgente" },
  { id: "media", label: "Puede esperar" },
  { id: "baja", label: "Capricho" },
];
const RANK: Record<Priority, number> = { alta: 0, media: 1, baja: 2 };
type View = "mio" | "regalos";

const newItem = (name: string, price: number, forId = ""): WishItem =>
  ({ id: uid(), name, price, urls: [""], done: false, priority: "media", date: "", saved: 0, for: forId, note: "" });

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
};
const avatarColor = (i: number) => catColor(PALETTE[i % PALETTE.length].key);

type Props = { data: AppData; update: Update; notify: Notify };

export default function WishlistTab({ data, update, notify }: Props) {
  const [view, setView] = useState<View>("mio");
  const [open, setOpen] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [person, setPerson] = useState("");
  const [editPerson, setEditPerson] = useState<string | null>(null);
  const { items, people } = data.wishlist;

  useEffect(() => {
    try { if (localStorage.getItem("mg-wish-view") === "regalos") setView("regalos"); } catch { /* sin almacenamiento */ }
  }, []);
  const changeView = (v: View) => {
    setView(v);
    setOpen(null);
    try { localStorage.setItem("mg-wish-view", v); } catch { /* sin almacenamiento */ }
  };

  const onItem = (id: string, fn: (it: WishItem) => void) =>
    update((d) => { const it = d.wishlist.items.find((i) => i.id === id); if (it) fn(it); });
  const onPerson = (id: string, fn: (p: GiftPerson) => void) =>
    update((d) => { const p = d.wishlist.people.find((x) => x.id === id); if (p) fn(p); });
  const removeItem = (id: string) => update((d) => { d.wishlist.items = d.wishlist.items.filter((i) => i.id !== id); });

  const mine = items.filter((i) => !i.for);
  const minePending = mine.filter((i) => !i.done).sort((a, b) =>
    RANK[a.priority] - RANK[b.priority] || (a.date || "9999").localeCompare(b.date || "9999"));
  const mineDone = mine.filter((i) => i.done);
  const pendingTotal = minePending.reduce((s, i) => s + (i.price || 0), 0);
  const savedTotal = minePending.reduce((s, i) => s + Math.min(i.saved || 0, i.price || i.saved || 0), 0);
  const savedPct = pendingTotal > 0 ? Math.min(100, (savedTotal / pendingTotal) * 100) : 0;

  const giftsOf = (pid: string) => items.filter((i) => i.for === pid);
  const peopleSorted = [...people]
    .map((p, idx) => ({ p, idx, next: nextDate(p) }))
    .sort((a, b) => (a.next || "9999").localeCompare(b.next || "9999"));
  const nextUp = peopleSorted.find((x) => x.next);
  const giftsPending = items.filter((i) => i.for && !i.done).length;

  const addMine = () => {
    const n = name.trim();
    if (!n) return notify("Escribe qué quieres comprar");
    update((d) => { d.wishlist.items.unshift(newItem(n.slice(0, 80), price)); });
    setName(""); setPrice(0);
  };

  const addPerson = () => {
    const n = person.trim().slice(0, 40);
    if (!n) return notify("Escribe el nombre de la persona");
    const id = uid();
    update((d) => { d.wishlist.people.push({ id, name: n, relation: "otro", occasion: "cumpleanos", date: "", budget: 0, interests: [] }); });
    setPerson("");
    setEditPerson(id);
  };

  const deletePerson = (p: GiftPerson) => {
    const n = giftsOf(p.id).length;
    if (!confirm(n ? `¿Eliminar a ${p.name} y sus ${n} ideas de regalo?` : `¿Eliminar a ${p.name}?`)) return;
    update((d) => {
      d.wishlist.people = d.wishlist.people.filter((x) => x.id !== p.id);
      d.wishlist.items = d.wishlist.items.filter((i) => i.for !== p.id);
    });
    setEditPerson(null);
  };

  const shareIdeas = async (p: GiftPerson) => {
    const ideas = giftsOf(p.id).filter((i) => !i.done);
    const nd = nextDate(p);
    const text = [`Ideas de regalo para ${p.name}${nd ? ` (${occasionOf(p.occasion).label}, ${fmtDate(nd)})` : ""}:`,
      ...ideas.map((i) => `• ${i.name}${i.price ? ` — ${clp(i.price)}` : ""}`)].join("\n");
    try {
      if (navigator.share) await navigator.share({ title: `Regalo para ${p.name}`, text });
      else { await navigator.clipboard.writeText(text); notify("Ideas copiadas para compartir"); }
    } catch (e) { if ((e as Error)?.name !== "AbortError") notify("No se pudo compartir"); }
  };

  // ---------- Tarjeta de compra (para mí o idea de regalo) ----------
  const renderItem = (it: WishItem, compact = false) => {
    const isOpen = open === it.id;
    const cd = it.date && !it.done ? countdownText(it.date) : null;
    const pct = it.price > 0 ? Math.min(100, ((it.saved || 0) / it.price) * 100) : 0;
    const urls = it.urls.length ? it.urls : [""];
    return (
      <div key={it.id} className={"wcard " + (it.done ? "done " : "") + (isOpen ? "open" : "")}>
        <div className="wcard-row">
          <button className={"check " + (it.done ? "on" : "")} aria-label={it.done ? "Marcar como pendiente" : "Marcar como comprado"}
            title={it.done ? "Marcar como pendiente" : "Marcar como comprado"}
            onClick={() => onItem(it.id, (x) => { x.done = !x.done; })}>
            {it.done && <ICheck size={12} />}
          </button>
          <button className="wcard-main" onClick={() => setOpen(isOpen ? null : it.id)} aria-expanded={isOpen}>
            <span className="t">{it.name || "Sin nombre"}</span>
            <span className="meta">
              {!compact && !it.done && <span className={"pri " + it.priority}>{PRIORITIES.find((p) => p.id === it.priority)?.label}</span>}
              {cd && <span className={"badge " + cd.tone}><ICalendar size={11} /> {cd.text}</span>}
              {it.saved > 0 && it.price > 0 && !it.done && <span className="muted">Ahorrado {Math.round(pct)}%</span>}
              {it.note && <span className="muted note">{it.note}</span>}
            </span>
          </button>
          <span className="wcard-price num">{it.price ? clp(it.price) : "—"}</span>
          <button className={"btn icon sm " + (isOpen ? "" : "ghost")} aria-label="Detalles" onClick={() => setOpen(isOpen ? null : it.id)}>
            <IMore size={15} />
          </button>
        </div>
        {!compact && it.saved > 0 && it.price > 0 && !it.done && (
          <div className="bar thin"><i className={pct >= 100 ? "good" : ""} style={{ width: pct + "%" }} /></div>
        )}
        {isOpen && (
          <div className="wcard-detail fade">
            <label className="f wide">
              <span>Nombre</span>
              <input className="field sm" value={it.name} maxLength={80} onChange={(e) => onItem(it.id, (x) => { x.name = e.target.value; })} />
            </label>
            <label className="f">
              <span>Precio</span>
              <CurrencyInput className="field sm" value={it.price} placeholder="$0" onChange={(v) => onItem(it.id, (x) => { x.price = v; })} />
            </label>
            {!compact && (
              <label className="f">
                <span>Llevo ahorrado</span>
                <CurrencyInput className="field sm" value={it.saved} placeholder="$0" onChange={(v) => onItem(it.id, (x) => { x.saved = v; })} />
              </label>
            )}
            {!compact && (
              <div className="f wide">
                <span>Prioridad</span>
                <div className="seg" role="group" aria-label="Prioridad">
                  {PRIORITIES.map((p) => (
                    <button key={p.id} className={it.priority === p.id ? "on" : ""} onClick={() => onItem(it.id, (x) => { x.priority = p.id; })}>{p.label}</button>
                  ))}
                </div>
              </div>
            )}
            {!compact && (
              <label className="f">
                <span>¿Para cuándo?</span>
                <input className="field sm" type="date" value={it.date} onChange={(e) => onItem(it.id, (x) => { x.date = e.target.value; })} />
              </label>
            )}
            <label className={"f " + (compact ? "wide" : "")}>
              <span>Nota</span>
              <input className="field sm" value={it.note} maxLength={200} placeholder="Talla, color, tienda…"
                onChange={(e) => onItem(it.id, (x) => { x.note = e.target.value; })} />
            </label>
            <div className="f wide">
              <span>Enlaces</span>
              {urls.map((url, idx) => (
                <div className="url" key={idx}>
                  <input className="field sm" value={url} placeholder="https://tienda.cl/producto"
                    onChange={(e) => onItem(it.id, (x) => { if (!x.urls.length) x.urls = [""]; x.urls[idx] = e.target.value; })} />
                  <button className="btn icon sm" onClick={() => openUrl(url)} title="Abrir enlace" aria-label="Abrir enlace" disabled={!url}><IExternal size={13} /></button>
                  {urls.length > 1 && (
                    <button className="btn icon sm" title="Quitar enlace" aria-label="Quitar enlace"
                      onClick={() => onItem(it.id, (x) => { x.urls.splice(idx, 1); if (!x.urls.length) x.urls = [""]; })}><IX size={13} /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="foot">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="btn ghost sm" onClick={() => onItem(it.id, (x) => { x.urls.push(""); })}><IPlus size={13} /> Otro enlace</button>
                <button className="btn sm" disabled={!it.name}
                  onClick={() => openUrl("https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(it.name))}>
                  <ISearch size={13} /> Buscar precios
                </button>
              </div>
              <button className="btn sm danger" onClick={() => { removeItem(it.id); setOpen(null); }}><ITrash size={13} /> Eliminar</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Tarjeta de persona (regalos) ----------
  const renderPerson = (p: GiftPerson, idx: number, next: string) => {
    const gifts = giftsOf(p.id);
    const bought = gifts.filter((g) => g.done);
    const cd = next ? countdownText(next) : null;
    const rel = relationOf(p.relation);
    const occ = occasionOf(p.occasion);
    const editing = editPerson === p.id;
    const sugg = suggestGifts(p, gifts.map((g) => g.name));
    return (
      <section className="card gcard" key={p.id}>
        <div className="gcard-h">
          <span className="avatar-lg" style={{ ["--c" as string]: avatarColor(idx) }}>{p.name[0]?.toUpperCase()}</span>
          <div className="who">
            <b>{p.name}</b>
            <span>{rel.label} · {occ.label}{next ? ` · ${fmtDate(next)}` : ""}</span>
          </div>
          {cd && <span className={"badge " + cd.tone}><ICalendar size={11} /> {cd.text}</span>}
          <button className={"btn icon sm " + (editing ? "" : "ghost")} aria-label={`Editar a ${p.name}`} title="Editar"
            onClick={() => setEditPerson(editing ? null : p.id)}>
            <ISettings size={15} />
          </button>
        </div>

        {editing && (
          <div className="gedit fade">
            <label className="f">
              <span>Nombre</span>
              <input className="field sm" value={p.name} maxLength={40} onChange={(e) => onPerson(p.id, (x) => { x.name = e.target.value; })}
                onBlur={(e) => { if (!e.target.value.trim()) onPerson(p.id, (x) => { x.name = "Sin nombre"; }); }} />
            </label>
            <div className="f">
              <span>¿Quién es para ti?</span>
              <div className="chips">
                {RELATIONS.map((r) => (
                  <button key={r.id} className={"chip sm " + (p.relation === r.id ? "on" : "")} onClick={() => onPerson(p.id, (x) => { x.relation = r.id; })}>{r.label}</button>
                ))}
              </div>
            </div>
            <div className="f">
              <span>Ocasión</span>
              <div className="chips">
                {OCCASIONS.map((o) => (
                  <button key={o.id} className={"chip sm " + (p.occasion === o.id ? "on" : "")} onClick={() => onPerson(p.id, (x) => { x.occasion = o.id; })}>{o.label}</button>
                ))}
              </div>
            </div>
            <div className="gedit-row">
              {!occ.fixed && (
                <label className="f">
                  <span>{p.occasion === "cumpleanos" ? "Fecha de cumpleaños" : "Fecha"}</span>
                  <input className="field sm" type="date" value={p.date} onChange={(e) => onPerson(p.id, (x) => { x.date = e.target.value; })} />
                </label>
              )}
              <label className="f">
                <span>Presupuesto</span>
                <CurrencyInput className="field sm" value={p.budget} placeholder="Sin límite" aria-label={`Presupuesto para ${p.name}`}
                  onChange={(v) => onPerson(p.id, (x) => { x.budget = v; })} />
              </label>
            </div>
            <div className="f">
              <span>Le gusta…</span>
              <div className="chips">
                {INTERESTS.map((t) => {
                  const on = p.interests.includes(t.id);
                  return (
                    <button key={t.id} className={"chip sm " + (on ? "on" : "")} aria-pressed={on}
                      onClick={() => onPerson(p.id, (x) => { x.interests = on ? x.interests.filter((y) => y !== t.id) : [...x.interests, t.id]; })}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="foot">
              <button className="btn sm primary" onClick={() => setEditPerson(null)}><ICheck size={13} /> Listo</button>
              <button className="btn sm danger" onClick={() => deletePerson(p)}><ITrash size={13} /> Eliminar persona</button>
            </div>
          </div>
        )}

        <div className="gstats">
          <span>{gifts.length} {gifts.length === 1 ? "idea" : "ideas"}{bought.length ? ` · ${bought.length} comprado${bought.length === 1 ? "" : "s"}` : ""}</span>
          {p.budget > 0 && <span className="num">Presupuesto {clp(p.budget)}</span>}
        </div>
        <div className="glist">
          {gifts.map((g) => renderItem(g, true))}
          <GiftAdd onAdd={(n, pr) => update((d) => { d.wishlist.items.push(newItem(n, pr, p.id)); })} name={p.name} />
        </div>

        {sugg.length > 0 && (
          <div className="sugg">
            <div className="sugg-h">
              <IGift size={13} /> Ideas para {p.name}
              <span className="muted">
                {p.interests.length ? "según sus gustos" : "edita sus gustos para afinar"}{p.budget ? ` · hasta ${clp(p.budget)}` : ""}
              </span>
            </div>
            <div className="sugg-list">
              {sugg.map((s) => (
                <button key={s.name} className="sugg-chip" onClick={() => {
                  update((d) => { d.wishlist.items.push(newItem(s.name, s.price, p.id)); });
                  notify(`Agregado para ${p.name}: ${s.name}`);
                }}>
                  <IPlus size={12} /> <span>{s.name}</span> <small className="num">~{clp(s.price)}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        {gifts.some((g) => !g.done) && (
          <div className="gfoot">
            <button className="btn ghost sm" onClick={() => shareIdeas(p)}><ICopy size={13} /> Compartir ideas</button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div>
      <div className="wtabs">
        <div className="seg big" role="tablist" aria-label="Vista">
          <button role="tab" aria-selected={view === "mio"} className={view === "mio" ? "on" : ""} onClick={() => changeView("mio")}>
            Para mí {minePending.length > 0 && <span className="n">{minePending.length}</span>}
          </button>
          <button role="tab" aria-selected={view === "regalos"} className={view === "regalos" ? "on" : ""} onClick={() => changeView("regalos")}>
            Regalos {giftsPending > 0 && <span className="n">{giftsPending}</span>}
          </button>
        </div>
      </div>

      {view === "mio" ? (
        <>
          <section className="card">
            <div className="hero" style={{ marginBottom: 12 }}>
              <div>
                <div className="l">Quiero comprar</div>
                <div className="v">{clp(pendingTotal)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="l" style={{ justifyContent: "flex-end" }}>Ya ahorrado</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 500 }}>{clp(savedTotal)}</div>
              </div>
            </div>
            <div className="bar"><i style={{ width: savedPct + "%" }} /></div>
            <div className="bar-l">
              <span>{minePending.length} {minePending.length === 1 ? "pendiente" : "pendientes"}</span>
              <span>{Math.round(savedPct)}% ahorrado</span>
            </div>
            <div className="wadd">
              <input className="field" value={name} placeholder="¿Qué quieres comprar? (ej: zapatillas)" maxLength={80} aria-label="Qué quieres comprar"
                onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMine()} />
              <CurrencyInput className="field amount" value={price} placeholder="$ precio" onChange={setPrice} onEnter={addMine} aria-label="Precio" />
              <button className="btn primary" onClick={addMine}><IPlus size={14} /> Agregar</button>
            </div>
          </section>

          <section className="card">
            {minePending.length === 0 ? (
              <div className="empty"><IGift size={20} /><div style={{ marginTop: 8 }}>Nada pendiente. Agrega arriba lo próximo que quieras comprar.</div></div>
            ) : (
              <div className="wlist">{minePending.map((it) => renderItem(it))}</div>
            )}
            {mineDone.length > 0 && (
              <>
                <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setShowDone(!showDone)}>
                  {showDone ? "Ocultar" : "Ver"} comprados ({mineDone.length})
                </button>
                {showDone && <div className="wlist" style={{ marginTop: 8 }}>{mineDone.map((it) => renderItem(it))}</div>}
              </>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="card">
            {nextUp ? (
              <div className="gnext">
                <IGift size={18} />
                <div>
                  <b>Próximo regalo: {nextUp.p.name}</b>
                  <span>{occasionOf(nextUp.p.occasion).label} · {fmtDate(nextUp.next)} · {countdownText(nextUp.next)?.text}</span>
                </div>
              </div>
            ) : (
              <p className="muted" style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>
                Escribe el nombre de alguien, cuéntanos quién es para ti y qué le gusta, y te proponemos regalos dentro de tu presupuesto.
              </p>
            )}
            <div className="wadd">
              <input className="field" value={person} placeholder="¿A quién le quieres regalar? (nombre)" maxLength={40} aria-label="Nombre de la persona"
                onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} />
              <button className="btn primary" onClick={addPerson}><IPlus size={14} /> Agregar persona</button>
            </div>
          </section>
          {peopleSorted.map(({ p, idx, next }) => renderPerson(p, idx, next))}
          {people.length === 0 && (
            <div className="empty" style={{ paddingTop: 4 }}>Aún no agregas a nadie. Prueba con alguien que esté de cumpleaños pronto.</div>
          )}
        </>
      )}
    </div>
  );
}

/** Agregar una idea de regalo propia (nombre + precio opcional). */
function GiftAdd({ onAdd, name }: { onAdd: (name: string, price: number) => void; name: string }) {
  const [text, setText] = useState("");
  const [price, setPrice] = useState(0);
  const add = () => {
    const n = text.trim();
    if (!n) return;
    onAdd(n.slice(0, 80), price);
    setText(""); setPrice(0);
  };
  return (
    <div className="gadd">
      <input className="field sm" value={text} placeholder={`Otra idea para ${name}…`} maxLength={80} aria-label={`Nueva idea para ${name}`}
        onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <CurrencyInput className="field sm amount" value={price} placeholder="$" onChange={setPrice} onEnter={add} aria-label="Precio de la idea" />
      <button className="btn sm" onClick={add} disabled={!text.trim()} aria-label="Agregar idea"><IPlus size={13} /></button>
    </div>
  );
}

