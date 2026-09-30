"use client";
import { useState } from "react";
import type { SharedList } from "@/lib/useSharedList";
import type { Market } from "@/lib/types";
import { ICheck, ICopy, ISpin, IUsers } from "./icons";
import type { Notify } from "./Tracker";

const pretty = (code: string) => (code.length === 10 ? code.slice(0, 5) + "-" + code.slice(5) : code);

export default function SharedListCard({ market, shared, notify }: { market: Market; shared: SharedList; notify: Notify }) {
  const [name, setName] = useState("Súper de la casa");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { link, status, error, members } = shared;

  const run = async (fn: () => Promise<string>, done?: string) => {
    setBusy(true);
    setMsg("");
    const err = await fn();
    setBusy(false);
    if (err) setMsg(err);
    else if (done) notify(done);
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.code);
      notify("Código copiado");
    } catch {
      notify("Copia el código a mano: " + pretty(link.code));
    }
  };

  if (!link) {
    return (
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Lista compartida</h2>
            <div className="sub">Compra en pareja o en familia: todos ven y marcan la misma lista, y se actualiza sola.</div>
          </div>
        </div>
        <div className="grid2">
          <div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 6, fontWeight: 500 }}>Crear una lista nueva</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field sm" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la lista compartida" />
              <button className="btn sm" disabled={busy} onClick={() => run(() => shared.create(name), "Lista compartida creada")}>Crear</button>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>
              Tu lista actual ({market.items.length} {market.items.length === 1 ? "producto" : "productos"}) pasa a ser la compartida.
            </p>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 6, fontWeight: 500 }}>Unirme con un código</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field sm num" value={code} placeholder="ABCDE-FGHIJ" maxLength={12} onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && code.trim() && document.getElementById("join-shared")?.click()} aria-label="Código de la lista" />
              <button id="join-shared" className="btn sm" disabled={busy || !code.trim()}
                onClick={() => {
                  if (market.items.length && !confirm(`Tu lista actual (${market.items.length} productos) se combinará con la lista compartida. ¿Continuar?`)) return;
                  run(() => shared.join(code), "Te uniste a la lista");
                }}>
                Unirme
              </button>
            </div>
          </div>
        </div>
        {msg && <div className="auth-err" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{msg}</div>}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><IUsers size={16} /> {link.name}</h2>
          <div className="sub">Lista compartida · se actualiza sola cada pocos segundos</div>
        </div>
        {status === "error" ? (
          <span className="badge bad">Sin sincronizar</span>
        ) : status === "ok" ? (
          <span className="badge good"><ICheck size={11} /> Al día</span>
        ) : (
          <span className="badge"><ISpin size={11} /> Sincronizando…</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12.5 }}>Código para invitar</span>
        <b className="num" style={{ fontSize: 16, letterSpacing: ".06em" }}>{pretty(link.code)}</b>
        <button className="btn sm" onClick={copy}><ICopy size={13} /> Copiar</button>
      </div>
      {members.length > 0 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {members.map((m) => <span key={m.user_id} className="badge">{m.email || "Persona"}</span>)}
        </div>
      )}
      {(status === "error" || msg) && <div className="auth-err" role="alert" style={{ marginTop: 12, marginBottom: 0 }}>{msg || error}</div>}
      <div style={{ marginTop: 14 }}>
        <button className="btn sm danger" disabled={busy}
          onClick={() => confirm("¿Salir de la lista compartida? Te quedas con una copia de los productos.") && run(shared.leave, "Saliste de la lista")}>
          Salir de la lista
        </button>
      </div>
    </section>
  );
}
