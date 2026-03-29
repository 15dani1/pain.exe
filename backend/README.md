# Backend (Rahul)

Standalone API service for hackathon demo flow.

## Endpoints

- `POST /api/onboarding`
- `GET /api/dashboard?userId=<id>`
- `POST /api/chat`
- `POST /api/checkin`
- `POST /api/recovery`
- `POST /api/voice/preview`
- `POST /api/voice/session/start`
- `POST /api/voice/session/:sessionId/turn`
- `POST /api/voice/session/:sessionId/end`
- `POST /api/call/start`
- `POST /api/twilio/voice`
- `POST /api/twilio/media-stream`
- `POST /api/twilio/status`
- `GET /api/call/session/:sessionId/audio/:clipId`
- `GET /api/demo/state`
- `POST /api/demo/reset`

## Quick start

1. Copy env file:
   - `cp .env.example .env`
2. Fill in `MONGODB_URI`.
3. Add voice config if you want ElevenLabs in this service:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID`
   - optional: `ELEVENLABS_MODEL_ID`
4. Add Twilio config if you want real outbound phone calls:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM_NUMBER`
   - `TWILIO_WEBHOOK_BASE_URL` (public base URL Twilio can reach, for example ngrok tunnel)
   If Twilio config is missing, `POST /api/call/start` falls back to an in-app coach escalation message.
5. Install and run:
   - `npm install`
   - `npm run seed`
   - `npm run dev`
   - optional schema alignment for existing demo docs: `npm run backfill:frontend-schema`
6. Run smoke test (optional):
   - `npm run smoke:test`
7. Run full demo readiness check:
   - `npm run demo:ready`

`/api/chat` currently works without any LLM key and falls back to a deterministic persona reply, so your demo is not blocked if you skip OpenAI.

## Voice Safety Requirement

- Only use ElevenLabs voice IDs that you are authorized to use.
- Do not clone or impersonate a real person without explicit permission.
- For public demos, prefer licensed/synthetic voices to avoid rights and policy issues.

## Frontend integration

Fernando can point frontend API calls to this backend base URL, for example:
- `http://localhost:4000/api/dashboard?userId=<seededUserId>`

CORS origin is controlled via `FRONTEND_ORIGIN`.

## Contract

Share this file with frontend for stable integration:
- `docs/api-contract.md`

## Status Tracking

Backend implementation checklist with completed items:
- `docs/backend-progress.md`

## Runtime Limits

- `POST /api/chat`: `30 req/min` per IP, message max `1200` chars
- `POST /api/voice/preview`: `20 req/min` per IP, text max `400` chars
- `POST /api/chat` supports `includeVoice: true` to return coach audio in the same response
- If chat voice generation fails, `/api/chat` still returns text plus `voiceError` (degraded mode)
- `POST /api/checkin` missed events are idempotent per event key (`eventId` body or `x-idempotency-key` header)
