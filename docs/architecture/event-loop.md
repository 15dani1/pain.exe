# Event Loop

## Core Loop

1. User commits to a dated task.
2. System starts a timer and creates calendar pressure.
3. User either checks in manually or an integration confirms completion.
4. If the task is missed, escalation policy advances exactly once.
5. AI generates copy for the chosen stage, but rules decide the stage and channel.
6. User resolves, snoozes, or earns a recovery action.
7. Plan and debt state update, preserving full history.

## Event Types

- Goal created
- Plan generated
- Task scheduled
- Check-in recorded
- Workout imported
- Workout missed
- Escalation advanced
- Message delivered
- Call completed
- Plan regenerated

## Implementation Notes

- Store events explicitly or derive them from write-ahead logs.
- Make every stage transition idempotent.
- Prefer a single scheduler source of truth to avoid duplicate reminders.
