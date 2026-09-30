"use client";
import { useState, type FormEvent } from "react";
import { traducirError } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { ISpin, IWallet } from "./icons";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="auth">
      <form className="auth-card fade" onSubmit={submit}>
        <span className="logo lg"><IWallet size={22} /></span>
        <h1>Inicia sesión</h1>
        <p>Entra a Mis Gastos para ver tus cuentas del mes.</p>
        <label>
          <span>Correo</span>
          <input className="field" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
        </label>
        <label>
          <span>Contraseña</span>
          <input className="field" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>
        {error && <div className="auth-err">{error}</div>}
        <button className="btn primary block" type="submit" disabled={loading}>
          {loading && <ISpin size={15} />}
          {loading ? "Entrando…" : "Continuar"}
        </button>
        <div className="auth-note">¿No tienes cuenta? Pídesela al administrador.</div>
      </form>
    </div>
  );
}
