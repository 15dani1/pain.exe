# packages/domain

Planned home for business logic and shared types.

## Responsibilities

- Domain models for users, goals, plans, check-ins, escalations, and messages
- Input and output contracts for plan generation
- Escalation ladder policy logic
- Timezone-safe scheduling rules
- Persona-safe prompt assembly rules

## Expected Modules

- `entities/`
- `policies/`
- `services/`
- `events/`
- `schemas/`

## Rule Of Thumb

If a rule should work the same regardless of whether the app uses Twilio, email, or in-app notifications, it belongs here.
