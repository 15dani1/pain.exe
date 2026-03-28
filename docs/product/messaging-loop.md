# Messaging Loop

## Channels

- in-app chat
- SMS
- email
- browser push later

## Design

- Messages are context-aware and reference recent misses
- The domain layer selects the purpose of the message
- The AI layer writes the copy within persona and safety bounds
- The provider layer sends it over the chosen channel

## Important Constraint

The model should never decide whether escalation occurs. It only drafts content for a predetermined intervention.
