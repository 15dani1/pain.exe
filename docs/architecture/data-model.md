# Data Model

## Collections

### users

- profile and timezone
- fitness baseline
- escalation preferences
- quiet hours and consent flags

### goals

- goal type and target date
- constraints and risk notes
- success metrics

### plans

- dated tasks
- backup tasks
- revision history
- missed-day recovery logic

### check_ins

- manual completion
- imported workout evidence
- subjective effort
- excuses and pain reports
- Garmin sync evaluation outcome and matched activity summary

### escalations

- current stage
- attempt log
- cooldowns
- next trigger time
- resolution outcome

### messages

- inbound and outbound content
- channel
- delivery status
- tone metadata

### integrations

- provider tokens
- sync health
- last sync times
- Garmin strike count and last plan-matching evaluation

### coach_profiles

- persona prompt
- intensity settings
- voice configuration
- fallback-safe wording

## Schema Guidance

- Include immutable timestamps on every record.
- Use explicit timezone fields instead of guessing from locale.
- Keep plan versions append-only to preserve user history.
