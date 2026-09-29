export interface MockEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  createdAt: string; // ISO
  read: boolean;
}

export type NewMockEmail = Omit<MockEmail, "id" | "createdAt" | "read">;

export interface ResetToken {
  token: string;
  email: string;
  expiresAt: string; // ISO
  usedAt: string | null;
}

export type ResetTokenStatus =
  | { status: "valid"; email: string }
  | { status: "invalid" | "expired" | "used" };

export type StorageArea = "local" | "session";

export interface StorageEntry {
  key: string;
  area: StorageArea;
  bytes: number;
  value: string;
}
