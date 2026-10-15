// Ideas de regalo, ocasiones y fechas. Los precios son referencias aproximadas
// en pesos chilenos para sugerir algo dentro del presupuesto.
import type { GiftPerson, Occasion, Relation } from "./types";
import { daysUntil, todayISO } from "./data";

export const RELATIONS: { id: Relation; label: string }[] = [
  { id: "pareja", label: "Pareja" },
  { id: "mama", label: "Mamá" },
  { id: "papa", label: "Papá" },
  { id: "hijo", label: "Hijo/a" },
  { id: "hermano", label: "Hermano/a" },
  { id: "amigo", label: "Amigo/a" },
  { id: "abuelo", label: "Abuelo/a" },
  { id: "colega", label: "Colega" },
  { id: "otro", label: "Otra persona" },
];

export const OCCASIONS: { id: Occasion; label: string; fixed: boolean }[] = [
  { id: "cumpleanos", label: "Cumpleaños", fixed: false },
  { id: "navidad", label: "Navidad", fixed: true },
  { id: "aniversario", label: "Aniversario", fixed: false },
  { id: "dia-madre", label: "Día de la Madre", fixed: true },
  { id: "dia-padre", label: "Día del Padre", fixed: true },
  { id: "san-valentin", label: "San Valentín", fixed: true },
  { id: "otro", label: "Otra ocasión", fixed: false },
];

export const INTERESTS: { id: string; label: string }[] = [
  { id: "tecnologia", label: "Tecnología" },
  { id: "deporte", label: "Deporte" },
  { id: "cocina", label: "Cocina" },
  { id: "lectura", label: "Lectura" },
  { id: "musica", label: "Música" },
  { id: "belleza", label: "Cuidado personal" },
  { id: "hogar", label: "Hogar y deco" },
  { id: "juegos", label: "Juegos" },
  { id: "viajes", label: "Viajes y aventura" },
  { id: "moda", label: "Moda" },
  { id: "mascotas", label: "Mascotas" },
  { id: "plantas", label: "Plantas" },
  { id: "cafe", label: "Café y té" },
  { id: "experiencias", label: "Experiencias" },
];

export const relationOf = (id: Relation) => RELATIONS.find((r) => r.id === id) || RELATIONS[RELATIONS.length - 1];
export const occasionOf = (id: Occasion) => OCCASIONS.find((o) => o.id === id) || OCCASIONS[OCCASIONS.length - 1];

type Idea = { name: string; price: number; for: Relation[] | "todos"; tags: string[] };

const ADULT: Relation[] = ["pareja", "mama", "papa", "hermano", "amigo", "abuelo", "colega", "otro"];
const IDEAS: Idea[] = [
  { name: "Audífonos inalámbricos", price: 35000, for: ADULT, tags: ["tecnologia", "musica", "deporte"] },
  { name: "Parlante bluetooth", price: 30000, for: "todos", tags: ["tecnologia", "musica"] },
  { name: "Smartwatch o pulsera deportiva", price: 45000, for: ADULT, tags: ["tecnologia", "deporte"] },
  { name: "Cargador portátil (power bank)", price: 15000, for: ADULT, tags: ["tecnologia", "viajes"] },
  { name: "Kindle o lector de libros", price: 110000, for: ADULT, tags: ["lectura", "tecnologia"] },
  { name: "Libro de su autor favorito", price: 15000, for: "todos", tags: ["lectura"] },
  { name: "Botella térmica", price: 15000, for: ADULT, tags: ["deporte", "viajes", "cafe"] },
  { name: "Mat de yoga", price: 18000, for: ADULT, tags: ["deporte", "belleza"] },
  { name: "Polera o camiseta de su equipo", price: 35000, for: "todos", tags: ["deporte", "moda"] },
  { name: "Set de cuchillos de cocina", price: 30000, for: ADULT, tags: ["cocina", "hogar"] },
  { name: "Freidora de aire", price: 55000, for: ADULT, tags: ["cocina", "hogar"] },
  { name: "Libro de recetas", price: 18000, for: ADULT, tags: ["cocina", "lectura"] },
  { name: "Cafetera italiana (moka)", price: 20000, for: ADULT, tags: ["cafe", "cocina"] },
  { name: "Café de especialidad + taza", price: 15000, for: ADULT, tags: ["cafe"] },
  { name: "Set de tés e infusiones", price: 12000, for: ADULT, tags: ["cafe", "belleza"] },
  { name: "Vinilo o entrada a un concierto", price: 40000, for: ADULT, tags: ["musica", "experiencias"] },
  { name: "Kit de cuidado de la piel", price: 25000, for: ADULT, tags: ["belleza"] },
  { name: "Perfume", price: 45000, for: ["pareja", "mama", "papa", "hermano", "amigo", "abuelo"], tags: ["belleza", "moda"] },
  { name: "Masaje o día de spa", price: 40000, for: ADULT, tags: ["belleza", "experiencias"] },
  { name: "Vela aromática y difusor", price: 15000, for: ADULT, tags: ["hogar", "belleza"] },
  { name: "Manta o cojín decorativo", price: 20000, for: ADULT, tags: ["hogar"] },
  { name: "Marco con foto de ustedes", price: 12000, for: ["pareja", "mama", "papa", "abuelo", "hermano"], tags: ["hogar"] },
  { name: "Álbum de fotos impreso", price: 25000, for: ["pareja", "mama", "papa", "abuelo"], tags: ["hogar", "experiencias"] },
  { name: "Juego de mesa", price: 25000, for: "todos", tags: ["juegos"] },
  { name: "Puzzle de 1000 piezas", price: 15000, for: ADULT, tags: ["juegos", "hogar"] },
  { name: "Gift card de videojuegos", price: 20000, for: ["hijo", "hermano", "amigo", "pareja"], tags: ["juegos", "tecnologia"] },
  { name: "Mochila o bolso de viaje", price: 35000, for: ADULT, tags: ["viajes", "moda"] },
  { name: "Escapada de fin de semana", price: 120000, for: ["pareja", "mama", "papa"], tags: ["viajes", "experiencias"] },
  { name: "Cena en un restorán", price: 50000, for: ["pareja", "mama", "papa", "amigo", "abuelo"], tags: ["experiencias", "cocina"] },
  { name: "Clase o taller (cocina, cerámica…)", price: 35000, for: ADULT, tags: ["experiencias", "cocina", "hogar"] },
  { name: "Billetera o cartera", price: 25000, for: ADULT, tags: ["moda"] },
  { name: "Bufanda y gorro", price: 15000, for: "todos", tags: ["moda"] },
  { name: "Accesorios para su mascota", price: 15000, for: "todos", tags: ["mascotas"] },
  { name: "Cama o juguete para mascota", price: 25000, for: ADULT, tags: ["mascotas", "hogar"] },
  { name: "Planta de interior con macetero", price: 15000, for: ADULT, tags: ["plantas", "hogar"] },
  { name: "Kit de huerto en casa", price: 18000, for: ADULT, tags: ["plantas", "cocina"] },
  { name: "Ramo de flores", price: 20000, for: ["pareja", "mama", "abuelo", "amigo"], tags: ["plantas"] },
  { name: "Chocolates finos", price: 12000, for: "todos", tags: ["cocina"] },
  { name: "Taza personalizada", price: 8000, for: ["amigo", "colega", "hermano", "otro"], tags: ["cafe"] },
  { name: "Cuaderno o agenda bonita", price: 10000, for: ["colega", "amigo", "hermano", "otro"], tags: ["lectura"] },
  { name: "Lego o juego de construcción", price: 30000, for: ["hijo"], tags: ["juegos"] },
  { name: "Kit de arte y manualidades", price: 18000, for: ["hijo"], tags: ["juegos", "hogar"] },
  { name: "Peluche", price: 12000, for: ["hijo", "pareja"], tags: ["juegos"] },
  { name: "Bicicleta o scooter", price: 80000, for: ["hijo"], tags: ["deporte", "viajes"] },
  { name: "Libro ilustrado infantil", price: 12000, for: ["hijo"], tags: ["lectura"] },
  { name: "Pantuflas cómodas", price: 15000, for: ["mama", "papa", "abuelo"], tags: ["hogar", "moda"] },
  { name: "Radio o reproductor sencillo", price: 25000, for: ["abuelo"], tags: ["musica", "tecnologia"] },
];

/** Regalos sugeridos para la persona: afines a la relación y sus gustos, dentro del presupuesto. */
export function suggestGifts(p: GiftPerson, taken: string[], limit = 8) {
  const has = new Set(taken.map((t) => t.toLowerCase().trim()));
  const budget = p.budget > 0 ? p.budget * 1.1 : Infinity;
  return IDEAS
    .filter((i) => (i.for === "todos" || i.for.includes(p.relation)) && i.price <= budget && !has.has(i.name.toLowerCase()))
    .map((i) => ({ ...i, score: i.tags.filter((t) => p.interests.includes(t)).length }))
    .filter((i) => !p.interests.length || i.score > 0)
    .sort((a, b) => b.score - a.score || b.price - a.price)
    .slice(0, limit);
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
/** n-ésimo domingo de un mes (Chile: Día de la Madre = 2º domingo de mayo; del Padre = 3º de junio). */
function nthSunday(y: number, month: number, n: number) {
  const first = new Date(y, month - 1, 1).getDay();
  return iso(y, month, 1 + ((7 - first) % 7) + (n - 1) * 7);
}

/** Próxima fecha de la ocasión (hoy o después). Cumpleaños y aniversarios se repiten cada año. */
export function nextDate(p: Pick<GiftPerson, "occasion" | "date">, today = todayISO()): string {
  const y = Number(today.slice(0, 4));
  const fixed = (yr: number) =>
    p.occasion === "navidad" ? iso(yr, 12, 25)
      : p.occasion === "san-valentin" ? iso(yr, 2, 14)
        : p.occasion === "dia-madre" ? nthSunday(yr, 5, 2)
          : p.occasion === "dia-padre" ? nthSunday(yr, 6, 3)
            : "";
  const f = fixed(y);
  if (f) return f >= today ? f : fixed(y + 1);
  if (!p.date) return "";
  if (p.occasion === "otro") return p.date;
  const md = p.date.slice(5);
  const thisYear = `${y}-${md}`;
  return thisYear >= today ? thisYear : `${y + 1}-${md}`;
}

export function countdownText(date: string) {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { tone: "bad", text: d === -1 ? "Fue ayer" : `Pasó hace ${-d} días`, days: d };
  if (d === 0) return { tone: "warn", text: "¡Es hoy!", days: d };
  if (d <= 14) return { tone: "warn", text: d === 1 ? "Mañana" : `En ${d} días`, days: d };
  return { tone: "", text: `En ${d} días`, days: d };
}
