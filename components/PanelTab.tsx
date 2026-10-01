"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  catColor, catOf, currentPeriod, limitStatus, summarizeAll, summarizeYear, tagTotals, todayISO, weekSummary, yearsOf,
  type WeekSummary,
} from "@/lib/data";
import { clp, compact, isPrivate } from "@/lib/format";
import type { AppData, Category, CategoryId, MonthSummary } from "@/lib/types";
import { IAlert, IArrowDown, IArrowUp, ICalendar, ICheck, ICopy, IDownload, ITable, ITrend } from "./icons";

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

const DOW = ["D", "L", "M", "M", "J", "V", "S"];
const dow = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
};
const shortDate = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

/** Columnas de los últimos 7 días (una sola serie, sin leyenda). */
function WeekBars({ week }: { week: WeekSummary }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const H = 120, top = 8, bottom = 20;
  const plotH = H - top - bottom;
  const max = Math.max(...week.byDay.map((d) => d.amount), 1);
  const band = width / 7;
  const barW = Math.max(8, Math.min(28, band * 0.5));
  const h = hover === null ? null : week.byDay[hover];
  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={H} role="img" aria-label="Gasto diario de los últimos 7 días">
          <line x1={0} x2={width} y1={top + plotH} y2={top + plotH} className="gridline" />
          {week.byDay.map((d, i) => {
            const bh = d.amount > 0 ? Math.max(2, (d.amount / max) * plotH) : 0;
            const cx = band * i + band / 2;
            return (
              <g key={d.date} opacity={hover === null || hover === i ? 1 : 0.45}>
                {bh > 0 && <path d={barPath(cx - barW / 2, top + plotH - bh, barW, bh)} style={{ fill: "var(--ink)" }} />}
                <text x={cx} y={H - 5} textAnchor="middle" className={"axis " + (d.date === week.to ? "ink" : "")}>{DOW[dow(d.date)]}</text>
                <rect x={band * i} y={0} width={band} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {h && hover !== null && (
        <Tooltip tip={{ x: Math.min(Math.max(band * hover + band / 2, 80), Math.max(80, width - 80)), y: 40, title: shortDate(h.date),
          rows: [{ label: h.amount ? "Gastaste" : "Sin gastos", value: h.amount ? clp(h.amount) : "—" }] }} />
      )}
    </div>
  );
}

type Slice = { id: string; label: string; color: string; amount: number };

/** Dona de distribución (máximo 6 porciones: el resto se agrupa en "Otras"). */
function Donut({ slices, total }: { slices: Slice[]; total: number }) {
  const [hover, setHover] = useState<string | null>(null);
  const S = 168, R = 80, r = 54, C = S / 2;
  let acc = 0;
  const arc = (a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number, rad: number) => `${C + rad * Math.sin(a)},${C - rad * Math.cos(a)}`;
    return `M${p(a0, R)}A${R},${R} 0 ${large} 1 ${p(a1, R)}L${p(a1, r)}A${r},${r} 0 ${large} 0 ${p(a0, r)}Z`;
  };
  const hv = slices.find((s) => s.id === hover);
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Distribución del gasto por categoría" className="donut"
      onMouseLeave={() => setHover(null)}>
      {slices.length === 1 ? (
        <circle cx={C} cy={C} r={(R + r) / 2} fill="none" strokeWidth={R - r} style={{ stroke: slices[0].color }} />
      ) : (
        slices.map((s) => {
          const a0 = (acc / total) * Math.PI * 2;
          acc += s.amount;
          const a1 = (acc / total) * Math.PI * 2;
          return (
            <path key={s.id} d={arc(a0, a1)} style={{ fill: s.color, stroke: "var(--surface)" }} strokeWidth={2}
              opacity={hover === null || hover === s.id ? 1 : 0.4} onMouseEnter={() => setHover(s.id)} onTouchStart={() => setHover(s.id)}>
              <title>{`${s.label}: ${clp(s.amount)}`}</title>
            </path>
          );
        })
      )}
      <text x={C} y={C - 6} textAnchor="middle" className="axis">{hv ? hv.label : "Total"}</text>
      <text x={C} y={C + 14} textAnchor="middle" className="donut-v">{compact(hv ? hv.amount : total)}</text>
    </svg>
  );
}

function weekText(w: WeekSummary) {
  const lines = [
    `Mis Gastos · semana del ${shortDate(w.from)} al ${shortDate(w.to)}`,
    `Gasté ${clp(w.total)} en ${w.count} ${w.count === 1 ? "gasto" : "gastos"} del día a día.`,
  ];
  if (w.prevTotal > 0) {
    const pct = Math.round(((w.total - w.prevTotal) / w.prevTotal) * 100);
    lines.push(pct === 0 ? "Igual que la semana anterior." : `${Math.abs(pct)}% ${pct > 0 ? "más" : "menos"} que la semana anterior (${clp(w.prevTotal)}).`);
  }
  if (w.topCategory) lines.push(`Donde más gasté: ${w.topCategory.cat.label} (${clp(w.topCategory.amount)}).`);
  lines.push(`Días sin gastos: ${w.noSpendDays} de 7.`);
  if (w.upcoming.length) lines.push(`Por pagar esta semana: ${w.upcoming.map((u) => `${u.name} ${clp(u.amount)} (día ${u.day})`).join(", ")}.`);
  return lines.join("\n");
}

type Range = "3" | "6" | "year" | "all";

type PanelProps = { data: AppData; onExport: () => void; onReport: () => void; notify: (t: string) => void };

export default function PanelTab({ data, onExport, onReport, notify }: PanelProps) {
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

  // Semana, distribución, límites y etiquetas
  const week = weekSummary(data);
  const weekPct = week.prevTotal > 0 ? Math.round(((week.total - week.prevTotal) / week.prevTotal) * 100) : null;
  const shareWeek = async () => {
    if (isPrivate()) return notify("Desactiva “Ocultar montos” para compartir el resumen");
    const text = weekText(week);
    try {
      if (navigator.share) await navigator.share({ title: "Resumen semanal", text });
      else {
        await navigator.clipboard.writeText(text);
        notify("Resumen copiado: pégalo en WhatsApp o donde quieras");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") notify("No se pudo compartir");
    }
  };
  const byCat: Record<CategoryId, number> = cur.byCategory;
  const ranked = data.categories
    .map((c) => ({ id: c.id, label: c.label, color: catColor(c.color), amount: byCat[c.id] || 0 }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const distTotal = ranked.reduce((s, c) => s + c.amount, 0);
  const slices: Slice[] = ranked.length > 6
    ? [...ranked.slice(0, 5), { id: "__rest", label: `Otras (${ranked.length - 5})`, color: "var(--dim)", amount: ranked.slice(5).reduce((s, c) => s + c.amount, 0) }]
    : ranked;
  const limits = limitStatus(data.categories, byCat);
  const tags = tagTotals(data, year).slice(0, 8);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="chips">
          {([["3", "3 meses"], ["6", "6 meses"], ["year", "Este año"], ["all", "Todo"]] as [Range, string][]).map(([id, l]) => (
            <button key={id} className={"chip " + (range === id ? "on" : "")} onClick={() => setRange(id)}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm primary" onClick={onReport} title={`Descarga el reporte de ${active.label} en PDF`}><IDownload size={13} /> Reporte PDF del mes</button>
          <button className="btn sm" onClick={onExport}>Exportar…</button>
        </div>
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
            <h2>Tu semana</h2>
            <div className="sub">Gastos diarios del {shortDate(week.from)} al {shortDate(week.to)} · tu parte en los compartidos</div>
          </div>
          <button className="btn sm" onClick={shareWeek} title="Compartir o copiar el resumen"><ICopy size={13} /> Compartir</button>
        </div>
        <div className="week">
          <div>
            <div className="num" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-.02em" }}>{clp(week.total)}</div>
            <p className="muted" style={{ margin: "4px 0 12px", fontSize: 12.5 }}>
              {weekPct === null ? `${week.count} ${week.count === 1 ? "gasto" : "gastos"} anotados`
                : weekPct === 0 ? "Igual que la semana anterior"
                  : <>{weekPct > 0 ? <IArrowUp size={11} /> : <IArrowDown size={11} />} {Math.abs(weekPct)}% {weekPct > 0 ? "más" : "menos"} que la semana anterior</>}
            </p>
            <div className="facts tight">
              <div className="fact"><div className="l">Donde más gastaste</div><b>{week.topCategory?.cat.label || "—"}</b>
                <small className="num">{week.topCategory ? clp(week.topCategory.amount) : ""}</small></div>
              <div className="fact"><div className="l">Días sin gastos</div><b className="num">{week.noSpendDays} de 7</b>
                <small>{week.noSpendDays >= 2 ? "¡Bien!" : ""}</small></div>
              <div className="fact"><div className="l">Gasto más grande</div><b>{week.biggest?.name || "—"}</b>
                <small className="num">{week.biggest ? clp(week.biggest.amount) : ""}</small></div>
            </div>
          </div>
          <WeekBars week={week} />
        </div>
        {week.upcoming.length > 0 && (
          <div className="alert warn" style={{ margin: "14px 0 0" }}>
            <ICalendar size={16} />
            <span>Por pagar esta semana: {week.upcoming.map((u, i) => <span key={i}>{i > 0 && " · "}<b>{u.name}</b> {clp(u.amount)} (día {u.day})</span>)}</span>
          </div>
        )}
      </section>

      <div className="grid2" style={{ marginBottom: 16 }}>
        <section className="card">
          <div className="card-h">
            <div>
              <h2>En qué se va la plata</h2>
              <div className="sub">{active.label} · cuentas + diarios de tu bolsillo</div>
            </div>
          </div>
          {distTotal === 0 ? (
            <div className="empty">Sin gastos este mes.</div>
          ) : (
            <div className="dist2">
              <Donut slices={slices} total={distTotal} />
              <div className="dist2-l">
                {slices.map((s) => {
                  const p = prev && s.id !== "__rest" ? prev.byCategory[s.id] || 0 : null;
                  return (
                    <div key={s.id} className="dl">
                      <i className="dot" style={{ background: s.color }} />
                      <span className="n">{s.label}</span>
                      <span className="v num">{clp(s.amount)}</span>
                      <span className="p num">{Math.round((s.amount / distTotal) * 100)}%</span>
                      {p !== null && p > 0 && s.amount !== p && (
                        <span className={"chg " + (s.amount > p ? "up" : "down")} title={`${prev!.label}: ${clp(p)}`}>
                          {s.amount > p ? <IArrowUp size={10} /> : <IArrowDown size={10} />}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-h">
            <div>
              <h2>Límites por categoría</h2>
              <div className="sub">{active.label}</div>
            </div>
          </div>
          {limits.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
              Define cuánto quieres gastar como máximo al mes en cada categoría en <b>Ajustes → Categorías y límites</b>. Aquí verás cuánto llevas y te avisaremos al acercarte.
            </div>
          ) : (
            limits.map((l) => (
              <div key={l.cat.id} className="limit">
                <div className="limit-h">
                  <span className="n"><i className="dot" style={{ background: catColor(l.cat.color) }} /> {l.cat.label}</span>
                  <span className={"s " + l.tone}>
                    {l.tone === "over" ? <><IAlert size={11} /> Te pasaste {clp(l.spent - l.limit)}</> : l.tone === "warn" ? <><IAlert size={11} /> {l.pct}%</> : <><ICheck size={11} /> {l.pct}%</>}
                  </span>
                </div>
                <div className="bar"><i className={l.tone === "over" ? "bad" : l.tone === "warn" ? "warn" : ""} style={{ width: Math.min(100, l.pct) + "%" }} /></div>
                <div className="bar-l"><span>{clp(l.spent)} de {clp(l.limit)}</span><span>{l.spent < l.limit ? `Quedan ${clp(l.limit - l.spent)}` : ""}</span></div>
              </div>
            ))
          )}
        </section>
      </div>

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

      {tags.length > 0 && (
        <section className="card">
          <div className="card-h">
            <div>
              <h2>Por etiqueta</h2>
              <div className="sub">{year} · cuentas + diarios de tu bolsillo con esa etiqueta</div>
            </div>
          </div>
          <Bars items={tags.map((t) => ({ id: t.tag, name: "#" + t.tag, amount: t.amount, color: "var(--ink)" }))} label={`Gasto por etiqueta en ${year}`} />
        </section>
      )}

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
