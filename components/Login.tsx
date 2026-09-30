"use client";
import { useState, type FormEvent } from "react";
import { traducirError } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { ISpin, IWallet } from "./icons";

type Mode = "login" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Inicia sesión", sub: "Entra a Mis Gastos para ver tus cuentas del mes.", cta: "Continuar" },
  signup: { title: "Crea tu cuenta", sub: "Es gratis. Tus datos quedan guardados solo para ti.", cta: "Crear cuenta" },
  forgot: { title: "Recupera tu contraseña", sub: "Te enviaremos un enlace a tu correo para elegir una nueva.", cta: "Enviar enlace" },
};

export default function Login() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const go = (m: Mode) => {
    setMode(m);
    setError("");
    setInfo("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase()!;
    setError("");
    setInfo("");
    if (!email.trim()) return setError("Escribe tu correo.");
    if (mode !== "forgot" && !password) return setError("Escribe tu contraseña.");
    if (mode === "signup") {
      if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
      if (password !== password2) return setError("Las contraseñas no coinciden.");
    }
    setLoading(true);
    if (mode === "login") {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(traducirError(error.message));
    } else if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
      if (error) setError(traducirError(error.message));
      // Si el proyecto exige confirmar el correo, no hay sesión todavía.
      else if (!data.session) setInfo("Listo. Te enviamos un correo para confirmar tu cuenta; ábrelo y luego inicia sesión.");
    } else {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) setError(traducirError(error.message));
      else setInfo("Si el correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva.");
    }
    setLoading(false);
  };

  const c = COPY[mode];
  return (
    <div className="auth">
      <form className="auth-card fade" onSubmit={submit} noValidate>
        <span className="logo lg"><IWallet size={22} /></span>
        <h1>{c.title}</h1>
        <p>{c.sub}</p>
        <label>
          <span>Correo</span>
          <input className="field" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
        </label>
        {mode !== "forgot" && (
          <label>
            <span>Contraseña</span>
            <input className="field" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>
        )}
        {mode === "signup" && (
          <label>
            <span>Repite la contraseña</span>
            <input className="field" type="password" autoComplete="new-password" value={password2}
              onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" />
          </label>
        )}
        {error && <div className="auth-err" role="alert">{error}</div>}
        {info && <div className="auth-ok" role="status">{info}</div>}
        <button className="btn primary block" type="submit" disabled={loading}>
          {loading && <ISpin size={15} />}
          {loading ? "Un momento…" : c.cta}
        </button>
        <div className="auth-links">
          {mode === "login" ? (
            <>
              <button type="button" className="linkbtn" onClick={() => go("forgot")}>¿Olvidaste tu contraseña?</button>
              <button type="button" className="linkbtn" onClick={() => go("signup")}>Crear cuenta</button>
            </>
          ) : (
            <button type="button" className="linkbtn" onClick={() => go("login")}>← Volver a iniciar sesión</button>
          )}
        </div>
      </form>
    </div>
  );
}
