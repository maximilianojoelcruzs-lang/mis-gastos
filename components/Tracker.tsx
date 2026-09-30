"use client";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { api } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";
import type { AppData } from "@/lib/types";
import GastosTab from "./GastosTab";
import MarketTab from "./MarketTab";
import Splash from "./Splash";
import WishlistTab from "./WishlistTab";
import { ICart, ICheck, IGift, ILogout, ISpin, IWallet, IX } from "./icons";

export type Update = (mutate: (draft: AppData) => void) => void;
export type SetData = (next: AppData | ((prev: AppData) => AppData)) => void;

type Tab = "gastos" | "market" | "wish";
type SaveState = "" | "saving" | "saved" | "error";

export default function Tracker({ session }: { session: Session }) {
  const userId = session.user.id;
  const [data, setDataState] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [save, setSave] = useState<SaveState>("");
  const [tab, setTab] = useState<Tab>("gastos");
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

  return (
    <div className="mg-root">
      <header className="mg-header">
        <div className="mg-brand">
          <span className="mg-logo"><IWallet size={20} /></span>
          <div>
            <h1>Mis Gastos</h1>
            <p>{session.user.email}</p>
          </div>
        </div>
        <div className="mg-headright">
          {save === "saving" ? (
            <span className="mg-save on muted"><ISpin size={13} /> Guardando…</span>
          ) : save === "saved" ? (
            <span className="mg-save on"><ICheck size={13} /> Guardado</span>
          ) : save === "error" ? (
            <span className="mg-save on err"><IX size={13} /> Error al guardar</span>
          ) : (
            <span className="mg-save" />
          )}
          <button className="mg-logoutbtn" onClick={() => getSupabase()!.auth.signOut()} title="Cerrar sesión">
            <ILogout size={16} />
          </button>
        </div>
      </header>

      <div className="mg-nav">
        <button className={tab === "gastos" ? "active" : ""} onClick={() => setTab("gastos")}>
          <IWallet size={16} /> Gastos
        </button>
        <button className={tab === "market" ? "active" : ""} onClick={() => setTab("market")}>
          <ICart size={16} /> Supermercado
        </button>
        <button className={tab === "wish" ? "active" : ""} onClick={() => setTab("wish")}>
          <IGift size={16} /> Próximas compras
        </button>
      </div>

      {tab === "gastos" && <GastosTab data={data} setData={setData} update={update} />}
      {tab === "market" && <MarketTab data={data} update={update} />}
      {tab === "wish" && <WishlistTab data={data} update={update} />}
    </div>
  );
}
