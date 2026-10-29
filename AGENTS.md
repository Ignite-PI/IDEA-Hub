# SBF Tower Portfolio Hub

Tracks SBF Tower ideas/projects and their Project Charters (with Word/PDF export).

## Stack
- Frontend: React 18 + Vite 5 + TypeScript, react-router (data router), recharts, lucide-react. Plain CSS design system in `src/styles.css` (brand palette as CSS variables).
- Backend: Express + sql.js (SQLite in JS) in `server/` (CommonJS `.cjs`, since package is `"type": "module"`). DB file: `server/data/sbf_tower.sqlite` (override with `SBF_DB_PATH`). Port 3002 (override with `PORT`). The server also serves `dist/`.
- Exports: `src/utils/exportCharter.ts` (docx + jspdf/jspdf-autotable, lazy-loaded). Filenames: `<ProjectTitle>_ProjectCharter.docx|pdf`.

## Commands (Node is not on PATH by default)
- Node: `C:\Users\al01683\Downloads\nodejs\node-v20.18.1-win-x64` (add to PATH first)
- Dev: `node server/server.cjs` + `npm run dev` (Vite on 5174 proxies `/api` to 3002)
- Typecheck: `npx tsc --noEmit -p .`
- Build: `npx vite build` (or `npm run build` = tsc + vite)
- Run prod: `START SBF DASHBOARD.bat` (builds, then serves on http://localhost:3002)

## Notes
- Project statuses are fixed: Idea, Assessing, Validated, Approved, In Delivery, Implemented, On Hold, Cancelled (`src/types.ts`, validated server-side too).
- Project Link is free text — never validate it as a URL. `src/utils/links.ts` resolves what it can (web, app protocols, UNC/drive paths) and the UI always offers copy.
- Charter status: no row = Not Started; saved = In Progress or Completed (user chooses). One charter per project (`charters.project_id` PK).
- Character art: originals live in `../Characters` and must not be modified. Web copies (background removed, resized) are generated into `public/characters/` by `python scripts/prepare_characters.py` (needs Pillow).
