import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MockEmail, NewMockEmail, ResetToken, ResetTokenStatus } from "../types/dev.types";

export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

export interface DevMailState {
  emails: MockEmail[];
  resetTokens: ResetToken[];
  sendMockEmail: (email: NewMockEmail) => MockEmail;
  createResetToken: (email: string, now?: Date) => ResetToken;
  getResetTokenStatus: (token: string, now?: Date) => ResetTokenStatus;
  consumeResetToken: (token: string, now?: Date) => string | null;
  markRead: (id: string) => void;
}

// Bandeja de correo simulada (no hay backend): los "correos" y los tokens de reseteo viven en
// localStorage y se leen en /dev/inbox.
export const useDevMailStore = create<DevMailState>()(
  persist(
    (set, get) => ({
      emails: [],
      resetTokens: [],
      sendMockEmail: (email) => {
        const sent: MockEmail = {
          ...email,
          id: randomHex(8),
          createdAt: new Date().toISOString(),
          read: false,
        };
        set((state) => ({ emails: [sent, ...state.emails] }));
        return sent;
      },
      createResetToken: (email, now = new Date()) => {
        const token: ResetToken = {
          token: randomHex(32),
          email,
          expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS).toISOString(),
          usedAt: null,
        };
        set((state) => ({ resetTokens: [...state.resetTokens, token] }));
        return token;
      },
      getResetTokenStatus: (token, now = new Date()) => {
        const found = get().resetTokens.find((item) => item.token === token);
        if (!found) return { status: "invalid" };
        if (found.usedAt) return { status: "used" };
        if (Date.parse(found.expiresAt) <= now.getTime()) return { status: "expired" };
        return { status: "valid", email: found.email };
      },
      consumeResetToken: (token, now = new Date()) => {
        const status = get().getResetTokenStatus(token, now);
        if (status.status !== "valid") return null;
        set((state) => ({
          resetTokens: state.resetTokens.map((item) =>
            item.token === token ? { ...item, usedAt: now.toISOString() } : item,
          ),
        }));
        return status.email;
      },
      markRead: (id) =>
        set((state) => ({
          emails: state.emails.map((email) => (email.id === id ? { ...email, read: true } : email)),
        })),
    }),
    {
      name: "ticketera-dev-mail",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ emails, resetTokens }) => ({ emails, resetTokens }),
    },
  ),
);
