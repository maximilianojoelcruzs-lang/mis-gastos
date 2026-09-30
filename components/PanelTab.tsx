"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  catColor, catOf, currentPeriod, summarizeAll, summarizeYear, todayISO, yearsOf,
} from "@/lib/data";
import { clp, compact } from "@/lib/format";
import type { AppData, Category, MonthSummary } from "@/lib/types";
import { IArrowDown, IArrowUp, IDownload, ITable, ITrend } from "./icons";

function niceMax(v: number) {
  if (v <= 0) return 100000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Rectángulo con extremo redondeado (4px) y base recta. */
function barPath(x: number, y: number, w: number, h: number, horizontal = false, round = true) {
  if (h <= 0 || w <= 0) return "";
  const r = round ? Math.min(4, horizontal ? h / 2 : w / 2, horizontal ? w : h) : 0;
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

type Tip = { x: number; y: number; title: string; rows: { color?: string; label: string; value: string; total?: boolean }[] };

function Tooltip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  return (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      <b>{tip.title}</b>
      {tip.rows.map((r) => (
        <div key={r.label} className={"r " + (r.total ? "total" : "")}>
          {r.color && <i className="dot" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

/** Columnas apiladas por categoría + marca del ingreso de cada mes. */
function MonthsChart({ months, categories }: { months: MonthSummary[]; categories: Category[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 240, top = 12, bottom = 26, left = 50, right = 4, GAP = 2;
  const plotW = Math.max(0, width - left - right);
  const plotH = H - top - bottom;
  const max = niceMax(Math.max(...months.map((m) => Math.max(m.income, m.spent)), 0));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const band = months.length ? plotW / months.length : 0;
  const barW = Math.max(6, Math.min(24, band * 0.45));
  const y = (v: number) => top + plotH - (v / max) * plotH;

  const tip: Tip | null = (() => {
    if (hover === null) return null;
    const m = months[hover];
    const cats = categories.filter((c) => (m.byCategory[c.id] || 0) > 0).reverse();
    return {
      x: Math.min(Math.max(left + band * hover + band / 2, 95), Math.max(95, width - 95)),
      y: Math.max(Math.min(y(Math.max(m.income, m.spent)), y(0)) - 10, 60),
      title: m.label || "Sin nombre",
      rows: [
        ...cats.map((c) => ({ color: catColor(c.color), label: c.label, value: clp(m.byCategory[c.id]) })),
        { label: "Total gastos", value: clp(m.spent), total: true },
        { label: "Ingreso", value: clp(m.income) },
      ],
    };
  })();

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Gastos por categoría e ingreso de cada mes">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={width - right} y1={y(t)} y2={y(t)} className="gridline" />
              <text x={left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="axis">{compact(t)}</text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = left + band * i + band / 2;
            const cats = categories.filter((c) => (m.byCategory[c.id] || 0) > 0);
            let acc = 0;
            const label = m.label || "—";
            return (
              <g key={m.id} opacity={hover === null || hover === i ? 1 : 0.4}>
                {hover === i && <rect x={left + band * i + 2} y={top} width={band - 4} height={plotH} rx={6} className="hoverband" />}
                {cats.map((c, k) => {
                  const v = m.byCategory[c.id];
                  const y0 = y(acc), y1 = y(acc + v);
                  acc += v;
                  const h = y0 - y1 - (k < cats.length - 1 ? GAP : 0);
                  return <path key={c.id} d={barPath(cx - barW / 2, y1, barW, Math.max(h, 1), false, k === cats.length - 1)}
                    style={{ fill: catColor(c.color) }} />;
                })}
                {m.income > 0 && (
                  <line x1={cx - barW / 2 - 6} x2={cx + barW / 2 + 6} y1={y(m.income)} y2={y(m.income)}
                    style={{ stroke: "var(--ink)" }} strokeWidth={2} strokeLinecap="round" />
                )}
                <text x={cx} y={H - 8} textAnchor="middle" className="axis">
                  {label.length > 10 ? label.slice(0, 9) + "…" : label}
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

function Bars({ items, label }: { items: { id: string; name: string; amount: number; color: string }[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const rowH = 32, barH = 12, labelW = Math.min(120, width * 0.36), valueW = 70;
  const max = Math.max(...items.map((i) => i.amount), 1);
  const plotW = Math.max(0, width - labelW - valueW);
  return (
    <div ref={ref} className="chart">
      {width > 0 && (
        <svg width={width} height={items.length * rowH} role="img" aria-label={label}>
          {items.map((it, i) => {
            const w = (it.amount / max) * plotW;
            const yy = i * rowH + (rowH - barH) / 2;
            const name = it.name || "Sin nombre";
            return (
              <g key={it.id}>
                <title>{`${name}: ${clp(it.amount)}`}</title>
                <text x={0} y={yy + barH / 2} dy="0.32em" className="axis ink">{name.length > 14 ? name.slice(0, 13) + "…" : name}</text>
                <path d={barPath(labelW, yy, w, barH, true)} style={{ fill: it.color }} />
                <text x={labelW + w + 8} y={yy + barH / 2} dy="0.32em" className="axis">{compact(it.amount)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

type Range = "3" | "6" | "year" | "all";

export default function PanelTab({ data, onExport }: { data: AppData; onExport: () => void }) {
  const [table, setTable] = useState(false);
  const [range, setRange] = useState<Range>("6");
  const years = yearsOf(data);
  const [yearSel, setYearSel] = useState<string | null>(null);

  const all = useMemo(() => summarizeAll(data), [data]);
  const year = currentPeriod().slice(0, 4);
  const months =
    range === "all" ? all
      : range === "year" ? all.filter((m) => m.period.startsWith(year))
        : all.slice(-Number(range));

  const totals = months.reduce(
    (t, m) => ({ income: t.income + m.income, spent: t.spent + m.spent, balance: t.balance + m.balance }),
    { income: 0, spent: 0, balance: 0 }
  );
  const rate = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : 0;
  const usedCats = data.categories.filter((c) => months.some((m) => (m.byCategory[c.id] || 0) > 0));

  // Mes activo vs anterior
  const idx = Math.max(0, data.months.findIndex((m) => m.id === data.activeId));
  const active = data.months[idx];
  const cur = all[idx];
  const prev = idx > 0 ? all[idx - 1] : null;
  const pctChange = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const deltas = prev
    ? data.categories
        .map((c) => {
          const a = cur.byCategory[c.id] || 0, b = prev.byCategory[c.id] || 0;
          return { c, diff: a - b, pct: pctChange(a, b) };
        })
        .filter((d) => d.diff !== 0)
        .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
        .slice(0, 4)
    : [];
  const totalPct = prev ? pctChange(cur.spent, prev.spent) : null;

  // Proyección de cierre
  const history = all.slice(Math.max(0, idx - 3), idx);
  const avgPrev = history.length ? history.reduce((s, m) => s + m.spent, 0) / history.length : 0;
  const projectedSpent = Math.max(cur.spent, avgPrev);
  const projected = cur.income - projectedSpent;
  const isCurrent = active.period === currentPeriod();
  let perDay: { days: number; amount: number } | null = null;
  if (isCurrent) {
    const [y, m, d] = todayISO().split("-").map(Number);
    const days = new Date(y, m, 0).getDate() - d + 1;
    perDay = { days, amount: Math.max(0, cur.balance) / days };
  }

  const top = [...active.items]
    .filter((i) => i.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)
    .map((i) => ({ id: i.id, name: i.name, amount: i.amount, color: catColor(catOf(data.categories, i.category).color) }));

  // Resumen anual
  const ySel = yearSel && years.includes(yearSel) ? yearSel : years.includes(year) ? year : years[years.length - 1];
  const ys = ySel ? summarizeYear(data, ySel) : null;
  const yearCats = ys
    ? data.categories
        .map((c) => ({ id: c.id, name: c.label, amount: ys.byCategory[c.id] || 0, color: catColor(c.color) }))
        .filter((c) => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
    : [];
  const topYearCat = yearCats[0];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="chips">
          {([["3", "3 meses"], ["6", "6 meses"], ["year", "Este año"], ["all", "Todo"]] as [Range, string][]).map(([id, l]) => (
            <button key={id} className={"chip " + (range === id ? "on" : "")} onClick={() => setRange(id)}>{l}</button>
          ))}
        </div>
        <button className="btn sm" onClick={onExport}><IDownload size={13} /> Exportar</button>
      </div>

      <section className="card">
        <div className="hero">
          <div>
            <div className="l">{totals.balance < 0 ? "Déficit en el período" : "Ahorro en el período"}</div>
            <div className={"v " + (totals.balance < 0 ? "neg" : "")}>{clp(Math.abs(totals.balance))}</div>
          </div>
          <span className="muted">{months.length} {months.length === 1 ? "mes" : "meses"}</span>
        </div>
        <div className="stats">
          <div className="stat"><span className="l">Ingresos</span><span className="v">{compact(totals.income)}</span></div>
          <div className="stat"><span className="l">Gastos</span><span className="v">{compact(totals.spent)}</span></div>
          <div className="stat"><span className="l">Tasa de ahorro</span><span className="v">{rate}%</span></div>
          <div className="stat"><span className="l">Gasto promedio</span><span className="v">{compact(months.length ? totals.spent / months.length : 0)}</span></div>
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Gastos por mes</h2>
            <div className="sub">Cuentas + gastos diarios, por categoría · la línea es el ingreso del mes</div>
          </div>
          <button className="btn sm" onClick={() => setTable((t) => !t)}>
            <ITable size={13} /> {table ? "Ver gráfico" : "Ver tabla"}
          </button>
        </div>
        {months.length === 0 ? (
          <div className="empty">No hay meses en este rango.</div>
        ) : table ? (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Mes</th><th>Ingreso</th><th>Cuentas</th><th>Diarios</th><th>Ahorro</th></tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.id}>
                    <td>{m.label || "Sin nombre"}</td>
                    <td>{clp(m.income)}</td>
                    <td>{clp(m.bills)}</td>
                    <td>{clp(m.daily)}</td>
                    <td className={m.balance < 0 ? "neg" : ""}>{m.balance < 0 ? "−" : ""}{clp(Math.abs(m.balance))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            <MonthsChart months={months} categories={data.categories} />
            <div className="legend" style={{ marginTop: 14 }}>
              {usedCats.map((c) => (
                <div key={c.id}><i className="dot" style={{ background: catColor(c.color) }} /><span className="n">{c.label}</span></div>
              ))}
              <div><i style={{ width: 14, height: 2, background: "var(--ink)", borderRadius: 2, flex: "none" }} /><span className="n">Ingreso</span></div>
            </div>
          </>
        )}
      </section>

      <div className="grid2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Comparado con el mes anterior</h2>
              <div className="sub">{active.label}{prev ? ` vs ${prev.label}` : ""}</div>
            </div>
          </div>
          {!prev ? (
            <div className="muted" style={{ fontSize: 13 }}>Necesitas al menos dos meses para comparar.</div>
          ) : (
            <>
              <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5 }}>
                {totalPct === null || totalPct === 0
                  ? "Gastaste lo mismo que el mes anterior."
                  : <>Gastaste <b>{Math.abs(totalPct)}% {totalPct > 0 ? "más" : "menos"}</b> que en {prev.label} ({clp(Math.abs(cur.spent - prev.spent))}).</>}
              </p>
              {deltas.map(({ c, diff, pct }) => (
                <div className="delta" key={c.id}>
                  <span className="n"><i className="dot" style={{ background: catColor(c.color) }} /> {c.label}</span>
                  <span className={"v " + (diff > 0 ? "up" : "down")}>
                    {diff > 0 ? <IArrowUp size={12} /> : <IArrowDown size={12} />}
                    {pct === null ? "Nuevo este mes" : `${Math.abs(pct)}% ${diff > 0 ? "más" : "menos"}`}
                  </span>
                </div>
              ))}
            </>
          )}
        </section>

        <section className="card">
          <div className="card-h">
            <div>
              <h2>Proyección de cierre</h2>
              <div className="sub">{active.label}</div>
            </div>
            <ITrend size={16} />
          </div>
          <div className="num" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-.02em", color: projected < 0 ? "var(--bad)" : undefined }}>
            {projected < 0 ? "−" : ""}{clp(Math.abs(projected))}
          </div>
          <p className="muted" style={{ margin: "6px 0 14px", fontSize: 12.5, lineHeight: 1.5 }}>
            {history.length && avgPrev > cur.spent
              ? `Tus gastos registrados son ${clp(cur.spent)}, pero en los últimos ${history.length} ${history.length === 1 ? "mes" : "meses"} gastaste ${clp(Math.round(avgPrev))} en promedio. Si se repite, cerrarías con este saldo.`
              : "Saldo al cierre si pagas todo lo registrado y no agregas más gastos."}
          </p>
          {perDay && (
            <div className="stats c3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="stat"><span className="l">Días restantes</span><span className="v">{perDay.days}</span></div>
              <div className="stat"><span className="l">Disponible por día</span><span className="v">{clp(Math.round(perDay.amount))}</span></div>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-h">
          <div>
            <h2>Cuentas más grandes</h2>
            <div className="sub">{active.label} · color según categoría</div>
          </div>
        </div>
        {top.length ? <Bars items={top} label="Cuentas más grandes del mes" /> : <div className="empty">Sin cuentas este mes.</div>}
      </section>

      {/* Resumen anual */}
      {ys && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Resumen del año {ys.year}</h2>
              <div className="sub">{ys.months.length} {ys.months.length === 1 ? "mes registrado" : "meses registrados"}</div>
            </div>
            {years.length > 1 && (
              <div className="chips">
                {years.map((y) => (
                  <button key={y} className={"chip " + (y === ys.year ? "on" : "")} onClick={() => setYearSel(y)}>{y}</button>
                ))}
              </div>
            )}
          </div>
          <div className="hero" style={{ marginBottom: 14 }}>
            <div>
              <div className="l">{ys.balance < 0 ? "Déficit del año" : "Ahorraste en el año"}</div>
              <div className={"v " + (ys.balance < 0 ? "neg" : "")}>{clp(Math.abs(ys.balance))}</div>
            </div>
            <span className="badge">{ys.rate}% de tus ingresos</span>
          </div>
          <div className="stats c3">
            <div className="stat"><span className="l">Ingresos</span><span className="v">{compact(ys.income)}</span></div>
            <div className="stat"><span className="l">Gastos</span><span className="v">{compact(ys.spent)}</span></div>
            <div className="stat"><span className="l">Promedio mensual</span><span className="v">{compact(ys.avgSpent)}</span></div>
          </div>
          <div className="facts">
            <div className="fact">
              <div className="l">Mes que más gastaste</div>
              <b>{ys.biggestMonth?.label || "—"}</b>
              <small className="num">{ys.biggestMonth ? clp(ys.biggestMonth.spent) : ""}</small>
            </div>
            <div className="fact">
              <div className="l">Mes que más ahorraste</div>
              <b>{ys.bestMonth?.label || "—"}</b>
              <small className="num">{ys.bestMonth ? clp(ys.bestMonth.balance) : ""}</small>
            </div>
            <div className="fact">
              <div className="l">Categoría más cara</div>
              <b>{topYearCat?.name || "—"}</b>
              <small className="num">{topYearCat && ys.spent > 0 ? `${clp(topYearCat.amount)} · ${Math.round((topYearCat.amount / ys.spent) * 100)}% de tus gastos` : ""}</small>
            </div>
            <div className="fact">
              <div className="l">Cuentas vs día a día</div>
              <b className="num">{ys.spent > 0 ? `${Math.round((ys.bills / ys.spent) * 100)}% / ${Math.round((ys.daily / ys.spent) * 100)}%` : "—"}</b>
              <small>{clp(ys.bills)} en cuentas · {clp(ys.daily)} diarios</small>
            </div>
          </div>
          {yearCats.length > 0 && <Bars items={yearCats.slice(0, 8)} label={`Gasto por categoría en ${ys.year}`} />}
        </section>
      )}
    </div>
  );
}
