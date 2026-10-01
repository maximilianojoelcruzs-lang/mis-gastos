"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ApiError, api } from "@/lib/api";
import { addDays, currentPeriod, normalize, todayISO, weekSummary } from "@/lib/data";
import { instant, setPrivacy } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useSharedList } from "@/lib/useSharedList";
import { ROLE_LABEL, useSpaces, type Space } from "@/lib/useSpaces";
import type { AppData } from "@/lib/types";
import ExportForm from "./ExportForm";
import GastosTab from "./GastosTab";
import DiarioTab from "./DiarioTab";
import MarketTab from "./MarketTab";
import Modal from "./Modal";
import PanelTab from "./PanelTab";
import QuickAdd from "./QuickAdd";
import SearchDialog, { type SearchHit } from "./SearchDialog";
import SettingsTab from "./SettingsTab";
import Splash from "./Splash";
import WishlistTab from "./WishlistTab";
import {
  ICart, ICoffee, IChart, ICheck, IEye, IEyeOff, IGift, ILock, ILogout, IPlus, ISearch, ISettings, ISpin, IUsers, IWallet, IX,
} from "./icons";

export type Update = (mutate: (draft: AppData) => void) => void;
export type SetData = (next: AppData | ((prev: AppData) => AppData)) => void;
export type Notify = (text: string) => void;
export type Theme = "auto" | "light" | "dark";

type Tab = "panel" | "gastos" | "diario" | "market" | "wish" | "settings";
type SaveState = "" | "saving" | "saved" | "error";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento bloqueado: se ignora */
  }
};

const MY_SPACE: Space = { owner: null, label: "Mis finanzas", role: "dueño" };
const POLL_MS = 30000;
const sameTime = (a: string | null, b: string | null) => !!a && !!b && instant(a) === instant(b);

/** Lunes de la semana de una fecha "YYYY-MM-DD". */
function weekKey(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(iso, -dow);
}

export default function Tracker({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setDataState] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("");
  const [tab, setTab] = useState<Tab>("panel");
  const [toast, setToast] = useState("");
  const [quick, setQuick] = useState(false);
  const [search, setSearch] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dailyPeriod, setDailyPeriod] = useState(currentPeriod());
  const [theme, setTheme] = useState<Theme>(() => {
    const t = read("mg-theme");
    return t === "light" || t === "dark" ? t : "auto";
  });
  const [priv, setPriv] = useState(() => read("mg-private") === "1");
  const skipSave = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const spaces = useSpaces(userId);
  const [space, setSpace] = useState<Space>(MY_SPACE);
  const readOnly = space.role === "lector";
  const owner = space.owner;
  // Refs para que los callbacks estables vean el estado actual.
  const roRef = useRef(readOnly);
  roRef.current = readOnly;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const dataRef = useRef(data);
  dataRef.current = data;
  /** Versión (updated_at) de los datos que tengo; se envía al guardar para detectar choques. */
  const version = useRef<string | null>(null);
  /** Hay cambios sin guardar. */
  const dirty = useRef(false);
  const chain = useRef<Promise<void>>(Promise.resolve());

  // Los montos se ocultan en todos los componentes hijos mientras dure el modo privado.
  setPrivacy(priv);

  const notify: Notify = useCallback((text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  }, []);

  const setData: SetData = useCallback(
    (next) => setDataState((prev) => (typeof next === "function" ? next(prev!) : next)),
    []
  );
  const update: Update = useCallback(
    (mutate) => {
      if (roRef.current) return notify("Solo puedes ver estos datos: no tienes permiso para cambiarlos");
      setDataState((prev) => {
        const draft = structuredClone(prev!);
        mutate(draft);
        return draft;
      });
    },
    [notify]
  );
  // La lista compartida del súper es personal: no se sincroniza al mirar datos de otra persona.
  const shared = useSharedList(owner ? null : data, update);

  const reload = useCallback(async (message?: string) => {
    const target = ownerRef.current;
    const { content, updated_at } = await api.loadData(target);
    if (ownerRef.current !== target) return;
    version.current = updated_at;
    dirty.current = false;
    skipSave.current = true;
    setDataState(normalize(content));
    if (message) notify(message);
  }, [notify]);

  // Guarda en orden (una petición a la vez) enviando la versión que tenía.
  // `target` es el dueño de esos datos al momento del cambio: así nunca se guardan en otro espacio.
  const persist = useCallback((content: AppData, target: string | null) => {
    const run = async () => {
      if (ownerRef.current !== target) return;
      try {
        const r = await api.saveData(content, version.current, target);
        version.current = r.updated_at;
        if (dataRef.current === content) dirty.current = false;
        setSave("saved");
        setTimeout(() => setSave((s) => (s === "saved" ? "" : s)), 1600);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setSave("");
          await reload("Hubo cambios desde otro dispositivo o persona: se cargó la versión más reciente.").catch(() => setSave("error"));
        } else {
          setSave("error");
          if (e instanceof ApiError && e.status === 403) notify(e.message);
        }
      }
    };
    chain.current = chain.current.then(run, run);
    return chain.current;
  }, [notify, reload]);

  useEffect(() => {
    let alive = true;
    skipSave.current = true;
    dirty.current = false;
    version.current = null;
    setDataState(null);
    api
      .loadData(owner)
      .then(({ content, updated_at }) => {
        if (!alive) return;
        version.current = updated_at;
        skipSave.current = true;
        setDataState(normalize(content));
      })
      .catch((e: Error) => {
        if (!alive) return;
        if (owner) {
          notify("No se pudieron abrir esos datos: " + e.message);
          setSpace(MY_SPACE);
        } else setLoadError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [userId, owner, notify]);

  useEffect(() => {
    if (data === null) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (roRef.current) return;
    dirty.current = true;
    setSave("saving");
    const target = ownerRef.current;
    const t = setTimeout(() => persist(data, target), 600);
    return () => clearTimeout(t);
  }, [data, persist]);

  // Si alguien más cambió los datos (otro dispositivo, o la persona con quien los compartes), se recargan.
  useEffect(() => {
    const check = () => {
      if (dirty.current || document.visibilityState !== "visible" || !version.current) return;
      const target = ownerRef.current;
      api.version(target).then(({ updated_at }) => {
        if (ownerRef.current === target && !dirty.current && version.current && !sameTime(updated_at, version.current))
          reload(target ? "Se actualizaron los datos compartidos" : "Se cargaron cambios hechos en otro dispositivo").catch(() => {});
      }).catch(() => {});
    };
    const id = setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
    };
  }, [reload]);

  // Si te quitan el acceso o te cambian el rol, se refleja aquí.
  useEffect(() => {
    if (!owner || !spaces.ready) return;
    const s = spaces.spaces.find((x) => x.owner === owner);
    if (!s) {
      setSpace(MY_SPACE);
      notify("Ya no tienes acceso a esos datos");
    } else if (s.role !== space.role) setSpace(s);
  }, [spaces.spaces, spaces.ready, owner, space.role, notify]);

  // Aviso del resumen semanal: una vez por semana.
  useEffect(() => {
    if (!data || owner) return;
    const key = weekKey(todayISO());
    if (read("mg-week-seen") === key) return;
    write("mg-week-seen", key);
    const w = weekSummary(data);
    if (w.prevTotal > 0 || w.count > 0) setTimeout(() => notify("Tu resumen de la semana está listo en el Panel"), 800);
  }, [data, owner, notify]);

  const openSpace = async (s: Space) => {
    if (s.owner === owner) return;
    if (dirty.current && dataRef.current && !roRef.current) await persist(dataRef.current, owner);
    setTab("panel");
    setSpace(s);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "auto") delete root.dataset.theme;
    else root.dataset.theme = theme;
    write("mg-theme", theme);
  }, [theme]);

  useEffect(() => {
    write("mg-private", priv ? "1" : "0");
  }, [priv]);

  // Atajos: "/" o Ctrl/Cmd+K abren el buscador.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);
      if ((e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearch(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (loadError) return <Splash text={"No se pudieron cargar tus datos: " + loadError} />;
  if (data === null) return <Splash text={owner ? `Abriendo las finanzas de ${space.label}…` : "Cargando tus gastos…"} />;

  const downloadReport = async () => {
    try {
      const { exportData } = await import("@/lib/export");
      const name = await exportData(data, "month", "pdf");
      notify("Descargado: " + name);
    } catch {
      notify("No se pudo generar el PDF");
    }
  };

  const openHit = (hit: SearchHit) => {
    setSearch(false);
    if (hit.kind === "cuenta") {
      setData((s) => ({ ...s, activeId: hit.monthId! }));
      setTab("gastos");
    } else if (hit.kind === "diario") {
      setDailyPeriod(hit.date!.slice(0, 7));
      setTab("diario");
    } else setTab(hit.kind === "super" ? "market" : "wish");
  };

  const email = session.user.email || "";
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const tabs: { id: Tab; label: string; short: string; icon: typeof IWallet; count?: number; title: string; desc: string }[] = [
    { id: "panel", label: "Panel", short: "Panel", icon: IChart, title: "Panel", desc: "Tus finanzas de un vistazo." },
    { id: "gastos", label: "Cuentas", short: "Cuentas", icon: IWallet, count: month.items.filter((i) => !i.paid).length,
      title: "Cuentas del mes", desc: "Tus gastos mensuales: ingresos, cuentas fijas, cuotas y vencimientos." },
    { id: "diario", label: "Gastos diarios", short: "Diario", icon: ICoffee,
      title: "Gastos diarios", desc: "Anota lo que gastas día a día: el café, el almacén, la micro…" },
    { id: "market", label: "Supermercado", short: "Súper", icon: ICart, count: data.market.items.filter((i) => !i.done).length,
      title: "Supermercado", desc: "Tu lista, presupuesto, tarjetas de alimentación, lista compartida y modo tienda." },
    { id: "wish", label: "Próximas compras", short: "Compras", icon: IGift, count: data.wishlist.items.filter((i) => !i.done).length,
      title: "Próximas compras", desc: "Lo que quieres comprar o regalar, con prioridad, fecha y ahorro." },
  ];
  const current = tab === "settings"
    ? { title: "Ajustes", desc: "Apariencia, privacidad, categorías, supermercados, exportación y cuenta." }
    : tabs.find((t) => t.id === tab)!;

  const saveBadge =
    save === "saving" ? (
      <span className="save"><ISpin size={12} /><span className="t">Guardando…</span></span>
    ) : save === "saved" ? (
      <span className="save"><ICheck size={12} /><span className="t">Guardado</span></span>
    ) : save === "error" ? (
      <span className="save err"><IX size={12} /><span className="t">Error al guardar</span></span>
    ) : (
      <span className="save" />
    );
  const eyeBtn = (
    <button className="btn ghost icon sm" onClick={() => setPriv(!priv)} title={priv ? "Mostrar montos" : "Ocultar montos"}
      aria-pressed={priv}>
      {priv ? <IEyeOff size={15} /> : <IEye size={15} />}
    </button>
  );
  const settingsBtn = (
    <button className={"btn icon sm " + (tab === "settings" ? "" : "ghost")} onClick={() => setTab("settings")} title="Ajustes">
      <ISettings size={15} />
    </button>
  );
  const brand = (
    <div className="brand">
      <span className="logo"><IWallet size={17} /></span>
      <b>Mis Gastos</b>
    </div>
  );

  return (
    <>
      <aside className="side">
        {brand}
        {spaces.spaces.length > 1 && (
          <select className="field sm space-pick" aria-label="Finanzas que estás viendo" value={owner || ""}
            onChange={(e) => { const s = spaces.spaces.find((x) => (x.owner || "") === e.target.value); if (s) openSpace(s); }}>
            {spaces.spaces.map((s) => (
              <option key={s.owner || "me"} value={s.owner || ""}>{s.owner ? `${s.label} · ${ROLE_LABEL[s.role as "lector"]}` : s.label}</option>
            ))}
          </select>
        )}
        <button className="searchbtn" onClick={() => setSearch(true)}>
          <ISearch size={14} /> Buscar <kbd>/</kbd>
        </button>
        <nav className="nav">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              <t.icon size={16} />
              {t.label}
              {!!t.count && <span className="count">{t.count}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="tools">{eyeBtn}{settingsBtn}<span style={{ marginLeft: "auto" }}>{saveBadge}</span></div>
          <div className="user">
            <span className="avatar">{(email[0] || "?").toUpperCase()}</span>
            <span className="mail">{email}</span>
            <button className="btn ghost icon sm" onClick={() => getSupabase()!.auth.signOut()} title="Cerrar sesión">
              <ILogout size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          {brand}
          <div className="r">
            {saveBadge}
            <button className="btn ghost icon sm" onClick={() => setSearch(true)} title="Buscar"><ISearch size={15} /></button>
            {eyeBtn}
            {settingsBtn}
          </div>
        </header>

        <div className="content fade" key={tab + (owner || "")}>
          {owner && (
            <div className="space-banner" role="status">
              {readOnly ? <ILock size={15} /> : <IUsers size={15} />}
              <span style={{ flex: 1, minWidth: 180 }}>
                Estás viendo las finanzas de <b>{space.label}</b> · {readOnly ? "solo lectura" : "puedes editar"}
              </span>
              <button className="btn sm" onClick={() => openSpace(MY_SPACE)}>Volver a mis finanzas</button>
            </div>
          )}
          <div className="head">
            <div>
              <h1>{current.title}</h1>
              <p>{current.desc}</p>
            </div>
          </div>
          {tab === "panel" && <PanelTab data={data} onExport={() => setExporting(true)} onReport={downloadReport} notify={notify} />}
          {tab === "gastos" && <GastosTab data={data} setData={setData} update={update} canReset={!owner} />}
          {tab === "diario" && (
            <DiarioTab data={data} update={update} period={dailyPeriod} setPeriod={setDailyPeriod} notify={notify} />
          )}
          {tab === "market" && <MarketTab data={data} update={update} notify={notify} shared={shared} />}
          {tab === "wish" && <WishlistTab data={data} update={update} />}
          {tab === "settings" && (
            <SettingsTab data={data} update={update} session={session} theme={theme} setTheme={setTheme}
              priv={priv} setPriv={setPriv} notify={notify} onExport={() => setExporting(true)}
              spaces={spaces} space={space} openSpace={openSpace} />
          )}
        </div>
      </main>

      {!readOnly && (
        <button className="fab" onClick={() => setQuick(true)} title="Anotar un gasto rápido" aria-label="Anotar un gasto rápido">
          <IPlus size={18} /><span>Gasto rápido</span>
        </button>
      )}

      <nav className="tabbar">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={19} />
            {t.short}
          </button>
        ))}
      </nav>

      {quick && <QuickAdd data={data} update={update} notify={notify} onClose={() => setQuick(false)} onSaved={(date) => setDailyPeriod(date.slice(0, 7))} />}
      {search && <SearchDialog data={data} onClose={() => setSearch(false)} onOpen={openHit} />}
      {exporting && (
        <Modal onClose={() => setExporting(false)} label="Exportar">
          <h2>Exportar</h2>
          <p className="lead">Descarga tus datos en un archivo para guardarlos o compartirlos.</p>
          <ExportForm data={data} onDone={() => setExporting(false)} notify={notify} />
        </Modal>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
