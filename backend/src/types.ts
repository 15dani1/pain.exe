export type TaskStatus = "pending" | "missed" | "done";

export type MessageRole = "coach" | "user";

export type EscalationStage = 1 | 2 | 3 | 4 | 5;

export interface DashboardResponse {
  user: { name: string };
  todayTask: { title: string; dueAt: string; status: TaskStatus };
  debtCount: number;
  escalation: { stage: EscalationStage; lastActionAt: string };
  recentMessages: { role: MessageRole; content: string; sentAt: string }[];
  recoveryAction: { title: string; description: string } | null;
  integrations?: {
    garmin?: {
      connected: boolean;
      lastSyncAt: string | null;
      status: "idle" | "matched" | "strike";
      strikeCount: number;
      lastEvaluation: {
        matched: boolean;
        summary: string;
        matchedActivityType: string | null;
        matchedAt: string | null;
      } | null;
    };
  };
}

export interface EscalationEvent {
  type: "reminder_sent" | "sms_sent" | "call_placed";
  label: string;
  at: string;
}
