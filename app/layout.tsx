import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const tech = Orbitron({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-tech" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Mis Gastos",
  description: "Controla tus gastos del mes, la lista del supermercado y tus próximas compras.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05060B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${tech.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <div className="fx-bg" aria-hidden="true">
          <div className="fx-grid" />
          <div className="fx-orb a" />
          <div className="fx-orb b" />
          <div className="fx-orb c" />
        </div>
        {children}
      </body>
    </html>
  );
}
