# apps/worker

Planned home for background processing.

## Responsibilities

- Delayed escalation jobs
- Retry queues and cooldown handling
- Calendar and wearable sync jobs
- Telephony webhook follow-up actions
- Scheduled plan regeneration and reminder windows

## Initial Workers

- `missed-checkin-escalation`
- `calendar-preworkout-reminder`
- `quiet-hours-release`
- `wearable-sync-reconcile`
- `call-outcome-followup`

## Design Rule

Workers decide when to act, but channel-specific providers decide how to deliver.
