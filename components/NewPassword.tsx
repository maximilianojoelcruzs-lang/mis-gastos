"use client";
import { useState, type FormEvent } from "react";
import { traducirError } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { ISpin, IWallet } from "./icons";

/** Se muestra al abrir el enlace de "olvidé mi contraseña". */
export default function NewPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if (password !== password2) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    const { error } = await getSupabase()!.auth.updateUser({ password });
    setLoading(false);
    if (error) setError(traducirError(error.message));
    else onDone();
  };

  return (
    <div className="auth">
      <form className="auth-card fade" onSubmit={submit}>
        <span className="logo lg"><IWallet size={22} /></span>
        <h1>Elige una contraseña nueva</h1>
        <p>Úsala la próxima vez que inicies sesión.</p>
        <label>
          <span>Contraseña nueva</span>
          <input className="field" type="password" autoComplete="new-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
        </label>
        <label>
          <span>Repítela</span>
          <input className="field" type="password" autoComplete="new-password" value={password2}
            onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" />
        </label>
        {error && <div className="auth-err" role="alert">{error}</div>}
        <button className="btn primary block" type="submit" disabled={loading}>
          {loading && <ISpin size={15} />} Guardar contraseña
        </button>
      </form>
    </div>
  );
}
