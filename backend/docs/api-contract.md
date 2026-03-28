# Backend API Contract (Hackathon)

Base URL: `http://localhost:4000`

## GET /api/dashboard
Query params:
- `userId` (required)

Response:
```json
{
  "user": { "name": "Demo User" },
  "todayTask": { "title": "20-min punishment run + commitment to tomorrow", "dueAt": "2026-03-29T23:01:16.071Z", "status": "missed" },
  "debtCount": 1,
  "escalation": { "stage": 2, "lastActionAt": "2026-03-28T23:01:16.071Z" },
  "recentMessages": [{ "role": "coach", "content": "You said Thursday. It's Saturday.", "sentAt": "2026-03-28T23:01:16.071Z" }],
  "recoveryAction": { "title": "20-min punishment run + commitment to tomorrow", "description": "Complete this today to clear debt and reset momentum." },
  "escalationEvents": [{ "type": "reminder_sent", "label": "Reminder sent", "at": "2026-03-28T21:01:16.071Z" }]
}
```

## POST /api/chat
Request:
```json
{ "userId": "<id>", "message": "I missed it", "includeVoice": true }
```
Response:
```json
{
  "role": "coach",
  "content": "...",
  "sentAt": "2026-03-28T23:20:00.000Z",
  "voice": { "mimeType": "audio/mpeg", "audioBase64": "<base64>" }
}
```
If voice generation fails, chat still returns text with:
```json
{
  "role": "coach",
  "content": "...",
  "sentAt": "...",
  "voice": null,
  "voiceError": { "error": "Failed to generate chat voice preview", "code": "VOICE_UNAVAILABLE", "detail": "..." }
}
```

## POST /api/checkin
Request:
```json
{ "userId": "<id>", "status": "missed", "eventId": "missed-2026-03-28-task-1" }
```
Notes:
- `eventId` is optional but recommended for deterministic idempotency on missed events.
- You can also send `x-idempotency-key` header (takes precedence over `eventId`).

Response:
```json
{
  "ok": true,
  "status": "missed",
  "debtCount": 2,
  "stage": 3,
  "recoveryAction": { "title": "...", "description": "..." },
  "idempotentReplay": false,
  "eventKey": "missed-2026-03-28-task-1"
}
```

## POST /api/recovery
Request:
```json
{ "userId": "<id>", "action": "accept" }
```
Response:
```json
{ "ok": true, "action": "accept", "debtCount": 0 }
```

## POST /api/voice/preview
Request:
```json
{ "text": "You said Thursday. It's Saturday." }
```
Response:
```json
{ "mimeType": "audio/mpeg", "audioBase64": "<base64>" }
```

## Limits

- `/api/chat`: max `30 requests/min` per client IP, `message <= 1200 chars`
- `/api/voice/preview`: max `20 requests/min` per client IP, `text <= 400 chars`

## POST /api/demo/reset
Request:
```json
{ "userId": "<optional-id>" }
```
If `userId` is omitted, backend resets `demo@painexe.local`.

Response:
```json
{ "ok": true, "userId": "<id>", "debtCount": 1, "stage": 2 }
```

## GET /api/demo/state
Query params:
- `userId` (optional; defaults to seeded `demo@painexe.local`)

Response:
```json
{
  "ok": true,
  "userId": "<id>",
  "user": { "name": "Demo User" },
  "taskStatus": "missed",
  "debtCount": 1,
  "stage": 2,
  "recoveryAction": { "title": "...", "description": "..." },
  "updatedAt": "2026-03-29T00:00:00.000Z"
}
```

## Error shape
```json
{ "error": "Human readable message", "code": "VALIDATION_ERROR", "detail": "Optional debug details" }
```
