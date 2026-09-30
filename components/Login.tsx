"use client";
import { useState, type KeyboardEvent } from "react";
import { traducirError } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { ILock, ISpin, IWallet } from "./icons";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Escribe tu correo y contraseña.");
      return;
    }
    setError("");
    setLoading(true);
    const { error } = await getSupabase()!.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(traducirError(error.message));
      setLoading(false);
    }
  };
  const onKey = (e: KeyboardEvent) => e.key === "Enter" && submit();

  return (
    <div className="mg-authwrap">
      <div className="mg-authcard">
        <span className="mg-logo big"><IWallet size={26} /></span>
        <h1>Mis Gastos</h1>
        <p className="mg-authsub">Inicia sesión para ver tus gastos</p>
        <label className="mg-field">
          <span>Correo</span>
          <input type="email" autoComplete="username" value={email} onKeyDown={onKey}
            onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
        </label>
        <label className="mg-field">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={password} onKeyDown={onKey}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {error && <div className="mg-autherr">{error}</div>}
        <button className="mg-authbtn" onClick={submit} disabled={loading}>
          {loading ? <ISpin size={16} /> : <ILock size={16} />}
          {loading ? "Entrando…" : "Iniciar sesión"}
        </button>
        <p className="mg-authnote">¿No tienes cuenta? Pídesela al administrador.</p>
      </div>
    </div>
  );
}
