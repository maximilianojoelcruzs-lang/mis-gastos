"use client";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase/client";
import ConfigScreen from "./ConfigScreen";
import Login from "./Login";
import NewPassword from "./NewPassword";
import Splash from "./Splash";
import Tracker from "./Tracker";

export default function App() {
  const sb = getSupabase();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (!sb) return <ConfigScreen />;
  if (session === undefined) return <Splash text="Cargando…" />;
  if (session && recovery) return <NewPassword onDone={() => setRecovery(false)} />;
  return session ? <Tracker session={session} /> : <Login />;
}
