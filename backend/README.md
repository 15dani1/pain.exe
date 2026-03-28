# Backend (Rahul)

Standalone API service for hackathon demo flow.

## Endpoints

- `POST /api/onboarding`
- `GET /api/dashboard?userId=<id>`
- `POST /api/chat`
- `POST /api/checkin`
- `POST /api/recovery`
- `POST /api/voice/preview`
- `POST /api/demo/reset`

## Quick start

1. Copy env file:
   - `cp .env.example .env`
2. Fill in `MONGODB_URI`.
3. Add voice config if you want ElevenLabs in this service:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID`
   - optional: `ELEVENLABS_MODEL_ID`
4. Install and run:
   - `npm install`
   - `npm run seed`
   - `npm run dev`
5. Run smoke test (optional):
   - `npm run smoke:test`

`/api/chat` currently works without any LLM key and falls back to a deterministic persona reply, so your demo is not blocked if you skip OpenAI.

## Frontend integration

Fernando can point frontend API calls to this backend base URL, for example:
- `http://localhost:4000/api/dashboard?userId=<seededUserId>`

CORS origin is controlled via `FRONTEND_ORIGIN`.

## Contract

Share this file with frontend for stable integration:
- `docs/api-contract.md`
