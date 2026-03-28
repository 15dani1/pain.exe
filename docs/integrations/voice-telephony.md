# Voice And Telephony

## Providers

- Twilio for calls and SMS
- ElevenLabs for voice generation behind an abstraction

## Call Flow

1. Escalation policy permits a call
2. Worker requests a call payload from domain logic
3. Voice provider generates or selects spoken audio
4. Telephony provider places the call
5. Webhook updates outcome and next action

## Safeguards

- explicit call consent
- quiet-hour enforcement
- generic fallback voice if premium generation fails
- persona-safe fallback copy if risky wording is disabled
