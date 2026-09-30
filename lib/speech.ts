// Convierte una frase dictada o escrita en productos de la lista.
//   "agrega dos leches, pan y 3 yogures" → Leches x2, Pan x1, Yogures x3
// Sin dependencias, para poder probarla sola.

const NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};
const UNITS = "kilos?|kg|litros?|lts?|paquetes?|cajas?|cajitas?|botellas?|botellones?|latas?|bolsas?|bolsitas?|unidades?|un|pack|packs|sixpack|barras?|frascos?|tarros?|potes?";
const LEADING_VERBS = /^(?:por favor\s+)?(?:agrega(?:r|me)?|a[ñn]ade|a[ñn]adir|anota(?:r|me)?|pon(?:er|me)?|compra(?:r|me)?|necesito(?: comprar)?|quiero(?: comprar)?|hay que comprar|tengo que comprar|me faltan?|faltan?|traer|trae)\b[\s:,]*/i;
const MAX_COUNT = 30;
const ARTICLES = /^(?:el|la|los|las|unos|unas|de)\s+/i;

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function parseShoppingList(text: string): { name: string; qty: number }[] {
  let t = (text || "").replace(/[.!?¿¡;]+/g, ",").replace(/\s+/g, " ").trim();
  if (!t) return [];
  t = t.replace(LEADING_VERBS, "");
  // Separadores entre productos
  const parts = t.split(/\s*(?:,|\by\b|\bmás\b|\bademás\b|\btambién\b|\bluego\b|\bnuevamente\b)\s*/i).map((p) => p.trim()).filter(Boolean);

  const seen = new Set<string>();
  const out: { name: string; qty: number }[] = [];
  for (let raw of parts) {
    raw = raw.replace(LEADING_VERBS, "").trim();
    let qty = 1;
    // "x2" / "2x"
    let m = raw.match(/^(\d{1,3})\s*x\s+(.*)$/i) || raw.match(/^(.*?)\s+x\s*(\d{1,3})$/i) || raw.match(/^(.*?)\s+(\d{1,3})\s*x$/i);
    if (m) {
      const [a, b] = m.slice(1);
      if (/^\d+$/.test(a)) { qty = parseInt(a, 10); raw = b; } else { qty = parseInt(b, 10); raw = a; }
    } else {
      m = raw.match(/^(\d{1,3})\s+(.*)$/);
      if (m && parseInt(m[1], 10) <= MAX_COUNT) { qty = parseInt(m[1], 10); raw = m[2]; }
      else if ((m = raw.match(/^(\d+(?:[.,]\d+)?)\s*(gramos?|gr|g|ml|cc|cl)\s+(?:de\s+)?(.+)$/i))) {
        // "500 gramos de queso" → el número es un peso, no una cantidad: queda en el nombre.
        raw = `${m[3].trim()} ${m[1]} ${m[2]}`;
      } else if (m) { /* número grande sin unidad: se deja en el nombre */ }
      else {
        const first = raw.split(" ")[0];
        const word = strip(first);
        if (NUMBERS[word] !== undefined && raw.split(" ").length > 1) { qty = NUMBERS[word]; raw = raw.slice(first.length).trim(); }
      }
    }
    // "2 kilos de tomate" → Tomate x2 (la unidad se entiende por la cantidad)
    raw = raw.replace(new RegExp(`^(?:${UNITS})\\s+de\\s+`, "i"), "");
    raw = raw.replace(ARTICLES, "").replace(ARTICLES, "").trim();
    if (!raw || raw.length < 2 || qty < 1) continue;
    const name = (raw[0].toUpperCase() + raw.slice(1)).slice(0, 60);
    const key = strip(name);
    if (seen.has(key)) {
      const prev = out.find((o) => strip(o.name) === key);
      if (prev) prev.qty += qty;
      continue;
    }
    seen.add(key);
    out.push({ name, qty });
  }
  return out;
}
