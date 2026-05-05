# MiFBEMS Deployment Transfer Guide (Vercel)

This repository is split into two deployable apps:
- `client/` (React + Vite frontend)
- `server/` (Express API, deployed as Vercel serverless function)

## 1) Before Transfer
- Push this repo to GitHub/GitLab.
- Ensure sensitive `.env` values are not committed.
- Use `.env.example` files to populate Vercel environment variables.

## 2) Create Vercel Project: Backend (`server/`)
1. In Vercel, create a new project from this repo.
2. Set **Root Directory** to `server`.
3. Framework preset: `Other`.
4. Build command: `npm run build`.
5. Install command: `npm install`.
6. Output directory: leave empty.
7. Add environment variables from `server/.env.example`.

Important:
- `DATABASE_URL` should use Supabase transaction pooler (`:6543`).
- `DIRECT_URL` should use direct connection (`:5432`) for migrations.
- For cross-domain cookie refresh, keep:
  - `COOKIE_SAME_SITE=none`
  - `NODE_ENV=production`

## 3) Create Vercel Project: Frontend (`client/`)
1. Create a second Vercel project from the same repo.
2. Set **Root Directory** to `client`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add env vars from `client/.env.example`.

Set:
- `VITE_API_BASE_URL=https://<your-backend-domain>.vercel.app/api/v1`

## 4) CORS Setup
Set backend env values:
- `FRONTEND_ORIGIN=https://<your-frontend-domain>.vercel.app`
- `FRONTEND_ORIGINS=https://<your-frontend-domain>.vercel.app,https://<preview-domain>.vercel.app`

## 5) Database Schema Sync (First Deploy)
Run from local machine in `server/`:
1. `npx prisma generate`
2. `npx prisma db push`
3. `npx prisma db seed`

If you have migration drift in shared DB, use `db push` first to avoid destructive reset.

## 6) Required Supabase Storage Buckets
Create these buckets:
- `project-images` (for project image attachments)
- `boundaries` (if using map boundary files from storage)

## 7) Smoke Test After Deploy
- Frontend loads and can call `/api/v1/auth/login`.
- Login sets refresh cookie successfully.
- `/health` responds on backend deployment.
- Project create/upload/import flows work.

## 8) Notes
- `client/vercel.json` includes SPA rewrite to `index.html`.
- `server/vercel.json` routes all paths to `api/index.ts` (Express app entry).
