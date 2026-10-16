export type OnboardingStatus = "not_started" | "pending" | "complete";

export interface ConnectActionState {
  error?: string;
}

export interface FeeActionState {
  error?: string;
  success?: boolean;
}

export interface PlatformSettings {
  feePercent: number;
  updatedBy: string | null;
  updatedAt: Date | null;
}

export type PayoutStatus = "held" | "available" | "released";

export interface EventPayoutRow {
  eventId: string;
  title: string;
  amount: number;
  releaseAt: Date;
  status: PayoutStatus;
}

export interface PayoutSummary {
  rows: EventPayoutRow[];
  /** Suma de eventos `held` + `available`. */
  heldTotal: number;
}

export interface PayoutActionState {
  error?: string;
  success?: boolean;
}
