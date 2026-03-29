# Backend API Contract (Hackathon)

Base URL: `http://localhost:4000`

## POST /api/onboarding
Request:
```json
{
  "name": "Fernando",
  "goalTitle": "Half Marathon",
  "goalType": "Half Marathon",
  "targetDate": "2026-06-20",
  "phoneNumber": "(305) 555-0142",
  "googleCalendarEmail": "fernando.demo@gmail.com",
  "baseline": "Runs 2x/week...",
  "weeklyAvailability": "Weekdays 6 AM",
  "wakeWindow": "5:30 AM wake",
  "injuryLimit": "Avoid back-to-back high impact",
  "trigger": "Call out avoidance",
  "channels": ["In-app", "SMS", "Email"],
  "scheduleConstraints": "Weekdays 6 AM | 5:30 AM wake",
  "escalationTolerance": "Relentless"
}
```
Response:
```json
{ "userId": "<id>" }
```

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
  "escalationEvents": [{ "type": "reminder_sent", "label": "Reminder sent", "at": "2026-03-28T21:01:16.071Z" }],
  "integrations": {
    "garmin": {
      "connected": true,
      "lastSyncAt": "2026-03-29T01:14:13.349Z",
      "status": "strike",
      "strikeCount": 1,
      "lastEvaluation": {
        "matched": false,
        "summary": "No Garmin activity matched 20-min punishment run + commitment to tomorrow; strike applied",
        "matchedActivityType": null,
        "matchedAt": null
      }
    }
  }
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

## POST /api/voice/session/start
Request:
```json
{ "userId": "<optional-id>", "includeGreetingAudio": true }
```
Response:
```json
{
  "ok": true,
  "sessionId": "<id>",
  "userId": "<id>",
  "stage": 2,
  "debtCount": 1,
  "greeting": {
    "text": "This is coach mode...",
    "voice": { "mimeType": "audio/mpeg", "audioBase64": "<base64>" }
  }
}
```

## POST /api/voice/session/:sessionId/turn
Request:
```json
{ "userText": "I skipped today", "includeVoice": true }
```
Response:
```json
{
  "ok": true,
  "coachReply": "...",
  "voice": { "mimeType": "audio/mpeg", "audioBase64": "<base64>" }
}
```

## POST /api/voice/session/:sessionId/end
Request:
```json
{ "reason": "user_hangup" }
```
Response:
```json
{
  "ok": true,
  "sessionId": "<id>",
  "status": "ended",
  "turnCount": 6,
  "endedAt": "2026-03-29T00:00:00.000Z"
}
```

## POST /api/call/start
Request:
```json
{ "userId": "<optional-id>", "phoneNumber": "+13055550142", "includeGreetingAudio": true }
```
Response (Twilio configured):
```json
{
  "ok": true,
  "sessionId": "<id>",
  "userId": "<id>",
  "provider": "twilio",
  "status": "queued",
  "callSid": "CAxxxxxxxx",
  "to": "+13055550142",
  "from": "+1xxxxxxxxxx",
  "stage": 3,
  "debtCount": 2
}
```
Response (fallback if Twilio is not configured or call create fails):
```json
{
  "ok": true,
  "sessionId": "<id>",
  "userId": "<id>",
  "provider": "fallback_in_app",
  "status": "fallback_in_app",
  "note": "Twilio not configured. In-app fallback message posted to escalation feed."
}
```

## POST /api/twilio/voice
Twilio voice webhook for initial call connection. Returns TwiML and starts a gather/reply loop.

## POST /api/twilio/media-stream
Twilio speech gather webhook for conversational turns.

Behavior:
- Reads `SpeechResult` from Twilio
- Stores transcript in Mongo `call_sessions`
- Generates a coach reply (OpenAI if configured, local fallback otherwise)
- Returns TwiML with next prompt and optional ElevenLabs audio playback clip

## POST /api/twilio/status
Twilio call status callback (`initiated`, `ringing`, `in-progress`, `completed`, etc).
Persists status transitions and end-time in `call_sessions`.

## GET /api/call/session/:sessionId/audio/:clipId
Returns generated coach audio clip (`audio/mpeg`) for Twilio `<Play>` in active call sessions.

## POST /api/integrations/garmin/sync
Request:
```json
{
  "userId": "<id>",
  "activities": [
    {
      "activityId": "run-1",
      "name": "Evening Recovery Run",
      "type": "running",
      "startTime": "2026-03-30T00:50:00.000Z",
      "durationMinutes": 24,
      "distanceKm": 3.8,
      "averageHeartRate": 148,
      "steps": 4100
    }
  ]
}
```

Behavior:
- Treats Garmin as the first wearable verification path
- Matches imported activities against `todayTask` using workout type, timing window, and effort threshold
- Marks the task `done` and lowers pressure when Garmin evidence matches the plan
- Applies a strike and escalates the coach response when no Garmin activity matches the planned workout
- Persists sync state in `integrations` and logs the imported evidence in `check_ins`

Response:
```json
{
  "ok": true,
  "matched": false,
  "taskTitle": "20-min punishment run + commitment to tomorrow",
  "expectedType": "run",
  "expectedDurationMinutes": null,
  "activityCount": 1,
  "matchedActivity": null,
  "strikeApplied": true,
  "feedback": "Now we're into excuses territory...",
  "status": "missed",
  "debtCount": 2,
  "stage": 3,
  "recoveryAction": { "title": "...", "description": "..." },
  "idempotentReplay": false
}
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
