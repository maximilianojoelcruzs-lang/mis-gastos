"use client";
import { restoreTrash } from "@/lib/data";
import { openUrl } from "@/lib/format";
import type { AppData, TrashKind } from "@/lib/types";
import { ICopy, IExternal, IRotate, ITrash } from "./icons";
import type { Notify, Update } from "./Tracker";

const KIND: Record<TrashKind, string> = { compra: "Compra", persona: "Regalos", diario: "Gasto diario", cuenta: "Cuenta", enlace: "Enlace" };

function ago(at: string) {
  const ms = Date.now() - Date.parse(at);
  const min = Math.round(ms / 60000);
  if (!isFinite(min) || min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/** Papelera: lo eliminado en los últimos 30 días, para restaurarlo. */
export default function TrashCard({ data, update, notify }: { data: AppData; update: Update; notify: Notify }) {
  const list = [...data.trash].reverse();

  const restore = (id: string) => {
    // El mensaje se calcula sobre una copia: update() recibe el borrador y no devuelve nada.
    const msg = restoreTrash(structuredClone(data), id);
    update((d) => { restoreTrash(d, id); });
    notify(msg || "Restaurado");
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      notify("Enlace copiado");
    } catch {
      notify("Copia el enlace: " + url);
    }
  };

  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Papelera</h2>
          <div className="sub">Lo que eliminaste en los últimos 30 días: compras, regalos, gastos, cuentas y enlaces.</div>
        </div>
        {list.length > 0 && (
          <button className="btn sm ghost danger"
            onClick={() => confirm("¿Vaciar la papelera? No se podrá recuperar lo que hay en ella.") && update((d) => { d.trash = []; })}>
            Vaciar
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>La papelera está vacía.</div>
      ) : (
        list.map((t) => {
          const url = t.kind === "enlace" ? String((t.data as { url?: string } | null)?.url || "") : "";
          return (
            <div className="trash-row" key={t.id}>
              <span className="badge">{KIND[t.kind]}</span>
              <div className="n">
                <b>{t.label}</b>
                {url && <span className="trash-url">{url}</span>}
                <small>{ago(t.at)}</small>
              </div>
              {url && (
                <>
                  <button className="btn sm" onClick={() => copy(url)}><ICopy size={13} /> Copiar</button>
                  <button className="btn icon sm" onClick={() => openUrl(url)} title="Abrir enlace" aria-label="Abrir enlace"><IExternal size={13} /></button>
                </>
              )}
              <button className="btn sm" onClick={() => restore(t.id)}><IRotate size={13} /> Restaurar</button>
              <button className="btn ghost icon sm danger" title="Eliminar definitivamente" aria-label="Eliminar definitivamente"
                onClick={() => update((d) => { d.trash = d.trash.filter((x) => x.id !== t.id); })}>
                <ITrash size={14} />
              </button>
            </div>
          );
        })
      )}
    </section>
  );
}
