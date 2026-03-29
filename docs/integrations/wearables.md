# Wearables Integration

## Goal

Accept one credible workout verification path in the hackathon demo.

## v1 Strategy

- Start with Garmin as the first direct provider
- Ingest completed activity summaries and key effort signals
- Match imported Garmin evidence against planned tasks
- Prevent redundant nagging when effort is already verified
- Treat no-match syncs as strikes that can advance escalation

## Matching Rules

- compare a Garmin activity to the current planned task
- compare time window around the planned due time
- compare workout type such as run, walk, ride, or strength
- compare duration or minimum effort threshold
- prefer the best-scoring activity when multiple Garmin activities are present

## Garmin-First Scope

- first endpoint: Garmin activity sync enters the backend as imported workout evidence
- backend evaluates the sync against `todayTask`
- matching activity marks the task complete and appends positive coach feedback
- no matching activity applies one strike, increases debt, and escalates coach tone
- integration state stores last sync time, strike count, and last evaluation summary
- frontend can run a demo-safe Garmin simulator instead of requiring real Garmin credentials

## AI Feedback Behavior

- matched Garmin evidence should trigger concise acknowledgment tied to the planned workout
- no-match Garmin evidence should trigger stricter feedback tied to the escalation stage
- feedback must stay deterministic about the action taken, even if copy is AI-generated
- the next action should always be explicit: complete recovery, confirm completion, or prepare for the next session
