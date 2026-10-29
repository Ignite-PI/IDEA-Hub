# SBF Project Hub (IGNITE)

Tracks SBF Tower ideas/projects, Project Charters (Word/PDF export), CURES timelines (Gantt) and status history.
Production: https://idea-hub-zeta.vercel.app (Vercel project `idea-hub`, team `ignite-0813`).

## Architecture
- Frontend: React 18 + Vite 5 + TypeScript, react-router data router, plain CSS (`src/styles.css`). Built to `dist/`.
- API: Express app in `server/app.cjs` (CommonJS `.cjs`; package is `"type": "module"`).
  - Vercel: `api/index.js` exports the app as a Vercel Function; `vercel.json` rewrites `/api/*` → function and everything else → `index.html`.
  - Local: `server/server.cjs` = same app + static `dist/` on port 3002.
- Data layer: routes → `server/repositories/index.cjs` (contract documented there) → provider. Never use a driver from routes.
  - `postgres` (production, Neon via Vercel Marketplace). Auto-selected on Vercel / when a `*DATABASE_URL` env var exists (Vercel added prefix `SBF_PROJECT_HUB_`). Schema: `server/repositories/pg/schema.cjs` (additive migrations, `schema_migrations` table, run on cold start).
  - `pglite` (same Postgres repo, embedded; `DATA_PROVIDER=pglite PGLITE_DIR=...`) for local tests.
  - `sqlite` (legacy sql.js file `server/data/sbf_tower.sqlite`) — local default without a DB URL. NOT usable on Vercel (read-only FS).
  - Legacy → Postgres: `scripts/migrate-sqlite-to-postgres.cjs` (direct, or `--export file.json` then POST to `/api/admin/import` while signed in). Idempotent, non-destructive.
- Files: no binary files are stored. Word/PDF are generated in the browser. If attachments are added, store blobs in Vercel Blob (free tier) and only URL/metadata in Postgres.
- Auth: single shared account (`server/auth.cjs`, `server/routes/auth.cjs`). Env: `AUTH_USERNAME`=IGNITE, `AUTH_PASSWORD_HASH` (scrypt, from `node scripts/hash-password.cjs`), `AUTH_SECRET` (signs HttpOnly `sbf_session` cookie, 12h). All `/api` except `/api/auth/*` and `/api/health` require the session; mutating requests also need header `X-SBF-Client: 1`. Failed logins throttled per IP in `login_attempts`. Rotating `AUTH_SECRET` signs everyone out. The plain password is never stored in code/repo/bundle.
- AI: `server/ai/*` (Azure OpenAI, optional). Not configured → UI shows a friendly message; nothing else depends on it.

## Rules
- Project Status, Charter Status, Charter Completeness and Timeline Progress are independent. Charter save/complete/download and timeline changes NEVER change project status or write status history.
- Charter "Completed" requires all sections (see `charterMissing` in `src/utils/charter.ts`); drafts can be saved anytime.
- Timeline Progress = completed activities / entered activities × 100. Gantt is built only from real `timeline_activities`.
- Key Metrics start with one row; "+ Add Key Metric" adds rows.
- Project Link is free text — never validate as URL.
- Originals in `../Characters` and `../PROJECT CHARTER TEMPLATE` must not be modified; web copies in `public/characters` (WebP used by the app) and `public/brand`.
- Windows PowerShell 5.1 `Get-Content`/`Set-Content` corrupts UTF-8 — edit files with the editor tools.
- Stay within free tiers (Vercel Hobby, Neon Free). Stop and ask before anything paid.

## Commands (Node is not on PATH by default)
- Node: `C:\Users\al01683\Downloads\nodejs\node-v20.18.1-win-x64` (prepend to PATH)
- Corporate TLS inspection: Node needs the Windows root CAs → export them to a PEM and set `NODE_EXTRA_CA_CERTS` before running the Vercel CLI or calling external HTTPS.
- Typecheck: `npx tsc --noEmit -p .`   Build: `npx vite build`
- Local: `node server/server.cjs` (reads `.env`: AUTH_* values) → http://localhost:3002
- Deploy: `npx vercel@64.5.0 deploy --prod --yes` (project already linked in `.vercel/`). The GitHub repo must also receive the same source, otherwise a later Git push redeploys old code.
- Vercel env vars: `vercel env ls` / `vercel env add NAME production --sensitive` (pipe the value via stdin).
