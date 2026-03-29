# Milestone 03: Escalations And Integrations

## Status

- [x] Escalation stage machine is implemented in backend check-in handling
- [x] Idempotent missed-event escalation handling is implemented
- [x] Frontend escalation timeline and integration status UI are implemented
- [x] Voice preview path exists with fallback behavior
- [ ] Real Google Calendar event creation is not wired yet
- [x] Garmin-first wearable verification path is now wired in backend
- [ ] Twilio delivery is still represented as a demo/stub surface
- In progress: this milestone is now ready for frontend wiring of Garmin sync status and demo controls

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
- escalates when Garmin data shows no workout corresponding to the plan

## Team Workstreams

- worker: queue processing and idempotent timers
- integrations: Twilio, voice, calendar, Garmin activity adapter
- domain: escalation decisions, quiet hours, and allowed-channel rules
- frontend: escalation timeline and integration status UI

## Completion Criteria

- missed workout advances stage exactly once
- quiet hours delay calls without losing the escalation
- calendar and wearable events can affect coaching state
- call and SMS outcomes feed back into the app timeline
- Garmin sync can either clear the task or apply a strike with escalating feedback

## Risks

- duplicate jobs causing double escalation
- fragile live integrations breaking the demo path
- insufficient consent and safety messaging around outreach
