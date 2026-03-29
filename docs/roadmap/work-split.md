# Work Split — 8-Hour Hackathon

Two people, one demo. Everything is cut to the minimum needed to make the demo story land.

## The Only Thing That Needs to Work

Seeded user opens the app → sees an overdue workout → escalation is visible and building → coach sends a message (in-app) → recovery option is offered.

That's the demo. Build only what serves that story.

## What We're Not Building

- Real Twilio SMS or voice calls (show a "call placed" card, not a real call)
- Real Google Calendar sync (stub it)
- Wearable integration (out of scope)
- Plan regeneration logic (seed the plan)
- Worker/queue infrastructure (fake delays with setTimeout or just preload state)
- Real auth (one hardcoded demo account, or Clerk in 10 minutes if needed)
- Multi-persona, configurable escalation (hardcode the Goggins persona)

---

## Hour-by-Hour Schedule

| Hours | Both |
|---|---|
| 0–1 | Setup together: repo, env vars, DB connection, seeded data script, agree on API shapes |
| 1–4 | Split (see below) |
| 4–5 | Integrate: frontend hits real endpoints, fix what's broken |
| 5–7 | Split (see below) |
| 7–8 | Freeze code, run demo script 3x, fix only critical blockers |

---

## Fernando — Frontend

**Stack:** Next.js App Router, Tailwind, shadcn/ui

### Hours 1–4
- [x] App shell (layout, nav, fonts, color tokens)
- [x] Onboarding flow — 3 screens max: goal + target date, schedule constraints, escalation tolerance. Now proxies Rahul's backend onboarding endpoint through the frontend.
- [x] Daily command center skeleton — today's mission card, countdown clock, compliance score

### Hours 5–7
- [x] Message thread — scrollable list of coach messages
- [x] Escalation ladder — visual showing current stage
- [x] Recovery action card — "Do this instead" CTA surface is present in the command center
- [x] Missed workout debt banner — debt and urgency are visible in the command center

### Integration Status
- [x] Rahul's backend covers the demo-critical API surface
- [x] Fernando's frontend covers the demo-critical UI surface
- [x] Frontend data fetching and actions are now proxied to backend `/api/dashboard`, `/api/onboarding`, `/api/checkin`, `/api/recovery`, and `/api/chat`
- [ ] Remaining blocker: configure `MONGODB_URI` and run Rahul's backend service locally for end-to-end runtime verification
- [ ] Next backend improvement: expose plan/goal listing endpoints so saved plan history can be fully backend-backed instead of partially client-persisted
- [x] Backend onboarding persistence now stores frontend-facing profile/goal context fields in Mongo (`phoneNumber`, `googleCalendarEmail`, `goalType`, `baseline`, `weeklyAvailability`, `wakeWindow`, `injuryLimit`, `trigger`, `channels`)
- [x] Existing seeded demo records backfilled in Mongo via `npm run backfill:frontend-schema`
- [ ] Next backend alignment: add read endpoints for plan/goal history (`GET /api/plans`, `GET /api/goals`) so frontend no longer needs client-side stubs for onboarding summary history
- [ ] Next backend alignment: add optional migration path for non-demo existing users to populate missing onboarding schema fields

**Demo-critical visual:** the dashboard should look dramatic when a workout is missed. Think red debt counter, escalation stage highlighted, coach message visible.

---

## Rahul — Backend

**Stack:** Next.js API routes, MongoDB, Vercel AI SDK (or direct OpenAI/Anthropic call)

### Hours 1–4
- [x] MongoDB connection + 4 collections: `users`, `goals`, `plans`, `escalations`
- [x] Seed script — one demo user, one goal, a plan with yesterday's run marked missed, escalation at stage 2
- [x] `POST /api/onboarding` — creates user + goal record
- [x] `GET /api/dashboard` — returns today's task, escalation state, recent messages, debt count

### Hours 5–7
- [x] `POST /api/chat` — takes user message + context (missed workouts, escalation stage), calls LLM, returns coach reply with persona baked into system prompt
- [x] `POST /api/checkin` — marks task complete or missed, advances escalation stage
- [x] `POST /api/recovery` — accepts or snoozes a recovery action, logs resolution
- [x] Fake escalation log — hardcode a timeline of "reminder sent", "SMS sent", "call placed" events that the frontend can display

---

## Contracts (agree before splitting)

```ts
// GET /api/dashboard response shape
{
  user: { name: string }
  todayTask: { title: string; dueAt: string; status: "pending" | "missed" | "done" }
  debtCount: number               // missed workouts not yet resolved
  escalation: { stage: 1|2|3|4|5; lastActionAt: string }
  recentMessages: { role: "coach"|"user"; content: string; sentAt: string }[]
  recoveryAction: { title: string; description: string } | null
}
```

Agree on this in hour 0. Fernando mocks it with static JSON while Rahul builds the real endpoint.

---

## Demo Script (memorize this)

1. Open app as demo user (pre-seeded, skip live onboarding or do a fast walkthrough)
2. Show dashboard — yesterday's run is missed, debt is at 1, escalation is at stage 2
3. Scroll to coach message: "You said Thursday. It's Saturday."
4. Show escalation ladder — stages 1 and 2 checked off, stage 3 pending
5. Accept recovery action — "20-min punishment run + commitment to tomorrow"
6. Dashboard updates: debt cleared, new task queued, coach sends acknowledgment

Total demo time: ~3 minutes.
