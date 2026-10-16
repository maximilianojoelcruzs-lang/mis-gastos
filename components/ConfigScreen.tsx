import Logo from "./Logo";

export default function ConfigScreen() {
  return (
    <div className="auth">
      <div className="auth-card">
        <Logo size={48} className="lg" />
        <h1>Falta un paso de configuración</h1>
        <p>
          La app no tiene base de datos conectada. En Vercel, conecta Supabase desde <b>Storage</b> (eso define
          <b> NEXT_PUBLIC_SUPABASE_URL</b> y la clave pública) y vuelve a desplegar. En local, usa <b>.env.local</b>.
        </p>
      </div>
    </div>
  );
}
