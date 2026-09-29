import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthAccount, AuthResult, AuthUser } from "../types/auth.types";
import {
  DEMO_ACCOUNT,
  DEMO_ACCOUNT_PASSWORD_HASH,
  hashPassword,
  normalizeEmail,
} from "../utils/auth.utils";

export interface AuthState {
  user: AuthUser | null;
  accounts: AuthAccount[];
  register: (input: { fullName: string; email: string; password: string }) => Promise<AuthResult>;
  login: (input: { email: string; password: string }) => Promise<AuthResult>;
  loginWithGoogle: (profile: AuthUser) => AuthUser;
  updatePassword: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const DEMO_SEED: AuthAccount = {
  fullName: DEMO_ACCOUNT.fullName,
  email: DEMO_ACCOUNT.email,
  passwordHash: DEMO_ACCOUNT_PASSWORD_HASH,
  providers: ["password"],
  createdAt: "2026-09-01T00:00:00.000Z",
};

const toUser = ({ fullName, email }: AuthAccount): AuthUser => ({ fullName, email });

// Cuentas mock en localStorage: el login valida correo y contraseña (hash SHA-256).
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accounts: [DEMO_SEED],
      register: async ({ fullName, email, password }) => {
        const normalized = normalizeEmail(email);
        if (get().accounts.some((account) => account.email === normalized)) {
          return { ok: false, field: "email", message: "Ya existe una cuenta con ese correo" };
        }
        const account: AuthAccount = {
          fullName: fullName.trim(),
          email: normalized,
          passwordHash: await hashPassword(normalized, password),
          providers: ["password"],
          createdAt: new Date().toISOString(),
        };
        const user = toUser(account);
        set((state) => ({ accounts: [...state.accounts, account], user }));
        return { ok: true, user };
      },
      login: async ({ email, password }) => {
        const normalized = normalizeEmail(email);
        const account = get().accounts.find((item) => item.email === normalized);
        if (!account) {
          return { ok: false, field: "email", message: "No encontramos una cuenta con ese correo" };
        }
        if (!account.passwordHash) {
          return {
            ok: false,
            field: "password",
            message: "Esta cuenta usa Google. Continua con Google.",
          };
        }
        if ((await hashPassword(normalized, password)) !== account.passwordHash) {
          return { ok: false, field: "password", message: "La contraseña es incorrecta" };
        }
        const user = toUser(account);
        set({ user });
        return { ok: true, user };
      },
      loginWithGoogle: (profile) => {
        const email = normalizeEmail(profile.email);
        const existing = get().accounts.find((account) => account.email === email);
        const account: AuthAccount = existing
          ? {
              ...existing,
              providers: existing.providers.includes("google")
                ? existing.providers
                : [...existing.providers, "google"],
            }
          : {
              fullName: profile.fullName.trim(),
              email,
              passwordHash: null,
              providers: ["google"],
              createdAt: new Date().toISOString(),
            };
        const user = toUser(account);
        set((state) => ({
          accounts: [...state.accounts.filter((item) => item.email !== email), account],
          user,
        }));
        return user;
      },
      updatePassword: async (email, password) => {
        const normalized = normalizeEmail(email);
        const passwordHash = await hashPassword(normalized, password);
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.email === normalized
              ? {
                  ...account,
                  passwordHash,
                  providers: account.providers.includes("password")
                    ? account.providers
                    : [...account.providers, "password"],
                }
              : account,
          ),
        }));
      },
      logout: () => set({ user: null }),
    }),
    {
      name: "ticketera-auth",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user, accounts }) => ({ user, accounts }),
      // v0 (spec 012) guardaba `knownUsers` sin contraseña: se descartan y se conserva la sesion.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { user?: AuthUser | null; accounts?: AuthAccount[] };
        if (version < 1) return { user: state.user ?? null, accounts: [DEMO_SEED] };
        return state;
      },
    },
  ),
);
