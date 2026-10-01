// Exportación a Excel (.xlsx) y PDF. Todo ocurre en el navegador; las librerías
// pesadas se cargan solo al exportar.
import type { AppData, Month } from "./types";
import { balances, catOf, currentPeriod, dailyParts, limitStatus, periodName, summarizeMonth } from "./data";

export type ExportScope = "month" | "year" | "all";
export type ExportFormat = "xlsx" | "pdf";

function pick(data: AppData, scope: ExportScope): { months: Month[]; label: string; slug: string } {
  const active = data.months.find((m) => m.id === data.activeId) || data.months[0];
  if (scope === "month") return { months: [active], label: active.label || "Mes", slug: active.period || "mes" };
  if (scope === "year") {
    const year = (active.period || currentPeriod()).slice(0, 4);
    const list = data.months.filter((m) => m.period.startsWith(year));
    return { months: list.length ? list : [active], label: `Año ${year}`, slug: year };
  }
  return { months: data.months, label: "Todos los meses", slug: "todo" };
}

function build(data: AppData, scope: ExportScope) {
  const { months, label, slug } = pick(data, scope);
  const summaries = months.map((m) => summarizeMonth(m, data.daily));
  const periods = new Set(months.map((m) => m.period).filter(Boolean));
  const daily = data.daily.filter((d) => periods.has(d.date.slice(0, 7))).sort((a, b) => a.date.localeCompare(b.date));
  const catTotals = data.categories.map((c) => ({
    cat: c,
    byMonth: summaries.map((s) => s.byCategory[c.id] || 0),
    total: summaries.reduce((t, s) => t + (s.byCategory[c.id] || 0), 0),
  })).filter((c) => c.total > 0);
  const totals = summaries.reduce(
    (t, s) => ({ income: t.income + s.income, bills: t.bills + s.bills, daily: t.daily + s.daily, dailyCard: t.dailyCard + s.dailyCard, spent: t.spent + s.spent, balance: t.balance + s.balance }),
    { income: 0, bills: 0, daily: 0, dailyCard: 0, spent: 0, balance: 0 }
  );
  return { months, summaries, daily, catTotals, totals, label, slug };
}

const personName = (data: AppData, id: string) => data.people.find((p) => p.id === id)?.name || "";
const paidByLabel = (data: AppData, id: string) => (id ? personName(data, id) || "Otra persona" : "Yo");
const splitLabel = (data: AppData, ids: string[]) => ids.map((id) => personName(data, id)).filter(Boolean).join(", ");
const tagsLabel = (tags: string[]) => tags.map((t) => "#" + t).join(" ");

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportData(data: AppData, scope: ExportScope, format: ExportFormat) {
  const model = build(data, scope);
  const filename = `mis-gastos-${model.slug}.${format}`;
  const blob = format === "xlsx" ? await toXlsx(data, model) : await toPdf(data, model);
  download(blob, filename);
  return filename;
}

type Model = ReturnType<typeof build>;

async function toXlsx(data: AppData, m: Model): Promise<Blob> {
  const writeExcelFile = (await import("write-excel-file/browser")).default;
  const head = (v: string) => ({ value: v, fontWeight: "bold" as const });
  const money = (v: number, bold = false) => ({ value: v, type: Number, format: "#,##0", ...(bold ? { fontWeight: "bold" as const } : {}) });
  const text = (v: string, bold = false) => ({ value: v, type: String, ...(bold ? { fontWeight: "bold" as const } : {}) });

  const resumen = [
    [head("Mes"), head("Ingresos"), head("Cuentas"), head("Gastos diarios"), head("Diarios con tarjeta"), head("Total gastos"), head("Ahorro")],
    ...m.summaries.map((s) => [text(s.label || "Sin nombre"), money(s.income), money(s.bills), money(s.daily), money(s.dailyCard), money(s.spent), money(s.balance)]),
    [text("Total", true), money(m.totals.income, true), money(m.totals.bills, true), money(m.totals.daily, true), money(m.totals.dailyCard, true), money(m.totals.spent, true), money(m.totals.balance, true)],
  ];

  const cuentas = [
    [head("Mes"), head("Cuenta"), head("Categoría"), head("Monto"), head("Pagado"), head("Vence (día)"), head("Cuota"), head("Etiquetas")],
    ...m.months.flatMap((mo) =>
      mo.items.map((i) => [
        text(mo.label || "Sin nombre"), text(i.name), text(catOf(data.categories, i.category).label), money(i.amount),
        text(i.paid ? "Sí" : "No"), i.dueDay ? { value: i.dueDay, type: Number } : text(""),
        text(i.installment ? `${i.installment.current}/${i.installment.total}` : ""), text(tagsLabel(i.tags)),
      ])
    ),
  ];

  const diarios = [
    [head("Fecha"), head("Descripción"), head("Categoría"), head("Monto"), head("Tu parte"), head("Pagado con tarjeta"), head("Pagó"), head("Compartido con"), head("Etiquetas")],
    ...m.daily.map((d) => [
      text(d.date), text(d.name), text(catOf(data.categories, d.category).label), money(d.amount), money(dailyParts(d).mine), money(d.cardAmount || 0),
      text(paidByLabel(data, d.paidBy)), text(splitLabel(data, d.split)), text(tagsLabel(d.tags)),
    ]),
  ];

  const porCategoria = [
    [head("Categoría"), ...m.summaries.map((s) => head(s.label || "Sin nombre")), head("Total")],
    ...m.catTotals.map((c) => [text(c.cat.label), ...c.byMonth.map((v) => money(v)), money(c.total, true)]),
  ];

  const sheets = [
    { data: resumen, sheet: "Resumen", columns: [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 20 }, { width: 16 }, { width: 14 }] },
    { data: cuentas, sheet: "Cuentas", columns: [{ width: 20 }, { width: 28 }, { width: 16 }, { width: 14 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 24 }] },
    { data: diarios, sheet: "Diarios", columns: [{ width: 13 }, { width: 32 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 20 }, { width: 14 }, { width: 20 }, { width: 24 }] },
    { data: porCategoria, sheet: "Por categoría", columns: [{ width: 20 }, ...m.summaries.map(() => ({ width: 14 })), { width: 14 }] },
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (writeExcelFile as any)(sheets).toBlob();
}

// jsPDF usa fuentes estándar (Latin-1): se reemplaza lo que no soporta.
const pdfText = (s: string) => s.replace(/[−–—]/g, "-").replace(/[^\x00-\xFF]/g, "?");
const pdfMoney = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("es-CL");

async function toPdf(data: AppData, m: Model): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 40;
  let y = 52;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Mis Gastos", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(pdfText(`${m.label}  ·  generado el ${new Date().toLocaleDateString("es-CL")}`), left, y + 18);
  doc.setTextColor(20);
  y += 42;

  // Resumen en cifras
  const kpis: [string, string][] = [
    ["Ingresos", pdfMoney(m.totals.income)],
    ["Gastos", pdfMoney(m.totals.spent)],
    [m.totals.balance < 0 ? "Déficit" : "Ahorro", pdfMoney(Math.abs(m.totals.balance))],
    ["Tasa de ahorro", m.totals.income > 0 ? Math.round((m.totals.balance / m.totals.income) * 100) + "%" : "-"],
  ];
  const boxW = (doc.internal.pageSize.getWidth() - left * 2 - 24) / 4;
  kpis.forEach(([l, v], i) => {
    const x = left + i * (boxW + 8);
    doc.setDrawColor(220);
    doc.roundedRect(x, y, boxW, 48, 4, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(110);
    doc.text(pdfText(l), x + 10, y + 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20);
    doc.text(pdfText(v), x + 10, y + 36);
  });
  y += 76;

  const table = (title: string, head: string[], body: string[][], foot?: string[]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(pdfText(title), left, y);
    autoTable(doc, {
      startY: y + 8,
      head: [head.map(pdfText)],
      body: body.map((r) => r.map(pdfText)),
      foot: foot ? [foot.map(pdfText)] : undefined,
      margin: { left, right: left },
      styles: { fontSize: 9, cellPadding: 5, textColor: 30 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      footStyles: { fillColor: [240, 240, 243], textColor: 20, fontStyle: "bold" },
      columnStyles: Object.fromEntries(head.map((_, i) => [i, { halign: i === 0 || head[i] === "Categoría" || head[i] === "Cuenta" || head[i] === "Descripción" || head[i] === "Estado" ? "left" : "right" }])),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 26;
  };

  table("Resumen por mes", ["Mes", "Ingresos", "Cuentas", "Diarios", "Total gastos", "Ahorro"],
    m.summaries.map((s) => [s.label || "Sin nombre", pdfMoney(s.income), pdfMoney(s.bills), pdfMoney(s.daily), pdfMoney(s.spent), pdfMoney(s.balance)]),
    ["Total", pdfMoney(m.totals.income), pdfMoney(m.totals.bills), pdfMoney(m.totals.daily), pdfMoney(m.totals.spent), pdfMoney(m.totals.balance)]);
  if (m.totals.dailyCard > 0) {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(pdfText(`Además, ${pdfMoney(m.totals.dailyCard)} en gastos diarios se pagaron con tarjetas de alimentación (no incluidos arriba).`), left, y - 14);
    doc.setTextColor(20);
    y += 6;
  }

  if (m.catTotals.length) {
    const sorted = [...m.catTotals].sort((a, b) => b.total - a.total);
    table("Gasto por categoría", ["Categoría", "Total", "% del gasto"],
      sorted.map((c) => [c.cat.label, pdfMoney(c.total), m.totals.spent > 0 ? Math.round((c.total / m.totals.spent) * 100) + "%" : "-"]));
  }

  if (m.months.length === 1) {
    const mo = m.months[0];
    const limits = limitStatus(data.categories, m.summaries[0].byCategory);
    if (limits.length)
      table("Límites por categoría", ["Categoría", "Gastado", "Límite", "Uso", "Estado"],
        limits.map((l) => [l.cat.label, pdfMoney(l.spent), pdfMoney(l.limit), l.pct + "%",
          l.tone === "over" ? `Excedido por ${pdfMoney(l.spent - l.limit)}` : l.tone === "warn" ? "Cerca del límite" : "Dentro del límite"]));
    const top = [...m.daily].sort((a, b) => dailyParts(b).mine - dailyParts(a).mine).slice(0, 5);
    if (top.length > 1)
      table("Gastos diarios más grandes", ["Fecha", "Descripción", "Categoría", "Tu parte"],
        top.map((d) => [d.date, d.name, catOf(data.categories, d.category).label, pdfMoney(dailyParts(d).mine)]));
    if (mo.items.length)
      table("Cuentas del mes", ["Cuenta", "Categoría", "Vence", "Pagado", "Monto"],
        mo.items.map((i) => [
          i.name + (i.installment ? ` (cuota ${i.installment.current}/${i.installment.total})` : ""),
          catOf(data.categories, i.category).label, i.dueDay ? `día ${i.dueDay}` : "-", i.paid ? "Sí" : "No", pdfMoney(i.amount),
        ]));
    if (m.daily.length)
      table("Gastos diarios", ["Fecha", "Descripción", "Categoría", "Monto", "Tu parte", "Con tarjeta"],
        m.daily.map((d) => [
          d.date, d.name + (d.tags.length ? `  ${tagsLabel(d.tags)}` : "") + (d.split.length ? ` (compartido, pagó ${paidByLabel(data, d.paidBy)})` : ""),
          catOf(data.categories, d.category).label, pdfMoney(d.amount), pdfMoney(dailyParts(d).mine), d.cardAmount ? pdfMoney(d.cardAmount) : "-",
        ]));
  } else {
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("El detalle de cuentas y gastos diarios de cada mes está en la exportación a Excel.", left, y);
  }

  const owed = balances(data).filter((b) => b.count > 0 || b.balance !== 0);
  if (owed.length) {
    y += 14;
    table("Gastos compartidos (saldo a hoy)", ["Persona", "Te debe", "Le debes", "Pagos registrados", "Saldo"],
      owed.map((b) => [b.person.name, pdfMoney(b.owedToMe), pdfMoney(b.iOwe), pdfMoney(b.settled),
        b.balance === 0 ? "A mano" : b.balance > 0 ? `Te debe ${pdfMoney(b.balance)}` : `Le debes ${pdfMoney(-b.balance)}`]));
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${p} de ${pages}`, doc.internal.pageSize.getWidth() - left, doc.internal.pageSize.getHeight() - 24, { align: "right" });
  }
  return doc.output("blob");
}

export const scopeTitle = (data: AppData, scope: ExportScope) => pick(data, scope).label;
export { periodName };
