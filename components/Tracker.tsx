"use client";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";
import type { AppData } from "@/lib/types";
import GastosTab from "./GastosTab";
import MarketTab from "./MarketTab";
import PanelTab from "./PanelTab";
import Splash from "./Splash";
import WishlistTab from "./WishlistTab";
import { IChart, ICart, ICheck, IGift, ILogout, ISpin, IWallet, IX } from "./icons";

export type Update = (mutate: (draft: AppData) => void) => void;
export type SetData = (next: AppData | ((prev: AppData) => AppData)) => void;

type Tab = "panel" | "gastos" | "market" | "wish";
type SaveState = "" | "saving" | "saved" | "error";

export default function Tracker({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setDataState] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("");
  const [tab, setTab] = useState<Tab>("panel");
  const skipSave = useRef(true);

  useEffect(() => {
    let alive = true;
    skipSave.current = true;
    api
      .loadData()
      .then(({ content }) => alive && setDataState(content))
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
        hide = setTimeout(() => setSave(""), 1400);
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

  const email = session.user.email || "";
  const month = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const tabs: { id: Tab; label: string; hint: string; icon: typeof IWallet; count: number; title: string; desc: string }[] = [
    { id: "panel", label: "Panel", hint: "Resumen y gráficos", icon: IChart, count: data.months.length,
      title: "Panel de control", desc: "Tus finanzas de un vistazo: ahorro acumulado, meses y en qué se va la plata." },
    { id: "gastos", label: "Gastos", hint: "Presupuesto mensual", icon: IWallet, count: month.items.length,
      title: "Control de gastos", desc: "Tu ingreso, tus cuentas y cuánto te queda libre este mes." },
    { id: "market", label: "Supermercado", hint: "Lista de compra", icon: ICart,
      count: data.market.items.filter((i) => !i.done).length,
      title: "Supermercado", desc: "Arma la lista, estima el total y marca lo que ya va en el carro." },
    { id: "wish", label: "Próximas compras", hint: "Deseos y regalos", icon: IGift,
      count: data.wishlist.items.filter((i) => !i.done).length,
      title: "Próximas compras", desc: "Guarda lo que quieres comprar o regalar y busca el mejor precio con IA." },
  ];
  const current = tabs.find((t) => t.id === tab)!;

  const saveBadge =
    save === "saving" ? (
      <span className="mg-save on muted"><ISpin size={12} /> Guardando</span>
    ) : save === "saved" ? (
      <span className="mg-save on"><ICheck size={12} /> Guardado</span>
    ) : save === "error" ? (
      <span className="mg-save on err"><IX size={12} /> Error</span>
    ) : (
      <span className="mg-save" />
    );
  const logout = (
    <button className="mg-logoutbtn" onClick={() => getSupabase()!.auth.signOut()} title="Cerrar sesión">
      <ILogout size={16} />
    </button>
  );
  const brand = (
    <div className="fx-brand">
      <span className="mg-logo"><IWallet size={20} /></span>
      <div>
        <b>Mis Gastos</b>
        <small>FINANZAS · v2</small>
      </div>
    </div>
  );

  return (
    <>
      <aside className="fx-side">
        {brand}
        <div className="fx-navlabel">Módulos</div>
        <nav className="fx-nav">
          {tabs.map((t, i) => (
            <button key={t.id} className={"fx-navitem " + (tab === t.id ? "active" : "")} onClick={() => setTab(t.id)}>
              <span className="ic"><t.icon size={17} /></span>
              <span className="tx">
                <b>{t.label}</b>
                <small>{t.hint}</small>
              </span>
              <span className="num">{String(i + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </nav>
        <div className="fx-sidefoot">
          <div className="fx-status">
            <span className="led" /> Sistema en línea
            <span style={{ marginLeft: "auto" }}>{saveBadge}</span>
          </div>
          <div className="fx-user">
            <span className="fx-avatar">{(email[0] || "?").toUpperCase()}</span>
            <span className="mail"><b>Mi cuenta</b>{email}</span>
            {logout}
          </div>
        </div>
      </aside>

      <main className="fx-main">
        <header className="fx-topbar">
          {brand}
          <div className="right">{saveBadge}{logout}</div>
        </header>

        <div className="fx-content fx-enter" key={tab}>
          <div className="fx-pagehead">
            <div>
              <div className="fx-eyebrow">Módulo {String(tabs.indexOf(current) + 1).padStart(2, "0")} · {current.count} {current.id === "panel" ? (current.count === 1 ? "mes" : "meses") : current.count === 1 ? "activo" : "activos"}</div>
              <h1>{current.title}</h1>
              <p>{current.desc}</p>
            </div>
          </div>
          {tab === "panel" && <PanelTab data={data} />}
          {tab === "gastos" && <GastosTab data={data} setData={setData} update={update} />}
          {tab === "market" && <MarketTab data={data} update={update} />}
          {tab === "wish" && <WishlistTab data={data} update={update} />}
        </div>
      </main>

      <nav className="fx-dock">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <t.icon size={19} />
            {t.id === "wish" ? "Compras" : t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
