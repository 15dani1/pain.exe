# Demo User Workflow

This walkthrough is the shortest clean story for judges and testers to follow from first interaction to visible plan details.

## Goal

Show that a user can:

1. Create a plan.
2. See that plan appear in `My Plans`.
3. Understand what the coaching experience will feel like.
4. Preview what SMS and call-based accountability would sound like.

## Recommended Demo Script

### 1. Open the app on `Today`

Briefly explain that `pain.exe` is an accountability agent that creates a plan, tracks compliance, and escalates when the user drifts.

### 2. Go to `Create Plan`

Fill out the wizard with a simple test persona:

- Name: `Demo User`
- Phone number: a real mobile number for the tester if they want to preview coaching
- Goal type: `Half Marathon` or `Daily Discipline`
- Target date: any believable near-term date
- Google Calendar email: optional for demo
- Baseline: one short sentence
- Weekly availability: one short sentence
- Wake window: one short sentence
- Injury limit: one short sentence
- Trigger: something direct like `Call out avoidance and remind me what I said I wanted`
- Escalation tolerance: `Relentless`
- Allowed channels: `In-app`, `SMS`, and optionally `Call`

### 3. Submit the plan

When `Create plan` is pressed, explain that:

- The frontend calls `POST /api/onboarding`.
- The backend creates the user and training plan state.
- The frontend immediately persists the submitted plan locally for demo browsing.
- The frontend then calls `GET /api/dashboard?userId=...` to hydrate the new user’s `Today` state.

### 4. Go to `My Plans`

Show that the newly created plan now appears in the list.

Click the plan and walk through:

- Goal
- Target date
- Phone number
- Calendar email
- Availability
- Wake window
- Baseline
- Injury limits
- Escalation tolerance
- Channels
- Trigger
- Next mission

This is the clearest page to prove that the app captured what the user actually submitted.

### 5. Explain the coaching experience

Use the created plan details to set expectations:

- The user gets structured reminders tied to their stated goal.
- Missed work becomes visible debt.
- Recovery actions are offered instead of silently failing.
- If the user enabled stronger channels, SMS or call-based nudges can be used.

## Simple SMS / Call Expectation Script

If you want someone to type in their real phone number during the demo, position it as a preview of tone and escalation, not as a surprise contact.

Suggested language:

> Enter your number if you want to see exactly how the accountability flow would talk to you. You’ll know what to expect before any live outreach is enabled.

### Sample SMS

`You planned a 6:00 AM run today. It still isn’t done. Confirm the workout window now or own the miss and clear the debt tonight.`

### Sample Follow-Up Call Tone

`You said this mattered. Right now your next action is simple: finish the session you committed to, then reset tomorrow before this slips again.`

## Notes For The Presenter

- Keep the walkthrough centered on `Create Plan` and `My Plans`.
- Only visit `Today` after the plan exists, so the dashboard feels grounded in real input.
- Use `Integrations` only if judges ask how Garmin or calendar signals would plug in.
- If a real phone number is used, clearly tell the participant whether the demo is preview-only or actually live before they submit it.
