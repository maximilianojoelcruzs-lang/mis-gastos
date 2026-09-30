// Modo privado: cuando está activo, todos los montos se muestran ocultos.
// Se usa una variable de módulo (la fija el Tracker antes de renderizar).
let hidden = false;
export const setPrivacy = (v: boolean) => {
  hidden = v;
};

export const isPrivate = () => hidden;

export const clp = (n: number) => (hidden ? "$•••••" : "$" + Math.round(n || 0).toLocaleString("es-CL"));

export const compact = (n: number) => {
  if (hidden) return "$•••";
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "").replace(".", ",") + "M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  return "$" + Math.round(n);
};

export const uid = () => Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 5);

export function openUrl(url: string) {
  if (!url) return;
  let u = String(url).trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  window.open(u, "_blank", "noopener,noreferrer");
}

/** "2026-09-30" → "Hoy" / "Ayer" / "mié 30 sep" */
export function dayLabel(iso: string, today: string) {
  if (iso === today) return "Hoy";
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
  if (diff === 1) return "Ayer";
  const date = new Date(y, m - 1, d);
  const wd = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][date.getDay()];
  const mo = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][m - 1];
  return `${wd} ${d} ${mo}`;
}

export function traducirError(msg?: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Esta cuenta aún no está confirmada. Revisa tu correo.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ya existe una cuenta con ese correo.";
  if (m.includes("at least 6") || m.includes("weak password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("signups are disabled"))
    return "El registro de cuentas está deshabilitado.";
  if (m.includes("different from the old") || m.includes("should be different")) return "La nueva contraseña debe ser distinta a la anterior.";
  if (m.includes("invalid format") || m.includes("email address") && m.includes("invalid")) return "El correo no es válido.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Demasiados intentos. Espera un momento.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Sin conexión. Revisa tu internet.";
  return msg || "Ocurrió un error.";
}
