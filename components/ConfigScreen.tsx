import { IWallet } from "./icons";

export default function ConfigScreen() {
  return (
    <div className="mg-authwrap">
      <div className="mg-authcard">
        <span className="mg-logo big"><IWallet size={26} /></span>
        <h1>Falta un paso de configuración</h1>
        <p className="mg-authsub">
          La app está lista, pero todavía no está conectada a tu base de datos. Define{" "}
          <b>NEXT_PUBLIC_SUPABASE_URL</b> y <b>NEXT_PUBLIC_SUPABASE_ANON_KEY</b> en las variables de
          entorno (en <b>.env.local</b> o en Vercel) y vuelve a desplegar.
        </p>
      </div>
    </div>
  );
}
