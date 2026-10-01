"use client";
import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { PALETTE, catColor } from "@/lib/data";
import { traducirError, uid } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import type { AppData, PaletteKey } from "@/lib/types";
import type { Space, Spaces } from "@/lib/useSpaces";
import SharingCard from "./SharingCard";
import CurrencyInput from "./CurrencyInput";
import { IDownload, IPlus, ITrash, IUsers, IX } from "./icons";
import type { Notify, Theme, Update } from "./Tracker";

type Props = {
  data: AppData;
  update: Update;
  session: Session;
  theme: Theme;
  setTheme: (t: Theme) => void;
  priv: boolean;
  setPriv: (v: boolean) => void;
  notify: Notify;
  onExport: () => void;
  spaces: Spaces;
  space: Space;
  openSpace: (s: Space) => void;
};

export default function SettingsTab({ data, update, session, theme, setTheme, priv, setPriv, notify, onExport, spaces, space, openSpace }: Props) {
  const [colorFor, setColorFor] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [newStore, setNewStore] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [pass, setPass] = useState("");
  const [passMsg, setPassMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const usage = (id: string) =>
    data.months.reduce((s, m) => s + m.items.filter((i) => i.category === id).length, 0) + data.daily.filter((d) => d.category === id).length;

  const addCategory = () => {
    const label = newCat.trim().slice(0, 30);
    if (!label) return;
    if (data.categories.some((c) => c.label.toLowerCase() === label.toLowerCase())) return notify("Ya existe una categoría con ese nombre");
    update((d) => {
      const used = new Set(d.categories.map((c) => c.color));
      const color: PaletteKey = PALETTE.find((p) => !used.has(p.key))?.key || "slate";
      // Antes de "Otros", que siempre queda al final.
      const at = d.categories.findIndex((c) => c.id === "otros");
      d.categories.splice(at < 0 ? d.categories.length : at, 0, { id: uid(), label, color, limit: 0 });
    });
    setNewCat("");
  };

  const deleteCategory = (id: string) => {
    const n = usage(id);
    const name = data.categories.find((c) => c.id === id)?.label;
    if (!confirm(n ? `¿Eliminar "${name}"? Sus ${n} gastos pasarán a "Otros".` : `¿Eliminar "${name}"?`)) return;
    update((d) => {
      d.categories = d.categories.filter((c) => c.id !== id);
      for (const m of d.months) for (const i of m.items) if (i.category === id) i.category = "otros";
      for (const x of d.daily) if (x.category === id) x.category = "otros";
    });
  };

  const addStore = () => {
    const name = newStore.trim().slice(0, 30);
    if (!name) return;
    if (data.market.stores.some((s) => s.toLowerCase() === name.toLowerCase())) return notify("Ya tienes ese supermercado");
    update((d) => { d.market.stores.push(name); });
    setNewStore("");
  };

  const addPerson = () => {
    const name = newPerson.trim().slice(0, 30);
    if (!name) return;
    if (data.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) return notify("Ya agregaste a esa persona");
    if (data.people.length >= 10) return notify("Máximo 10 personas");
    update((d) => { d.people.push({ id: uid(), name }); });
    setNewPerson("");
  };

  const deletePerson = (id: string) => {
    const p = data.people.find((x) => x.id === id);
    const n = data.daily.filter((d) => d.split.includes(id)).length;
    if (!p || !confirm(n ? `¿Quitar a ${p.name}? Sus ${n} gastos compartidos quedarán como solo tuyos.` : `¿Quitar a ${p.name}?`)) return;
    update((d) => {
      d.people = d.people.filter((x) => x.id !== id);
      d.settlements = d.settlements.filter((x) => x.person !== id);
      for (const x of d.daily) {
        if (!x.split.includes(id)) continue;
        x.split = x.split.filter((y) => y !== id);
        if (x.paidBy === id) x.paidBy = "";
      }
    });
  };

  const changePassword = async () => {
    setPassMsg(null);
    if (pass.length < 6) return setPassMsg({ ok: false, text: "La contraseña debe tener al menos 6 caracteres." });
    const { error } = await getSupabase()!.auth.updateUser({ password: pass });
    if (error) setPassMsg({ ok: false, text: traducirError(error.message) });
    else {
      setPass("");
      setPassMsg({ ok: true, text: "Contraseña actualizada." });
    }
  };

  return (
    <div>
      <section className="card">
        <div className="card-h"><h2>Apariencia y privacidad</h2></div>
        <div className="set-row">
          <div className="t"><b>Tema</b><span>Automático sigue el modo claro u oscuro de tu dispositivo.</span></div>
          <div className="seg" role="group" aria-label="Tema">
            {([["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]] as [Theme, string][]).map(([id, l]) => (
              <button key={id} className={theme === id ? "on" : ""} onClick={() => setTheme(id)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="set-row">
          <div className="t"><b>Ocultar montos</b><span>Cambia los montos por puntos, por si alguien mira tu pantalla. Se guarda solo en este dispositivo.</span></div>
          <button className={"toggle " + (priv ? "on" : "")} aria-label="Ocultar montos" aria-pressed={priv} onClick={() => setPriv(!priv)} />
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Categorías y límites</h2>
            <div className="sub">Se usan en cuentas y gastos diarios. Toca el color para cambiarlo. El límite es lo máximo que quieres gastar al mes en esa categoría ($0 = sin límite).</div>
          </div>
        </div>
        {data.categories.map((c) => (
          <div key={c.id}>
            <div className="catrow">
              <button className="colorbtn" style={{ background: catColor(c.color) }} aria-label={`Color de ${c.label}`}
                onClick={() => setColorFor(colorFor === c.id ? null : c.id)} />
              <input className="bare name" value={c.label} maxLength={30} aria-label="Nombre de la categoría"
                onChange={(e) => update((d) => { const x = d.categories.find((k) => k.id === c.id); if (x) x.label = e.target.value; })}
                onBlur={(e) => { if (!e.target.value.trim()) update((d) => { const x = d.categories.find((k) => k.id === c.id); if (x) x.label = "Sin nombre"; }); }} />
              <span className="muted hide-sm" style={{ fontSize: 12 }}>{usage(c.id)} {usage(c.id) === 1 ? "gasto" : "gastos"}</span>
              <CurrencyInput className="field sm amount limit-f" value={c.limit} placeholder="Sin límite" aria-label={`Límite mensual de ${c.label}`}
                onChange={(v) => update((d) => { const x = d.categories.find((k) => k.id === c.id); if (x) x.limit = v; })} />
              {c.id !== "otros" ? (
                <button className="btn ghost icon sm danger" title="Eliminar categoría" onClick={() => deleteCategory(c.id)}><ITrash size={14} /></button>
              ) : (
                <span style={{ width: 28 }} />
              )}
            </div>
            {colorFor === c.id && (
              <div className="swatches fade">
                {PALETTE.map((p) => (
                  <button key={p.key} className={"swatch " + (c.color === p.key ? "on" : "")} style={{ background: catColor(p.key) }}
                    title={p.label} aria-label={p.label}
                    onClick={() => { update((d) => { const x = d.categories.find((k) => k.id === c.id); if (x) x.color = p.key; }); setColorFor(null); }} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="add-row">
          <input className="field" value={newCat} placeholder="Nueva categoría (ej: Mascotas)" maxLength={30}
            onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} style={{ flex: 1 }} />
          <button className="btn" style={{ flex: "none" }} onClick={addCategory}><IPlus size={14} /> Agregar</button>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Gastos compartidos</h2>
            <div className="sub">Personas con las que divides gastos (pareja, roommate…). Al anotar un gasto eliges con quién lo compartes y quién pagó, y en “Gastos diarios” ves quién le debe a quién.</div>
          </div>
          <IUsers size={16} />
        </div>
        <div className="chips">
          {data.people.map((p) => (
            <span key={p.id} className="chip">
              {p.name}
              <button className="x" aria-label={`Quitar a ${p.name}`} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                onClick={() => deletePerson(p.id)}>
                <IX size={12} />
              </button>
            </span>
          ))}
          {data.people.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Aún no agregas a nadie.</span>}
        </div>
        <div className="add-row">
          <input className="field" value={newPerson} placeholder="Nombre (ej: Cami)" maxLength={30}
            onChange={(e) => setNewPerson(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} style={{ flex: 1 }} />
          <button className="btn" style={{ flex: "none" }} onClick={addPerson}><IPlus size={14} /> Agregar</button>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Supermercados</h2>
            <div className="sub">Los que comparas en la pestaña Súper.</div>
          </div>
        </div>
        <div className="chips">
          {data.market.stores.map((s) => (
            <span key={s} className="chip">
              {s}
              <button className="x" aria-label={`Quitar ${s}`} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                onClick={() => update((d) => { d.market.stores = d.market.stores.filter((x) => x !== s); if (d.market.store === s) d.market.store = ""; })}>
                <IX size={12} />
              </button>
            </span>
          ))}
          {data.market.stores.length === 0 && <span className="muted" style={{ fontSize: 13 }}>Sin supermercados.</span>}
        </div>
        <div className="add-row">
          <input className="field" value={newStore} placeholder="Agregar supermercado" maxLength={30}
            onChange={(e) => setNewStore(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStore()} style={{ flex: 1 }} />
          <button className="btn" style={{ flex: "none" }} onClick={addStore}><IPlus size={14} /> Agregar</button>
        </div>
      </section>

      <SharingCard spaces={spaces} space={space} openSpace={openSpace} notify={notify} userId={session.user.id} />

      <section className="card">
        <div className="card-h"><h2>Tus datos</h2></div>
        <div className="set-row">
          <div className="t"><b>Exportar</b><span>Descarga un resumen en Excel o PDF.</span></div>
          <button className="btn" onClick={onExport}><IDownload size={14} /> Exportar…</button>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>Cuenta</h2></div>
        <div className="set-row">
          <div className="t"><b>Correo</b><span>{session.user.email}</span></div>
        </div>
        <div className="set-row" style={{ alignItems: "flex-start" }}>
          <div className="t"><b>Cambiar contraseña</b><span>Mínimo 6 caracteres.</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input className="field sm" type="password" autoComplete="new-password" value={pass} placeholder="Contraseña nueva"
              onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && changePassword()} style={{ width: 180 }} />
            <button className="btn sm" onClick={changePassword}>Guardar</button>
          </div>
          {passMsg && (
            <div className={passMsg.ok ? "auth-ok" : "auth-err"} role="status" style={{ width: "100%", margin: 0 }}>{passMsg.text}</div>
          )}
        </div>
        <div className="set-row">
          <div className="t"><b>Cerrar sesión</b><span>Sales de Mis Gastos en este dispositivo.</span></div>
          <button className="btn" onClick={() => getSupabase()!.auth.signOut()}>Cerrar sesión</button>
        </div>
      </section>
    </div>
  );
}
