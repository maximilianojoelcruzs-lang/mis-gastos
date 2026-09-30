// Consulta a Gemini (con búsqueda web) el precio más bajo en Chile.
// Si el modelo diera error de "no encontrado", define GEMINI_MODEL con
// otro modelo Flash vigente, sin tocar el código.
import type { PriceResult } from "./types";

const MODELO = process.env.GEMINI_MODEL || "gemini-3.8-flash";

export type PriceLookup = { result: PriceResult } | { raw: string };

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function buscarPrecio(producto: string): Promise<PriceLookup> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("Falta configurar GEMINI_API_KEY en Vercel.", 500);

  const prompt =
    'Busca en internet el precio más bajo disponible HOY en Chile para este producto: "' + producto + '".\n' +
    "Prioriza tiendas chilenas confiables. Responde ÚNICAMENTE con un objeto JSON válido, " +
    "sin texto adicional, sin explicaciones y sin bloques de código, con esta forma EXACTA:\n" +
    '{"producto":"...","precio_clp":0,"tienda":"...","url":"https://...","nota":"..."}\n' +
    "- precio_clp: solo el número entero en pesos chilenos, sin puntos ni símbolos.\n" +
    "- url: enlace directo al producto en esa tienda.\n" +
    "- nota: una línea corta (ej: fecha o condición del precio).\n" +
    "- Si no encuentras un precio confiable, usa precio_clp: 0 y explica brevemente en nota.";

  const resp = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
      }),
    }
  );

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new GeminiError(data?.error?.message || "Error al consultar Gemini.", 502);
  }

  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("").trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      return { result: { ...parsed, precio_clp: Number(parsed.precio_clp) || 0 } };
    } catch {
      // cae al texto crudo
    }
  }
  return { raw: text || "La IA no devolvió un precio claro." };
}
