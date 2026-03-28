# Testing Plan

## Core Scenarios

- onboarding creates valid user and goal records
- missed workout advances escalation exactly once
- quiet hours defer calls correctly
- calendar events relink on plan changes
- wearable sync suppresses redundant reminders
- call webhooks update follow-up behavior
- voice generation failure falls back cleanly
- timezone handling is correct end-to-end
- seeded demo flow runs in a clean environment

## Test Layers

- unit tests for domain policies
- integration tests for provider adapters
- end-to-end tests for demo-critical flows
