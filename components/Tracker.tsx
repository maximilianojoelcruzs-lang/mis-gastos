"use client";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { normalize } from "@/lib/data";
import { getSupabase } from "@/lib/supabase/client";
import type { AppData } from "@/lib/types";
import GastosTab from "./GastosTab";
import MarketTab from "./MarketTab";
import PanelTab from "./PanelTab";
import Splash from "./Splash";
import WishlistTab from "./WishlistTab";
import { ICart, IChart, ICheck, IGift, ILogout, ISpin, IWallet, IX } from "./icons";

export type Update = (mutate: (draft: AppData) => void) => void;
export type SetData = (next: AppData | ((prev: AppData) => AppData)) => void;
export type Notify = (text: string) => void;

type Tab = "panel" | "gastos" | "market" | "wish";
type SaveState = "" | "saving" | "saved" | "error";

export default function Tracker({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setDataState] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("");
  const [tab, setTab] = useState<Tab>("panel");
  const [toast, setToast] = useState("");
  const skipSave = useRef(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  if (loadError) return <Splash text={"No se pudieron cargar tus datos: " + loadError} />;
  if (data === null) return <Splash text="Cargando tus gastos…" />;

  const setData: SetData = (next) =>
    setDataState((prev) => (typeof next === "function" ? next(prev!) : next));
  const update: Update = (mutate) =>
    setDataState((prev) => {
      const draft = structuredClone(prev!);
      mutate(draft);
      return draft;
    });
  const notify: Notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };

  const email = session.user.email || "";
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const tabs: { id: Tab; label: string; short: string; icon: typeof IWallet; count?: number; title: string; desc: string }[] = [
    { id: "panel", label: "Panel", short: "Panel", icon: IChart,
      title: "Panel", desc: "Tus finanzas de un vistazo." },
    { id: "gastos", label: "Gastos", short: "Gastos", icon: IWallet, count: month.items.filter((i) => !i.paid).length,
      title: "Gastos", desc: "Ingresos, cuentas y ahorro del mes." },
    { id: "market", label: "Supermercado", short: "Súper", icon: ICart,
      count: data.market.items.filter((i) => !i.done).length,
      title: "Supermercado", desc: "Tu lista de compra, listas guardadas e historial de precios." },
    { id: "wish", label: "Próximas compras", short: "Compras", icon: IGift,
      count: data.wishlist.items.filter((i) => !i.done).length,
      title: "Próximas compras", desc: "Lo que quieres comprar o regalar, con prioridad, fecha y ahorro." },
  ];
  const current = tabs.find((t) => t.id === tab)!;

  const saveBadge =
    save === "saving" ? (
      <span className="save"><ISpin size={12} /> Guardando…</span>
    ) : save === "saved" ? (
      <span className="save"><ICheck size={12} /> Guardado</span>
    ) : save === "error" ? (
      <span className="save err"><IX size={12} /> Error al guardar</span>
    ) : (
      <span className="save" />
    );
  const logout = (
    <button className="btn ghost icon sm" onClick={() => getSupabase()!.auth.signOut()} title="Cerrar sesión">
      <ILogout size={15} />
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
          {saveBadge}
          <div className="user">
            <span className="avatar">{(email[0] || "?").toUpperCase()}</span>
            <span className="mail">{email}</span>
            {logout}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          {brand}
          <div className="r">{saveBadge}{logout}</div>
        </header>

        <div className="content fade" key={tab}>
          <div className="head">
            <div>
              <h1>{current.title}</h1>
              <p>{current.desc}</p>
            </div>
          </div>
          {tab === "panel" && <PanelTab data={data} />}
          {tab === "gastos" && <GastosTab data={data} setData={setData} update={update} />}
          {tab === "market" && <MarketTab data={data} update={update} notify={notify} />}
          {tab === "wish" && <WishlistTab data={data} update={update} />}
        </div>
      </main>

      <nav className="tabbar">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={19} />
            {t.short}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
