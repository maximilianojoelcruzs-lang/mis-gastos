"use client";
import { useState } from "react";
import { scopeTitle, type ExportFormat, type ExportScope } from "@/lib/export";
import type { AppData } from "@/lib/types";
import { IDownload, ISpin } from "./icons";
import type { Notify } from "./Tracker";

type Props = { data: AppData; onDone?: () => void; notify: Notify };

export default function ExportForm({ data, onDone, notify }: Props) {
  const [scope, setScope] = useState<ExportScope>("month");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const { exportData } = await import("@/lib/export");
      const file = await exportData(data, scope, format);
      notify(`Descargado: ${file}`);
      onDone?.();
    } catch (e) {
      setError("No se pudo generar el archivo. " + ((e as Error).message || ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="f" style={{ marginBottom: 14 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>¿Qué incluir?</span>
        <div className="seg" role="group" aria-label="Alcance">
          <button className={scope === "month" ? "on" : ""} onClick={() => setScope("month")}>Mes activo</button>
          <button className={scope === "year" ? "on" : ""} onClick={() => setScope("year")}>Año</button>
          <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")}>Todo</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{scopeTitle(data, scope)}</div>
      </div>
      <div className="f" style={{ marginBottom: 14 }}>
        <span style={{ display: "block", fontSize: 12.5, color: "var(--muted)", marginBottom: 6, fontWeight: 500 }}>Formato</span>
        <div className="seg" role="group" aria-label="Formato">
          <button className={format === "xlsx" ? "on" : ""} onClick={() => setFormat("xlsx")}>Excel (.xlsx)</button>
          <button className={format === "pdf" ? "on" : ""} onClick={() => setFormat("pdf")}>PDF</button>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {format === "xlsx"
            ? "Hojas: Resumen, Cuentas, Diarios y Por categoría, con todos los detalles."
            : "Un informe listo para leer o imprimir: resumen, categorías y detalle del mes."}
        </div>
      </div>
      {error && <div className="auth-err" role="alert">{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {onDone && <button className="btn" onClick={onDone} disabled={busy}>Cancelar</button>}
        <button className="btn primary" onClick={run} disabled={busy}>
          {busy ? <ISpin size={14} /> : <IDownload size={14} />} {busy ? "Generando…" : "Descargar"}
        </button>
      </div>
    </div>
  );
}
