# Frontend (Fernando)

Next.js App Router trainee console for the hackathon demo.

## What Is Implemented

- trainee-first onboarding flow
- saved plans and selected settings view
- daily command center
- escalation timeline
- message loop
- integration status cards
- local stub endpoints for demo wiring

## Local Development

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Backend Integration

1. Copy the frontend env file:
   - `cp .env.example .env.local`
2. Set `BACKEND_BASE_URL` if Rahul's backend is not running at `http://127.0.0.1:4000`
3. Start Rahul's backend from [backend/README.md](/Users/fzapata99/Documents/pain.exe/pain.exe/backend/README.md)

The frontend now proxies live requests for onboarding, demo bootstrap, dashboard, chat, check-in, and recovery through its own `/api/*` routes.

## Key Files

- [src/app/page.tsx](/Users/fzapata99/Documents/pain.exe/pain.exe/frontend/src/app/page.tsx)
- [src/components/home-page.tsx](/Users/fzapata99/Documents/pain.exe/pain.exe/frontend/src/components/home-page.tsx)
- [src/components/onboarding-wizard.tsx](/Users/fzapata99/Documents/pain.exe/pain.exe/frontend/src/components/onboarding-wizard.tsx)
- [src/lib/demo-data.ts](/Users/fzapata99/Documents/pain.exe/pain.exe/frontend/src/lib/demo-data.ts)

## Current API Stubs

- `GET /api/demo` now proxies backend demo bootstrap and dashboard state
- `POST /api/onboarding` now proxies Rahul's backend onboarding flow

The remaining client-side-only persistence is saved plan/settings history for fields the backend does not yet expose in plan/goal listing endpoints.

## Next Integration Step

Point the frontend at the backend contract documented in [backend/docs/api-contract.md](/Users/fzapata99/Documents/pain.exe/pain.exe/backend/docs/api-contract.md), especially:

- `GET /api/dashboard`
- `POST /api/onboarding`
- `POST /api/checkin`
- `POST /api/recovery`
- `POST /api/chat`
