export const clp = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CL");

export const uid = () => Math.random().toString(36).slice(2, 9);

export function openUrl(url: string) {
  if (!url) return;
  let u = String(url).trim();
  if (!u) return;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  window.open(u, "_blank", "noopener,noreferrer");
}

export function traducirError(msg?: string) {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("credentials")) return "Correo o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Esta cuenta aún no está confirmada.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera un momento.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Sin conexión. Revisa tu internet.";
  return msg || "Ocurrió un error.";
}
