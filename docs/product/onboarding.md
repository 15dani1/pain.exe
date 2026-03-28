# Onboarding

## Purpose

Collect enough information to create a safe, schedule-aware first plan and an acceptable escalation policy.

## Inputs

- goal and target date
- baseline fitness
- schedule constraints
- wake and sleep window
- injuries and risk limits
- motivational triggers
- escalation tolerance and channel consent

## v1 Implementation

- Build as a multi-step form with progress and autosave
- Summarize inputs into a normalized profile object
- Run lightweight validation before plan generation
- End with a review screen that makes escalation rules explicit

## Acceptance Criteria

- A valid onboarding submission creates `user`, `goal`, and escalation preference records.
- The output is sufficient to request an initial training plan.
