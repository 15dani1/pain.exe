# Milestone 01: Foundation

## Status

- [x] Repo scaffolding exists for planning, backend, and frontend work
- [x] Backend environment contract exists in `backend/.env.example`
- [x] Initial Mongo-backed backend entities and seed flow are implemented
- [x] Frontend app shell, navigation, and design direction are implemented in `frontend/`
- [x] Seeded demo persona and sample user profile exist across backend seed data and frontend demo state
- [x] This milestone is effectively complete

## Objective

Create the minimum shared base that lets the team build in parallel without reworking core assumptions.

## Deliverables

- monorepo app and package scaffolding
- environment variable contract
- initial MongoDB schemas or schema definitions
- shared domain types for users, goals, plans, check-ins, and escalations
- design direction for the web app
- seeded demo persona and sample user profile

## Team Workstreams

- frontend: create app shell, navigation, design tokens, and mobile layout conventions
- backend: define core entities and persistence strategy
- domain: define plan generation and escalation policy interfaces
- ops: choose auth, queue, and deployment defaults

## Completion Criteria

- team can name where each new feature belongs
- core nouns and event names are stable enough for parallel work
- demo seed data structure is agreed upon
- provider boundaries are documented before any vendor-specific coding

## Risks

- starting UI work before data contracts exist
- leaking provider assumptions into domain logic
- over-scoping real integrations before the narrative demo is locked
