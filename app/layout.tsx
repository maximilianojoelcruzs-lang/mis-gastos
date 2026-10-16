import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Mis Gastos",
  description: "Controla tus gastos del mes, el día a día, el supermercado y tus próximas compras.",
  appleWebApp: { capable: true, title: "Mis Gastos", statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2c9c6e" };

// Aplica el tema guardado antes de pintar para evitar el parpadeo oscuro/claro.
const themeScript = `try{var t=localStorage.getItem('mg-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
