"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { currentPeriod, normalize } from "@/lib/data";
import { setPrivacy } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useSharedList } from "@/lib/useSharedList";
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
  ICart, ICoffee, IChart, ICheck, IEye, IEyeOff, IGift, ILogout, IPlus, ISearch, ISettings, ISpin, IWallet, IX,
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

  // Los montos se ocultan en todos los componentes hijos mientras dure el modo privado.
  setPrivacy(priv);

  const setData: SetData = useCallback(
    (next) => setDataState((prev) => (typeof next === "function" ? next(prev!) : next)),
    []
  );
  const update: Update = useCallback(
    (mutate) =>
      setDataState((prev) => {
        const draft = structuredClone(prev!);
        mutate(draft);
        return draft;
      }),
    []
  );
  const shared = useSharedList(data, update);

  useEffect(() => {
    let alive = true;
    skipSave.current = true;
    api
      .loadData()
      .then(({ content }) => alive && setDataState(normalize(content)))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (data === null) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    setSave("saving");
    let hide: ReturnType<typeof setTimeout>;
    const t = setTimeout(async () => {
      try {
        await api.saveData(data);
        setSave("saved");
        hide = setTimeout(() => setSave(""), 1600);
      } catch {
        setSave("error");
      }
    }, 600);
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, [data]);

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
  if (data === null) return <Splash text="Cargando tus gastos…" />;

  const notify: Notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
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

        <div className="content fade" key={tab}>
          <div className="head">
            <div>
              <h1>{current.title}</h1>
              <p>{current.desc}</p>
            </div>
          </div>
          {tab === "panel" && <PanelTab data={data} onExport={() => setExporting(true)} />}
          {tab === "gastos" && <GastosTab data={data} setData={setData} update={update} />}
          {tab === "diario" && (
            <DiarioTab data={data} update={update} period={dailyPeriod} setPeriod={setDailyPeriod} notify={notify} />
          )}
          {tab === "market" && <MarketTab data={data} update={update} notify={notify} shared={shared} />}
          {tab === "wish" && <WishlistTab data={data} update={update} />}
          {tab === "settings" && (
            <SettingsTab data={data} update={update} session={session} theme={theme} setTheme={setTheme}
              priv={priv} setPriv={setPriv} notify={notify} onExport={() => setExporting(true)} />
          )}
        </div>
      </main>

      <button className="fab" onClick={() => setQuick(true)} title="Anotar un gasto rápido" aria-label="Anotar un gasto rápido">
        <IPlus size={18} /><span>Gasto rápido</span>
      </button>

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
