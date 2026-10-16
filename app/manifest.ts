import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mis Gastos",
    short_name: "Mis Gastos",
    description: "Controla tus gastos del mes, el día a día, el supermercado y tus próximas compras.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0B",
    theme_color: "#2c9c6e",
    icons: [
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
