# packages/providers

Planned home for external service adapters.

## Responsibilities

- SMS and calls
- Voice synthesis
- Calendar APIs
- Wearable and workout ingestion
- Analytics and error reporting

## Provider Strategy

- Define provider interfaces before concrete implementations.
- Keep provider return shapes normalized.
- Do not let provider-specific payloads leak into product logic.
- Make voice/persona selection swappable without touching escalation policy code.
