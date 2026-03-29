# Milestone 03: Escalations And Integrations

## Status

- [x] Escalation stage machine is implemented in backend check-in handling
- [x] Idempotent missed-event escalation handling is implemented
- [x] Frontend escalation timeline and integration status UI are implemented
- [x] Voice preview path exists with fallback behavior
- [ ] Real Google Calendar event creation is not wired yet
- [ ] Real wearable verification path is not wired yet
- [ ] Twilio delivery is still represented as a demo/stub surface
- In progress: this milestone is partially complete and in a good place for frontend-to-backend integration

## Objective

Connect the core coaching loop to real-world pressure channels so the agent can act beyond the browser.

## Deliverables

- escalation stage machine implemented in code
- worker-driven delayed jobs and cooldown handling
- Twilio SMS and call path stub or live implementation
- ElevenLabs voice generation path with fallback
- Google Calendar event creation and reminder timing
- one wearable or workout verification path

## Agent Behaviors To Demonstrate

- notices that the user has not complied by a deadline
- chooses the next approved action based on policy
- continues follow-up after no response
- suppresses unnecessary nagging when an integration verifies completion

## Team Workstreams

- worker: queue processing and idempotent timers
- integrations: Twilio, voice, calendar, wearable adapters
- domain: escalation decisions, quiet hours, and allowed-channel rules
- frontend: escalation timeline and integration status UI

## Completion Criteria

- missed workout advances stage exactly once
- quiet hours delay calls without losing the escalation
- calendar and wearable events can affect coaching state
- call and SMS outcomes feed back into the app timeline

## Risks

- duplicate jobs causing double escalation
- fragile live integrations breaking the demo path
- insufficient consent and safety messaging around outreach
