"use client";
import { useMemo, useState } from "react";
import { catOf, periodName, priceKey, todayISO } from "@/lib/data";
import { clp, dayLabel } from "@/lib/format";
import type { AppData } from "@/lib/types";
import Modal from "./Modal";
import { ISearch } from "./icons";

export type SearchHit = {
  kind: "cuenta" | "diario" | "super" | "compra";
  id: string;
  title: string;
  meta: string;
  amount?: number;
  monthId?: string;
  date?: string;
  /** Clave de orden (más nuevo primero). */
  sort: string;
  /** Mes al que se suma el monto, para el resumen. */
  group?: string;
};

const KIND: Record<SearchHit["kind"], string> = { cuenta: "Cuenta", diario: "Diario", super: "Súper", compra: "Compra" };

export default function SearchDialog({ data, onClose, onOpen }: { data: AppData; onClose: () => void; onOpen: (h: SearchHit) => void }) {
  const [q, setQ] = useState("");
  const query = priceKey(q);

  const hits = useMemo(() => {
    if (query.length < 2) return [] as SearchHit[];
    const has = (...s: string[]) => s.some((x) => priceKey(x).includes(query));
    const out: SearchHit[] = [];
    for (const m of data.months) {
      for (const i of m.items) {
        const cat = catOf(data.categories, i.category);
        if (has(i.name, cat.label, ...i.tags.map((t) => "#" + t)))
          out.push({ kind: "cuenta", id: i.id, title: i.name || "Sin nombre", meta: `${m.label} · ${cat.label}${i.tags.length ? " · " + i.tags.map((t) => "#" + t).join(" ") : ""}`, amount: i.amount,
            monthId: m.id, sort: (m.period || "0000-00") + "-99", group: m.period ? periodName(m.period) : m.label });
      }
    }
    const today = todayISO();
    for (const d of data.daily) {
      const cat = catOf(data.categories, d.category);
      if (has(d.name, cat.label, ...d.tags.map((t) => "#" + t)))
        out.push({ kind: "diario", id: d.id, title: d.name || "Sin nombre", meta: `${dayLabel(d.date, today)} · ${cat.label}${d.tags.length ? " · " + d.tags.map((t) => "#" + t).join(" ") : ""}`, amount: d.amount,
          date: d.date, sort: d.date, group: periodName(d.date.slice(0, 7)) });
    }
    for (const i of data.market.items)
      if (has(i.name)) out.push({ kind: "super", id: i.id, title: i.name, meta: `Lista del súper · x${i.qty}`, amount: i.price * i.qty, sort: "0000" });
    for (const i of data.wishlist.items)
      if (has(i.name)) out.push({ kind: "compra", id: i.id, title: i.name, meta: i.done ? "Comprado" : "Próxima compra", amount: i.price, sort: "0000" });
    return out.sort((a, b) => b.sort.localeCompare(a.sort));
  }, [data, query]);

  const spending = hits.filter((h) => h.kind === "cuenta" || h.kind === "diario");
  const total = spending.reduce((s, h) => s + (h.amount || 0), 0);
  const byMonth = useMemo(() => {
    const map = new Map<string, { label: string; sort: string; amount: number }>();
    for (const h of spending) {
      const key = h.sort.slice(0, 7);
      const cur = map.get(key) || { label: h.group || key, sort: key, amount: 0 };
      cur.amount += h.amount || 0;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 8);
  }, [spending]);

  return (
    <Modal onClose={onClose} label="Buscar" top wide>
      <div className="searchbox">
        <ISearch size={18} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en cuentas, diarios, etiquetas, súper y compras…" aria-label="Buscar" />
      </div>

      {query.length < 2 ? (
        <p className="muted" style={{ margin: "8px 4px 4px", fontSize: 13, lineHeight: 1.6 }}>
          Escribe al menos 2 letras. Prueba con <b>luz</b>, <b>café</b>, <b>leche</b> o una etiqueta como <b>#viaje</b> para ver cuánto has gastado en eso mes a mes.
        </p>
      ) : hits.length === 0 ? (
        <div className="empty">No encontré nada para “{q}”.</div>
      ) : (
        <>
          {spending.length > 0 && (
            <div style={{ padding: "0 4px 12px" }}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <b>{spending.length}</b> {spending.length === 1 ? "gasto" : "gastos"} · total <b className="num">{clp(total)}</b>
              </div>
              {byMonth.length > 1 && (
                <div className="chips">
                  {byMonth.map((m) => <span className="badge" key={m.sort}>{m.label} · <span className="num">{clp(m.amount)}</span></span>)}
                </div>
              )}
            </div>
          )}
          <div>
            {hits.slice(0, 60).map((h) => (
              <button key={h.kind + h.id} className="res" onClick={() => onOpen(h)}>
                <span className="badge">{KIND[h.kind]}</span>
                <span className="n"><b>{h.title}</b><small>{h.meta}</small></span>
                {h.amount !== undefined && <span className="v">{clp(h.amount)}</span>}
              </button>
            ))}
            {hits.length > 60 && <div className="empty">Mostrando 60 de {hits.length}. Afina la búsqueda.</div>}
          </div>
        </>
      )}
    </Modal>
  );
}
