import { catColor } from "@/lib/data";
import { clp } from "@/lib/format";
import type { Category, CategoryId } from "@/lib/types";

/** Barra de distribución por categoría + leyenda con porcentajes. */
export default function Distribution({ categories, byCategory }: { categories: Category[]; byCategory: Record<CategoryId, number> }) {
  const used = categories.filter((c) => (byCategory[c.id] || 0) > 0);
  const total = used.reduce((s, c) => s + byCategory[c.id], 0);
  if (!total) return <div className="empty">Agrega montos para ver la distribución.</div>;
  return (
    <>
      <div className="dist" role="img" aria-label="Distribución de gastos por categoría">
        {used.map((c) => (
          <span key={c.id} style={{ width: (byCategory[c.id] / total) * 100 + "%", background: catColor(c.color) }}
            title={`${c.label}: ${clp(byCategory[c.id])}`} />
        ))}
      </div>
      <div className="legend">
        {used.map((c) => (
          <div key={c.id}>
            <i className="dot" style={{ background: catColor(c.color) }} />
            <span className="n">{c.label}</span>
            <span className="v">{Math.round((byCategory[c.id] / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </>
  );
}
