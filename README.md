# pain.exe

Planning-first repository for a web-only, mobile-friendly AI coaching app inspired by the "relentless accountability" concept in the hackathon brief.

This commit intentionally contains no production code yet. It establishes the implementation map, system boundaries, and component-level docs so the project can start with a clean architecture instead of ad hoc hacking.

## Repo Template

```text
.
|-- apps/
|   |-- web/
|   |   `-- README.md
|   `-- worker/
|       `-- README.md
|-- packages/
|   |-- config/
|   |   `-- README.md
|   |-- domain/
|   |   `-- README.md
|   |-- providers/
|   |   `-- README.md
|   `-- ui/
|       `-- README.md
|-- docs/
|   |-- architecture/
|   |   |-- overview.md
|   |   |-- event-loop.md
|   |   `-- data-model.md
|   |-- product/
|   |   |-- onboarding.md
|   |   |-- goal-setup.md
|   |   |-- coach-profile.md
|   |   |-- training-plan.md
|   |   |-- daily-command-center.md
|   |   |-- messaging-loop.md
|   |   `-- escalation-engine.md
|   |-- integrations/
|   |   |-- calendar.md
|   |   |-- wearables.md
|   |   `-- voice-telephony.md
|   |-- operations/
|   |   |-- analytics-observability.md
|   |   |-- safety-compliance.md
|   |   `-- testing-plan.md
|   |-- roadmap/
|   |   `-- demo-slice.md
|   `-- INDEX.md
`-- scripts/
    `-- README.md
```

## How To Use This Repo

1. Start with [docs/INDEX.md](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/INDEX.md) for the full reading order.
2. Build the first thin slice from [docs/roadmap/demo-slice.md](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/demo-slice.md).
3. Implement code into the predefined app and package folders as each planning doc is converted into tickets.

## Principles

- Web-first and demo-first.
- Event-driven coaching loop over generic chat.
- Persona layer separated from delivery channels and safety rules.
- Deterministic escalation policy with AI-generated copy.
- Provider abstractions from day one for calendar, wearables, SMS, calls, and voice.

## Initial Build Order

1. `apps/web`: landing, onboarding, seeded demo account, command center.
2. `packages/domain`: shared types, policies, plan generation contracts.
3. `apps/worker`: delayed jobs, escalation timers, webhook handling.
4. `packages/providers`: Twilio, ElevenLabs, calendar, wearable adapters.
5. `packages/ui`: reusable interface components and design tokens.
