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
