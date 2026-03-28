# Escalation Engine

## Ladder

1. In-app reminder
2. Sharper push or SMS
3. Full-screen in-app interrupt
4. AI phone call
5. Repeated follow-up until resolved or snoozed

## Policy Inputs

- quiet hours
- max daily intensity
- allowed channels
- call consent
- cooldown windows

## Implementation Rules

- Advance stage exactly once per missed event
- Record every attempt and result
- Respect quiet hours by delaying, not skipping, valid escalations
- Let user resolve or snooze with an explicit state change
