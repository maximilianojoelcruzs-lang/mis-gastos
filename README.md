# Mis Gastos

App para controlar gastos del mes, lista del supermercado y próximas compras.
Hecha con **Next.js (App Router + TypeScript)**, **Supabase** (login y datos) y **Gemini** (búsqueda de precios con IA).

## Estructura

```
app/
  layout.tsx, page.tsx, globals.css   → frontend (Next.js)
  api/
    data/route.ts          GET/PUT  datos del usuario (valida y normaliza en el servidor)
    resumen/route.ts       GET      totales por mes, supermercado y próximas compras
    buscar-precio/route.ts GET      precio más bajo en Chile vía Gemini (requiere sesión)
    health/route.ts        GET      estado del servicio
components/                → pantallas y pestañas (Gastos, Supermercado, Próximas compras)
lib/
  data.ts                  → datos de ejemplo, normalización y cálculos (compartido front/back)
  api.ts                   → cliente del backend (agrega el token de sesión)
  gemini.ts                → integración con Gemini
  supabase/                → cliente del navegador y validación de sesión en el servidor
```

Todas las rutas `/api/*` (salvo `health`) exigen el header `Authorization: Bearer <token de Supabase>`.
El servidor usa ese token para hablar con Supabase, así que las políticas RLS de la tabla `user_data` se siguen aplicando.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completa GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

## Despliegue en Vercel

1. En el proyecto de Vercel, *Settings → General → Framework Preset*: **Next.js**.
2. *Settings → Environment Variables*: `GEMINI_API_KEY` (y opcionalmente `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_MODEL`).
3. Vuelve a desplegar.

## Ideas para seguir expandiendo el backend

- Nuevas rutas en `app/api/<nombre>/route.ts` reutilizando `requireUser()`.
- Tareas programadas con Vercel Cron (ej. recordatorio de cuentas por pagar).
- Exportar a CSV/Excel desde `/api/resumen`.
- Tablas propias en Supabase (gastos por fila en vez de un JSON) cuando necesites consultas más potentes.
