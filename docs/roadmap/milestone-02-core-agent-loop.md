# Milestone 02: Core Agent Loop

## Objective

Make the product feel like a personal AI agent with memory, initiative, and follow-through inside the web app.

## Deliverables

- onboarding flow that creates a valid user and goal
- first-pass plan generation contract and mocked or real plan output
- daily command center with today's mission, debt, streaks, and compliance
- in-app message thread driven by domain events
- seeded account showing continuity across multiple days

## Agent Behaviors To Demonstrate

- remembers prior misses and references them
- tracks commitments over time, not just in one session
- initiates next steps based on due tasks and missed tasks
- proposes recovery actions when the plan slips

## Team Workstreams

- frontend: onboarding, dashboard, and message UI
- backend: plan creation endpoint and check-in flows
- domain: event-driven state transitions and recovery logic
- content: coach persona presets and safe copy boundaries

## Completion Criteria

- a new user can onboard and see a generated or seeded plan
- a missed task changes dashboard state and message tone
- the app clearly demonstrates persistent personal agent behavior

## Risks

- building chat before the action loop is convincing
- letting the LLM own logic that should be deterministic
