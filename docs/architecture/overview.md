# Architecture Overview

## Goal

Build a web-only coaching app that feels relentless through scheduling, escalation, continuity, and persuasive delivery rather than native device control.

## Proposed Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Next.js API routes and server actions
- Worker: separate job runner for delayed actions and webhooks
- Database: MongoDB Atlas
- Queue: Redis via Upstash or BullMQ-compatible service
- Auth: Clerk or Auth.js
- AI: LLM layer for planning, excuse classification, and adaptive copy

## Boundaries

- Product logic lives in `packages/domain`
- External services live in `packages/providers`
- Web UI lives in `apps/web`
- Background orchestration lives in `apps/worker`

## Non-Negotiables

- Deterministic escalation state machine
- Persona configuration separated from system safety rules
- Every outbound intervention logged
- Timezone-safe scheduling everywhere
