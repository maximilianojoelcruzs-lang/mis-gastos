"use client";
import { useEffect, useRef, useState } from "react";
import { summarizeMonth } from "@/lib/data";
import { clp } from "@/lib/format";
import type { AppData } from "@/lib/types";
import { ICart, IGift, IPig, ITable } from "./icons";

// Paleta validada (fondo oscuro): cian = gastos, violeta = ingresos.
const C_SPENT = "#0FA0BC";
const C_INCOME = "#8B5CFF";

const compact = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e6) return "$" + (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, "").replace(".", ",") + "M";
  if (a >= 1e3) return "$" + Math.round(n / 1e3) + "K";
  return "$" + Math.round(n);
};

function niceMax(v: number) {
  if (v <= 0) return 100000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

// Barra con extremo de datos redondeado (4px) y base recta.
function barPath(x: number, y: number, w: number, h: number, horizontal = false) {
  const r = Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h);
  if (h <= 0 || w <= 0) return "";
  if (horizontal)
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Tip = { x: number; y: number; title: string; rows: { color?: string; label: string; value: string }[] };

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="fx-tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      {tip.rows.map((r) => (
        <div key={r.label} className="row">
          {r.color && <i style={{ background: r.color }} />}
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

function MonthsChart({ months }: { months: ReturnType<typeof summarizeMonth>[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, top = 14, bottom = 28, left = 52, right = 8;
  const plotW = Math.max(0, width - left - right);
  const plotH = H - top - bottom;
  const max = niceMax(Math.max(...months.map((m) => Math.max(m.income, m.spent)), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = months.length ? plotW / months.length : 0;
  const barW = Math.max(4, Math.min(24, (band - 18) / 2));
  const y = (v: number) => top + plotH - (v / max) * plotH;

  const tip: Tip | null =
    hover === null
      ? null
      : {
          x: Math.min(Math.max(left + band * hover + band / 2, 80), Math.max(80, width - 80)),
          y: Math.max(y(Math.max(months[hover].income, months[hover].spent)) - 10, 96),
          title: months[hover].label || "Sin nombre",
          rows: [
            { color: C_INCOME, label: "Ingreso", value: clp(months[hover].income) },
            { color: C_SPENT, label: "Gastos", value: clp(months[hover].spent) },
            { label: months[hover].balance < 0 ? "Déficit" : "Ahorro", value: clp(Math.abs(months[hover].balance)) },
          ],
        };

  return (
    <div ref={ref} className="fx-chart" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Ingresos y gastos por mes">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} className="fx-grid-line" />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fx-axis">{compact(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = left + band * i + band / 2;
            const hi = hover === i;
            return (
              <g key={m.id} opacity={hover === null || hi ? 1 : 0.45}>
                {hi && <rect x={left + band * i + 2} y={top} width={band - 4} height={plotH} rx={8} className="fx-band" />}
                <path d={barPath(cx - barW - 1, y(m.income), barW, y(0) - y(m.income))} fill={C_INCOME} />
                <path d={barPath(cx + 1, y(m.spent), barW, y(0) - y(m.spent))} fill={C_SPENT} />
                <text x={cx} y={H - 8} textAnchor="middle" className="fx-axis">
                  {(m.label || "—").length > 9 ? (m.label || "—").slice(0, 8) + "…" : m.label || "—"}
                </text>
                <rect x={left + band * i} y={top} width={band} height={plotH + bottom} fill="transparent"
                  onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

function TopExpenses({ items, income }: { items: { id: string; name: string; amount: number }[]; income: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const rowH = 34, barH = 14, labelW = Math.min(120, width * 0.34), valueW = 78;
  const H = items.length * rowH;
  const max = Math.max(...items.map((i) => i.amount), 1);
  const plotW = Math.max(0, width - labelW - valueW);

  const tip: Tip | null =
    hover === null
      ? null
      : {
          x: Math.min(Math.max(labelW + 80, 80), Math.max(80, width - 80)),
          y: hover * rowH + 2,
          title: items[hover].name || "Sin nombre",
          rows: [
            { color: C_SPENT, label: "Monto", value: clp(items[hover].amount) },
            ...(income > 0
              ? [{ label: "Del ingreso", value: Math.round((items[hover].amount / income) * 100) + "%" }]
              : []),
          ],
        };

  return (
    <div ref={ref} className="fx-chart" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Gastos más grandes del mes">
          {items.map((it, i) => {
            const w = (it.amount / max) * plotW;
            const yy = i * rowH + (rowH - barH) / 2;
            return (
              <g key={it.id} opacity={hover === null || hover === i ? 1 : 0.45}>
                <text x={0} y={yy + barH / 2} dy="0.32em" className="fx-axis strong">
                  {(it.name || "Sin nombre").length > 14 ? it.name.slice(0, 13) + "…" : it.name || "Sin nombre"}
                </text>
                <path d={barPath(labelW, yy, w, barH, true)} fill={C_SPENT} />
                <text x={labelW + w + 8} y={yy + barH / 2} dy="0.32em" className="fx-axis value">{compact(it.amount)}</text>
                <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

export default function PanelTab({ data }: { data: AppData }) {
  const [table, setTable] = useState(false);
  const months = data.months.map(summarizeMonth);
  const totals = months.reduce(
    (t, m) => ({ income: t.income + m.income, spent: t.spent + m.spent, balance: t.balance + m.balance }),
    { income: 0, spent: 0, balance: 0 }
  );
  const rate = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : 0;
  const active = data.months.find((m) => m.id === data.activeId) || data.months[0];
  const cur = summarizeMonth(active);
  const paidPct = cur.spent > 0 ? (cur.paid / cur.spent) * 100 : 0;
  const top = [...active.items].filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 6);

  const market = data.market.items;
  const marketTotal = market.reduce((s, i) => s + i.price * (i.qty || 1), 0);
  const wish = data.wishlist.items.filter((i) => !i.done);
  const wishTotal = wish.reduce((s, i) => s + i.price, 0);

  return (
    <div>
      <section className="mg-card fx-kpis">
        <div className="fx-kpi hero">
          <span>{totals.balance < 0 ? "Déficit acumulado" : "Ahorro acumulado"}</span>
          <strong className={totals.balance < 0 ? "neg" : "pos"}>{clp(Math.abs(totals.balance))}</strong>
          <small>{months.length} {months.length === 1 ? "mes registrado" : "meses registrados"}</small>
        </div>
        <div className="fx-kpi">
          <span><i style={{ background: C_INCOME }} /> Ingresos</span>
          <strong>{compact(totals.income)}</strong>
        </div>
        <div className="fx-kpi">
          <span><i style={{ background: C_SPENT }} /> Gastos</span>
          <strong>{compact(totals.spent)}</strong>
        </div>
        <div className="fx-kpi">
          <span><IPig size={12} /> Tasa de ahorro</span>
          <strong>{rate}%</strong>
        </div>
      </section>

      <section className="mg-card">
        <div className="fx-charthead">
          <div>
            <h2>Ingresos vs gastos por mes</h2>
            <div className="fx-legend">
              <span><i style={{ background: C_INCOME }} /> Ingreso</span>
              <span><i style={{ background: C_SPENT }} /> Gastos</span>
            </div>
          </div>
          <button className="mg-shopbtn" onClick={() => setTable((t) => !t)}>
            <ITable size={13} /> {table ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        {table ? (
          <div className="fx-tablewrap">
            <table className="fx-table">
              <thead>
                <tr><th>Mes</th><th>Ingreso</th><th>Gastos</th><th>Pagado</th><th>Ahorro</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label || "Sin nombre"}</td>
                    <td>{clp(m.income)}</td>
                    <td>{clp(m.spent)}</td>
                    <td>{clp(m.paid)}</td>
                    <td className={m.balance < 0 ? "neg" : ""}>{m.balance < 0 ? "−" : ""}{clp(Math.abs(m.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <MonthsChart months={months} />
        )}
      </section>

      <div className="fx-split">
        <section className="mg-card">
          <div className="fx-charthead">
            <div>
              <h2>Gastos más grandes</h2>
              <p className="fx-sub">{active.label || "Mes activo"} · top {top.length}</p>
            </div>
          </div>
          {top.length ? <TopExpenses items={top} income={active.income} /> : <div className="mg-empty">Sin gastos este mes.</div>}
        </section>

        <section className="mg-card">
          <div className="fx-charthead">
            <div>
              <h2>Estado de pagos</h2>
              <p className="fx-sub">{active.label || "Mes activo"}</p>
            </div>
          </div>
          <div className="fx-meter">
            <strong>{Math.round(paidPct)}%</strong>
            <span>pagado</span>
          </div>
          <div className="mg-bartrack"><div className="mg-barfill" style={{ width: paidPct + "%" }} /></div>
          <div className="fx-meterrows">
            <div><span>Pagado</span><b>{clp(cur.paid)}</b></div>
            <div><span>Por pagar</span><b>{clp(cur.pending)}</b></div>
          </div>
          <div className="fx-minis">
            <div className="fx-mini">
              <ICart size={15} />
              <div><span>Supermercado</span><b>{clp(marketTotal)}</b></div>
            </div>
            <div className="fx-mini">
              <IGift size={15} />
              <div><span>Próximas compras</span><b>{clp(wishTotal)}</b></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
