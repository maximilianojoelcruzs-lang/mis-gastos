// ============================================================
//  api/buscar-precio.js  —  Función de servidor para Vercel
//  Recibe el nombre de un producto y le pide a Gemini (con
//  búsqueda web) el precio más bajo en Chile.
//  Tu llave de Gemini NO va aquí escrita: se lee de la variable
//  de entorno GEMINI_API_KEY que configuras en Vercel.
// ============================================================

// Si algún día este modelo diera error de "no encontrado",
// cámbialo por otro modelo Flash vigente (ej: "gemini-3.5-flash").
const MODELO = "gemini-2.5-flash";

export default async function handler(req, res) {
  const q = ((req.query && req.query.q) || "").toString().trim();
  if (!q) {
    res.status(400).json({ error: "Falta el nombre del producto." });
    return;
  }

  const KEY = process.env.GEMINI_API_KEY;
  if (!KEY) {
    res.status(500).json({ error: "Falta configurar GEMINI_API_KEY en Vercel." });
    return;
  }

  const prompt =
    'Busca en internet el precio más bajo disponible HOY en Chile para este producto: "' + q + '".\n' +
    "Prioriza tiendas chilenas confiables. Responde ÚNICAMENTE con un objeto JSON válido, " +
    "sin texto adicional, sin explicaciones y sin bloques de código, con esta forma EXACTA:\n" +
    '{"producto":"...","precio_clp":0,"tienda":"...","url":"https://...","nota":"..."}\n' +
    "- precio_clp: solo el número entero en pesos chilenos, sin puntos ni símbolos.\n" +
    "- url: enlace directo al producto en esa tienda.\n" +
    "- nota: una línea corta (ej: fecha o condición del precio).\n" +
    "- Si no encuentras un precio confiable, usa precio_clp: 0 y explica brevemente en nota.";

  try {
    const resp = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + MODELO + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      }
    );

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      const msg = (data && data.error && data.error.message) || "Error al consultar Gemini.";
      res.status(502).json({ error: msg });
      return;
    }

    const parts = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.map((p) => p.text || "").join("").trim();

    let result = null;
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { result = JSON.parse(match[0]); } catch (e) { result = null; }
    }

    if (result) res.status(200).json({ ok: true, result });
    else res.status(200).json({ ok: true, raw: text || "La IA no devolvió un precio claro." });
  } catch (e) {
    res.status(500).json({ error: "Falló la consulta a la IA." });
  }
}
