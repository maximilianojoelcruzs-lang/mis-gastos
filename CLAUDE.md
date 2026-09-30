# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Mis Gastos: personal-finance PWA-style app (Next.js App Router + TypeScript + Supabase), deployed on Vercel. The UI copy is Spanish (Chile); keep new user-facing text in Spanish.

## Commands

- `npm run dev` / `npm run build` / `npm start` — Next.js (build also type-checks).
- `npm run typecheck` — `tsc --noEmit`. After deleting/renaming an API route, `rm -rf .next` first or stale `.next/types` will fail the check.
- There is **no linter and no test suite**. Verify with typecheck + build, then drive the UI in a browser (Playwright/Chromium is preinstalled in the cloud env). `/api/*` needs a Supabase bearer token, so tests mock `**/api/data` and `**/rest/v1/**` and seed `localStorage["sb-uzutgrejzbxezkvhezuw-auth-token"]` with a fake session.
- `lib/speech.ts` has no imports on purpose, so it can be compiled and tested alone (`npx tsc lib/speech.ts --outDir <dir> --module commonjs`).

## Architecture

**One JSON document per user.** All app data (`AppData` in `lib/types.ts`) lives in a single row of Supabase table `user_data` (`user_id`, `content`, `updated_at`).
- `components/Tracker.tsx` loads it via `GET /api/data`, holds it in React state, and autosaves the *entire* document with `PUT /api/data` 600 ms after any change.
- Mutate only through `update((draft) => …)`: it `structuredClone`s the state and hands you a draft. `setData` replaces it wholesale.
- API routes (`app/api/*`) authenticate with `requireUser()` (`lib/supabase/server.ts`), which forwards the caller's bearer token to Supabase, so RLS applies. There is no service-role key; don't add one.

**`lib/data.ts` is the shared brain** (runs in browser *and* server): seed data, `normalize()`, and all calculations (`summarizeMonth`, `splitPayment`, `buildNextMonth`, `storeComparison`, …).
- `normalize()` is the migration layer (v3 → v5) and runs on every load and every save. **Any new field must be added in three places:** `lib/types.ts`, the seed, and `normalize()`; otherwise old documents or the server will drop it.
- Money semantics: a daily expense paid with a benefit card counts against the salary only for its pocket part (`amount − cardAmount`); `MonthSummary.balance = income − bills − pocket daily`. Daily expenses attach to a month via `Month.period` ("YYYY-MM").

**Conventions that span files**
- Format money only with `clp()` / `compact()` / `CurrencyInput` (`lib/format.ts`, `components/CurrencyInput.tsx`). Privacy mode works by `Tracker` calling `setPrivacy()` during render so these helpers return dots; raw `toLocaleString` bypasses it. `CurrencyInput` keeps the same text on focus and selects it (swapping formats on focus made typing append to the old amount).
- Theming is CSS variables in `app/globals.css` (dark default, light via `[data-theme]` or system). Category colors are palette keys rendered through `catColor()` → `var(--p-<key>)`, with dark/light variants validated for contrast; don't hard-code hex in components.
- Client preferences (theme, privacy, last payer, market view) live in `localStorage`, not in the document.

**Shared supermarket list** (`lib/useSharedList.ts`, `components/SharedListCard.tsx`, `supabase/shared_lists.sql`): syncs `market.items` with Supabase tables, one row per item, polled every 5 s (no Realtime).
- Dirty detection is by content hash, so mutation sites never bump timestamps; last write wins per item using server time; deletes are tombstones (`deleted`); a pending local change beats an incoming remote one.
- The SQL (tables, RLS, `create/join/leave_shared_list` functions) must be run manually in the Supabase SQL Editor; the UI shows a message when it is missing. It was verified against a local Postgres 16 with stubbed `auth.uid()/auth.jwt()`.
- Members can only touch the tables through those functions and RLS; keep it that way when editing the SQL.

**Auth**: email/password via `lib/supabase/client.ts`. `components/App.tsx` switches between `Login` (login / signup / forgot), `NewPassword` (on the `PASSWORD_RECOVERY` event) and `Tracker`. Sign-up and the recovery redirect need Supabase dashboard settings (see README).

**Config**: `lib/config.ts` reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` with hardcoded defaults for the current project (the anon key is public by design; security is RLS). Excel/PDF export (`lib/export.ts`) is client-side and lazy-loads `write-excel-file` and `jspdf`.

## Workflow

Vercel (Next.js preset) builds a preview for every PR and reports a `Vercel` status check. Work happens on `claude/*` branches with PRs into `main`; don't merge unless the user explicitly asks.
