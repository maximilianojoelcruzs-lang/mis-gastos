/* eslint-disable @next/next/no-img-element */

/** Logo de Mis Gastos: ícono (gatos sobre fondo verde) o solo los gatos. */
export default function Logo({ size = 32, variant = "icon", className = "" }: { size?: number; variant?: "icon" | "gatos"; className?: string }) {
  if (variant === "gatos")
    return <img src="/logo-gatos.svg" alt="Mis Gastos" width={size} height={Math.round((size * 300) / 512)} className={"logo-gatos " + className} />;
  return <img src="/logo.svg" alt="" aria-hidden="true" width={size} height={size} className={"logo-img " + className} />;
}
