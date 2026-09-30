import { IWallet } from "./icons";

export default function ConfigScreen() {
  return (
    <div className="auth">
      <div className="auth-card">
        <span className="logo lg"><IWallet size={22} /></span>
        <h1>Falta un paso de configuración</h1>
        <p>
          Define <b>NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> en las variables de
          entorno (en <b>.env.local</b> o en Vercel) y vuelve a desplegar.
        </p>
      </div>
    </div>
  );
}
