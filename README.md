# pain.exe

`pain.exe` is a web-first personal AI agent for discipline, fitness, and goal adherence. It helps people turn intentions into completed actions by combining plan generation, accountability, calendar pressure, wearable verification, escalating reminders, and voice-based follow-up into one coaching loop.

This repository started planning-first and now includes both a working `backend/` API service and a working `frontend/` trainee console. The docs below still preserve the original planning structure, but the implementation status and repo map have been updated to reflect what Rahul and Fernando have actually built.

## Problem

Most health, fitness, and self-improvement tools fail after the initial burst of motivation. They log goals, count streaks, and send generic reminders, but they do not behave like a real accountability partner that notices avoidance, reacts to missed commitments, and adapts the plan to keep someone moving.

People especially struggle when they need:

- structure instead of blank-slate motivation
- persistent follow-up instead of passive tracking
- adaptation after failure instead of guilt-driven churn
- support that fits their real schedule, constraints, and energy

## Solution

`pain.exe` is designed as a personal AI agent, not just a chatbot. The system maintains user context over time, generates day-by-day training plans, watches for missed commitments, coordinates interventions across multiple channels, and restructures the path forward when the user falls behind.

The product experience centers on an event-driven coaching loop:

1. The user commits to a goal and schedule.
2. The AI agent generates a structured plan.
3. The system tracks adherence through check-ins, calendar timing, and wearable signals.
4. Missed work triggers deterministic escalation.
5. The agent follows up through chat, SMS, calendar pressure, and AI voice calls when allowed.
6. The plan adapts with recovery actions instead of silently collapsing.

## Personal AI Agent Capabilities

This project is explicitly being built with personal AI agent behavior in mind.

- Maintains persistent memory of goals, misses, excuses, streaks, and preferences
- Takes initiative by scheduling follow-ups and escalating when the user disengages
- Coordinates actions across chat, SMS, calendar, and voice channels
- Adapts future recommendations based on adherence, constraints, and imported activity
- Acts continuously through background jobs instead of only responding when manually opened
- Preserves persona while remaining bounded by system safety and consent rules

In practice, the product should feel like a personal operator for behavior change: aware of commitments, capable of acting on the user's behalf within approved boundaries, and persistent enough to help break inertia.

## Social Good

The long-term value of this project is broader than performance coaching. A well-designed personal accountability agent can support people who struggle with consistency, confidence, routine-building, or follow-through.

Potential social-good outcomes include:

- improving exercise adherence and general health habits
- helping users rebuild discipline after burnout or setbacks
- making coaching support more accessible than traditional one-on-one services
- creating a structured recovery path after missed commitments instead of shame-driven dropout
- demonstrating how personal AI agents can be used for sustained positive behavior change

## Committed Technology Stack

These are the technologies we are committing to for the hackathon build:

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Hosting: Vercel for the web app
- Backend: Next.js API routes and server actions
- Worker orchestration: separate background worker with Redis-backed delayed jobs
- Database: MongoDB Atlas
- Queue and scheduling: Upstash Redis or BullMQ-compatible Redis
- Auth: Clerk or Auth.js with email and Google sign-in
- AI reasoning: LLM layer for intake summarization, planning, excuse classification, and adaptive messaging
- Voice: ElevenLabs behind a provider abstraction
- Telephony and SMS: Twilio
- Calendar: Google Calendar first
- Wearables: one credible Apple Health, Google Fit, or aggregator-backed ingestion path
- Observability: Sentry, PostHog, structured logs

## What Makes This Different

- Personal AI agent behavior instead of single-turn chat
- Deterministic escalation engine instead of model-only autonomy
- Coach persona separated from product rules and consent boundaries
- Swappable providers for voice, telephony, and integrations
- Demo-first architecture that still leaves room for a safer "inspired-by" coach pivot

## Repo Template

```text
.
|-- backend/
|   |-- docs/
|   |-- scripts/
|   `-- src/
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
|   |   |-- demo-slice.md
|   |   |-- milestone-01-foundation.md
|   |   |-- milestone-02-core-agent-loop.md
|   |   |-- milestone-03-escalations-and-integrations.md
|   |   |-- milestone-04-demo-polish.md
|   |   |-- work-split.md
|   |   `-- team-roles.md
|   `-- INDEX.md
|-- frontend/
|   |-- public/
|   `-- src/
`-- scripts/
    `-- README.md
```

## Current Implementation Status

- Backend API scaffold is in place in [backend/README.md](/Users/fzapata99/Documents/pain.exe/pain.exe/backend/README.md)
- Frontend trainee console is in place in [frontend/README.md](/Users/fzapata99/Documents/pain.exe/pain.exe/frontend/README.md)
- Work split tracking lives in [docs/roadmap/work-split.md](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/work-split.md)
- Backend progress tracking lives in [backend/docs/backend-progress.md](/Users/fzapata99/Documents/pain.exe/pain.exe/backend/docs/backend-progress.md)

## How To Use This Repo

1. Start with [docs/INDEX.md](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/INDEX.md) for the full reading order.
2. Build the first thin slice from [docs/roadmap/demo-slice.md](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/demo-slice.md).
3. Use the milestone files in `docs/roadmap/` to split work across the hackathon team.
4. Implement code into the predefined app and package folders as each planning doc is converted into tickets.

## Principles

- Web-first and demo-first.
- Event-driven coaching loop over generic chat.
- Personal AI agent behavior with memory, initiative, and follow-through.
- Persona layer separated from delivery channels and safety rules.
- Deterministic escalation policy with AI-generated copy.
- Provider abstractions from day one for calendar, wearables, SMS, calls, and voice.

## Team Build Order

1. `backend`: seeded data, API contracts, escalation logic, demo reset, and smoke checks.
2. `frontend`: trainee onboarding, saved plans, command center, escalation UI, and local stub integration points.
3. `packages/domain`: shared types, policies, and plan generation contracts if the app is consolidated later.
4. `packages/providers`: Twilio, ElevenLabs, calendar, wearable adapters.
5. `packages/ui`: reusable interface components and design tokens.

## Roadmap

- [Demo Slice](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/demo-slice.md)
- [Milestone 01: Foundation](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/milestone-01-foundation.md)
- [Milestone 02: Core Agent Loop](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/milestone-02-core-agent-loop.md)
- [Milestone 03: Escalations And Integrations](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/milestone-03-escalations-and-integrations.md)
- [Milestone 04: Demo Polish](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/milestone-04-demo-polish.md)
- [Team Roles And Ownership](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/team-roles.md)
- [Work Split](/Users/fzapata99/Documents/pain.exe/pain.exe/docs/roadmap/work-split.md)
