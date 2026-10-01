# Mis Gastos

App para controlar gastos del mes, lista del supermercado y próximas compras.
Hecha con **Next.js (App Router + TypeScript)** y **Supabase** (login y datos).

## Funciones

- **Panel:** ahorro del período con filtro (3/6 meses, este año, todo), gastos por mes apilados por categoría,
  comparación con el mes anterior, proyección de cierre, disponible por día, **resumen anual**, **tu semana**
  (con texto para compartir por WhatsApp), **distribución por categoría** (dona), **límites por categoría**,
  gasto **por etiqueta** y **reporte PDF del mes con un clic**.
- **Cuentas (gastos mensuales):** varios ingresos, meta de ahorro, categorías con colores, gastos fijos que se
  copian al crear el mes siguiente, vencimientos con alertas y compras en cuotas que avanzan solas.
- **Gastos diarios:** anota micro-gastos (café, almacén, micro) en segundos; se descuentan del presupuesto del mes.
  El botón **+** (gasto rápido) está disponible en todas las pantallas y puede pagarse con una tarjeta de alimentación.
  La categoría se **aprende de tu historial** (si antes pusiste "Pelu Rocío" en Salud, la próxima vez lo sugiere),
  admite **etiquetas** libres (`#viaje`, `#remodelación`) y **gastos compartidos**: eliges con quién lo divides y
  quién pagó, y *Cuentas claras* muestra quién le debe a quién (con botón "Saldar"). En el presupuesto solo cuenta tu parte.
- **Supermercado:** lista por pasillo, **presupuesto mensual del súper**, **tarjetas de alimentación** (Amipass,
  Sodexo, Edenred u otra) que reparten la compra entre la tarjeta y tu bolsillo, **modo tienda** (pantalla grande y
  siempre encendida), **dictado por voz**, productos que compras seguido, **lista compartida en pareja o familia**,
  precios por supermercado con comparación, historial y listas guardadas.
- **Próximas compras:** prioridad, fecha objetivo con cuenta regresiva, ahorro por objetivo y Google Shopping.
- **Buscador** (`/` o `Ctrl/Cmd+K`), **exportar a Excel y PDF**, **modo claro/oscuro/automático**,
  **modo privado** (oculta los montos), **categorías con límite mensual** y **supermercados propios** (Ajustes).
- **Compartir mis finanzas con roles:** invitas con un código a tu pareja o familia como **lector** (solo ve) o
  **editor** (ve y cambia). Puedes cambiar el permiso o quitar el acceso cuando quieras.
- **Cuenta:** crear cuenta, "olvidé mi contraseña" y cambio de contraseña.

Los datos guardados con versiones anteriores se migran solos al abrir la app (`normalize()` en `lib/data.ts`).

## Estructura

```
app/
  layout.tsx, page.tsx, globals.css   → frontend (Next.js)
  api/
    data/route.ts          GET/PUT  datos del usuario o de quien te los compartió (?owner=), con control de versiones (409)
    resumen/route.ts       GET      totales por mes, supermercado y próximas compras
    health/route.ts        GET      estado del servicio
components/                → pantallas (Panel, Cuentas, Gastos diarios, Supermercado, Próximas compras, Ajustes)
lib/
  data.ts                  → datos de ejemplo, normalización y cálculos (compartido front/back)
  speech.ts                → convierte "leche, 2 panes y huevos" en productos
  useSharedList.ts         → sincronización de la lista compartida
  useSpaces.ts             → invitaciones y roles para compartir tus finanzas
  export.ts                → exportación a Excel y PDF
  api.ts                   → cliente del backend (agrega el token de sesión)
  supabase/                → cliente del navegador y validación de sesión en el servidor
supabase/
  shared_lists.sql         → tablas, seguridad (RLS) y funciones de la lista compartida
  data_sharing.sql         → roles lector/editor para compartir tus finanzas
```

Todas las rutas `/api/*` (salvo `health`) exigen el header `Authorization: Bearer <token de Supabase>`.
El servidor usa ese token para hablar con Supabase, así que las políticas RLS de la tabla `user_data` se siguen aplicando.

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev                  # http://localhost:3000
```

## Configurar el registro y la recuperación de contraseña (Supabase)

En el panel de Supabase, *Authentication*:

1. *Providers → Email*: deja activado **Allow new users to sign up**. Si activas *Confirm email*, quien se registre
   recibirá un correo para confirmar la cuenta.
2. *URL Configuration*: en **Site URL** pon la dirección de tu app (por ejemplo `https://tu-app.vercel.app`) y agrégala
   también a **Redirect URLs**. Sin esto, el enlace del correo de "olvidé mi contraseña" no vuelve a la app.

## Activar la lista compartida (Supabase)

La lista compartida usa tres tablas nuevas. Solo hay que hacerlo una vez:

1. En Supabase abre **SQL Editor**, pega el contenido de [`supabase/shared_lists.sql`](supabase/shared_lists.sql) y presiona **Run**.
2. Listo: en *Súper → Lista compartida* una persona crea la lista y comparte el código; la otra se une con él.

Cómo funciona: cada producto es una fila, así que dos personas pueden editar a la vez sin pisarse (en un choque gana
el último cambio, con la hora del servidor). La app consulta cambios cada 5 segundos mientras está abierta.
Solo los participantes ven la lista (RLS), el código tiene 10 caracteres y cada lista admite hasta 8 personas.
Si el SQL no se ha ejecutado, la app lo avisa en pantalla.

## Activar "Compartir mis finanzas" (Supabase)

1. En Supabase abre **SQL Editor**, pega el contenido de [`supabase/data_sharing.sql`](supabase/data_sharing.sql) y presiona **Run**.
2. En *Ajustes → Compartir mis finanzas* eliges el permiso, creas un código y se lo pasas a la otra persona; ella lo
   escribe en *Unirme con un código* (con su propia cuenta).

Cómo funciona: crea las tablas `data_members` y `data_invites` y **suma** dos políticas a `user_data` (lectores leen,
editores además actualizan); las del dueño no se tocan. Los códigos sirven una vez y vencen en 7 días; máximo 5 personas.
Cada guardado envía la versión que tenías: si otra persona u otro dispositivo guardó entre medio, el servidor responde
409 y la app carga la versión más reciente en vez de pisarla. Además revisa cambios cada 30 segundos.

## Despliegue en Vercel

1. En el proyecto de Vercel, *Settings → General → Framework Preset*: **Next.js**.
2. *Settings → Environment Variables* (opcional): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Vuelve a desplegar.

## Ideas para seguir expandiendo el backend

- Nuevas rutas en `app/api/<nombre>/route.ts` reutilizando `requireUser()`.
- Tareas programadas con Vercel Cron (ej. recordatorio de cuentas por pagar).
- Exportar a CSV/Excel desde `/api/resumen`.
- Tablas propias en Supabase (gastos por fila en vez de un JSON) cuando necesites consultas más potentes.
