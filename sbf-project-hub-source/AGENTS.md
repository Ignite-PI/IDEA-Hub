# SBF Project Hub (IGNITE)

Tracks SBF Tower ideas/projects, their Project Charters (Word/PDF export), CURES timelines (Gantt) and status history, with an Azure OpenAI writing assistant.

## Stack
- Frontend: React 18 + Vite 5 + TypeScript, react-router (data router), recharts, lucide-react. Plain CSS design system in `src/styles.css`.
- Backend: Express in `server/` (CommonJS `.cjs` because package is `"type": "module"`). Serves `dist/` + `/api`. Port 3002 (`PORT`).
- Data layer: routes → `server/repositories/index.cjs` (contract documented there) → `sqliteRepository.cjs` → `server/db.cjs` (sql.js). Swap engines by adding a repository and setting `DATA_PROVIDER`. Never call `db.cjs` from routes.
- DB file: `server/data/sbf_tower.sqlite` (`SBF_DB_PATH` to override). Migrations in `db.cjs` are additive/idempotent (tracked in `meta` table) — never drop data. Backups: `server/data/backups/`.
- Tables: projects, charters (JSON `data`), status_history, timeline_activities, meta.
- AI: `server/ai/azureOpenAI.cjs` (Azure OpenAI Chat Completions REST) + `server/ai/prompts.cjs` (server-side prompt whitelist). Routes `/api/ai/status|assist|chat`. Credentials only via env / `.env` (see `.env.example`; `.env` is git-ignored and loaded with `process.loadEnvFile`). Never put keys in `src/`.
- Exports: `src/utils/exportCharter.ts` — page 1 mirrors `../PROJECT CHARTER TEMPLATE/PROJECT CHARTER TEMPLATE.pptx` (landscape, navy #1A3673, label fill #E1EDFF); page 2 = deliverables, RACI, milestones, CURES activities.

## Rules
- Project Status (Idea…Cancelled) and Charter Status (Not Started/In Progress/Completed) are independent. Saving/completing/downloading a charter or changing a timeline activity must NEVER change project status or write status history.
- Status history is written only by `updateProject` when status actually changes.
- Timeline Progress = completed activities / entered activities × 100 (not charter completeness).
- Gantt is generated only from user-entered `timeline_activities`.
- AI output is always a suggestion: never overwrite a field without the user choosing Replace/Insert.
- Project Link is free text — never validate as URL.
- Character/logo originals in `../Characters` must not be modified; web copies live in `public/characters` and `public/brand`.
- Windows PowerShell 5.1 `Get-Content`/`Set-Content` corrupts UTF-8 files — edit files with the editor tools, not PowerShell replace.

## Commands (Node is not on PATH by default)
- Node: `C:\Users\al01683\Downloads\nodejs\node-v20.18.1-win-x64` (prepend to PATH)
- Typecheck: `npx tsc --noEmit -p .`
- Build: `npx vite build`
- Run: `node server/server.cjs` or `START SBF DASHBOARD.bat` (builds then serves http://localhost:3002)
- Dev: `node server/server.cjs` + `npm run dev` (Vite 5174 proxies `/api` → 3002)
- Testing AI without Azure: point `AZURE_OPENAI_ENDPOINT` at a local mock of the Chat Completions API (deployment path `/openai/deployments/<name>/chat/completions`).
