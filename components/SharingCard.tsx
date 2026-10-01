"use client";
import { useState } from "react";
import { ROLE_LABEL, type Role, type Space, type Spaces } from "@/lib/useSpaces";
import { ICopy, ILock, IUsers } from "./icons";
import type { Notify } from "./Tracker";

type Props = { spaces: Spaces; space: Space; openSpace: (s: Space) => void; notify: Notify; userId: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

/** Compartir mis finanzas con roles, y entrar a las que me compartieron. */
export default function SharingCard({ spaces, space, openSpace, notify, userId }: Props) {
  const [role, setRole] = useState<Role>("lector");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (c: string) => {
    try {
      await navigator.clipboard.writeText(c);
      notify("Código copiado");
    } catch {
      notify("Copia el código: " + c);
    }
  };

  const others = spaces.spaces.filter((s) => s.owner);

  if (space.owner) {
    return (
      <section className="card">
        <div className="card-h">
          <div>
            <h2>Finanzas compartidas contigo</h2>
            <div className="sub">Estás viendo las finanzas de {space.label} · {ROLE_LABEL[space.role as Role]}</div>
          </div>
          {space.role === "lector" ? <ILock size={16} /> : <IUsers size={16} />}
        </div>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>
          {space.role === "lector"
            ? "Puedes ver todo, pero no cambiar nada. Lo que hagas aquí no se guarda."
            : "Puedes ver y cambiar estos datos. Tus cambios los verá la otra persona."}{" "}
          Tu contraseña, tema y modo privado siguen siendo tuyos.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => openSpace({ owner: null, label: "Mis finanzas", role: "dueño" })}>Volver a mis finanzas</button>
          <button className="btn danger" disabled={busy}
            onClick={() => confirm(`¿Dejar de ver las finanzas de ${space.label}? Necesitarás un código nuevo para volver.`) &&
              run(async () => { await spaces.removeMember(space.owner!, userId); openSpace({ owner: null, label: "Mis finanzas", role: "dueño" }); })}>
            Dejar de ver estas finanzas
          </button>
        </div>
        {msg && <div className={msg.ok ? "auth-ok" : "auth-err"} role="status" style={{ margin: "12px 0 0" }}>{msg.text}</div>}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-h">
        <div>
          <h2>Compartir mis finanzas</h2>
          <div className="sub">Invita a tu pareja o familia con un código. Tú decides si puede solo ver o también editar.</div>
        </div>
        <IUsers size={16} />
      </div>

      {spaces.error && <div className="auth-err" role="alert" style={{ margin: "0 0 12px" }}>{spaces.error}</div>}

      <div className="set-row">
        <div className="t"><b>Invitar</b><span>El código sirve una vez y vence en 7 días. La otra persona necesita su propia cuenta.</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div className="seg" role="group" aria-label="Permiso">
            {(["lector", "editor"] as Role[]).map((r) => (
              <button key={r} className={role === r ? "on" : ""} onClick={() => setRole(r)}>{ROLE_LABEL[r]}</button>
            ))}
          </div>
          <button className="btn sm primary" disabled={busy}
            onClick={() => run(async () => { const inv = await spaces.createInvite(role); if (inv) copy(inv.code); })}>
            Crear código
          </button>
        </div>
      </div>

      {spaces.invites.length > 0 && (
        <div className="set-row" style={{ display: "block" }}>
          <div className="t" style={{ marginBottom: 8 }}><b>Códigos pendientes</b></div>
          {spaces.invites.map((i) => (
            <div className="member" key={i.code}>
              <span className="codebox">{i.code}</span>
              <span className="n muted">{ROLE_LABEL[i.role]} · vence el {fmtDate(i.expires_at)}</span>
              <button className="btn sm" onClick={() => copy(i.code)}><ICopy size={13} /> Copiar</button>
              <button className="btn sm ghost danger" disabled={busy} onClick={() => run(() => spaces.revokeInvite(i.code))}>Anular</button>
            </div>
          ))}
        </div>
      )}

      <div className="set-row" style={{ display: "block" }}>
        <div className="t" style={{ marginBottom: 8 }}><b>Personas con acceso</b></div>
        {spaces.myMembers.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Nadie más ve tus finanzas.</div>
        ) : (
          spaces.myMembers.map((m) => (
            <div className="member" key={m.member_id}>
              <span className="n">{m.member_email || "Sin correo"}</span>
              <select className="field sm" style={{ width: "auto" }} value={m.role} aria-label={`Permiso de ${m.member_email}`} disabled={busy}
                onChange={(e) => run(() => spaces.setRole(m.member_id, e.target.value as Role), "Permiso actualizado")}>
                <option value="lector">{ROLE_LABEL.lector}</option>
                <option value="editor">{ROLE_LABEL.editor}</option>
              </select>
              <button className="btn sm ghost danger" disabled={busy}
                onClick={() => confirm(`¿Quitarle el acceso a ${m.member_email}?`) && run(() => spaces.removeMember(userId, m.member_id), "Acceso quitado")}>
                Quitar
              </button>
            </div>
          ))
        )}
      </div>

      <div className="set-row" style={{ alignItems: "flex-start" }}>
        <div className="t"><b>Unirme con un código</b><span>Si alguien te compartió sus finanzas, escribe aquí su código.</span></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="field sm" value={code} placeholder="ABCD123456" maxLength={14} aria-label="Código de invitación"
            onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ width: 150, fontFamily: "var(--font-mono), monospace" }} />
          <button className="btn sm" disabled={busy || code.trim().length < 6}
            onClick={() => run(async () => {
              const r = await spaces.acceptInvite(code);
              setCode("");
              if (r) {
                notify(`Listo: ahora puedes ${r.role === "editor" ? "ver y editar" : "ver"} las finanzas de ${r.owner_email || "esa persona"}`);
                openSpace({ owner: r.owner_id, label: r.owner_email || "Otra persona", role: r.role });
              }
            })}>
            Unirme
          </button>
        </div>
      </div>

      {others.length > 0 && (
        <div className="set-row" style={{ display: "block" }}>
          <div className="t" style={{ marginBottom: 8 }}><b>Finanzas que te compartieron</b></div>
          {others.map((s) => (
            <div className="member" key={s.owner}>
              <span className="n">{s.label}</span>
              <span className="muted" style={{ fontSize: 12 }}>{ROLE_LABEL[s.role as Role]}</span>
              <button className="btn sm" onClick={() => openSpace(s)}>Abrir</button>
            </div>
          ))}
        </div>
      )}

      {msg && <div className={msg.ok ? "auth-ok" : "auth-err"} role="status" style={{ margin: "12px 0 0" }}>{msg.text}</div>}
    </section>
  );
}
