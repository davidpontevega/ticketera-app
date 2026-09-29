import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthUser } from "../types/auth.types";
import { getNameFromEmail } from "../utils/auth.utils";

export interface AuthState {
  user: AuthUser | null;
  knownUsers: AuthUser[]; // registros previos en este navegador
  login: (email: string) => AuthUser;
  register: (user: AuthUser) => AuthUser;
  logout: () => void;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// Sesion simulada (sin backend). Nunca guarda contraseñas: solo nombre y correo.
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      knownUsers: [],
      login: (email) => {
        const normalized = normalizeEmail(email);
        const known = get().knownUsers.find((user) => user.email === normalized);
        const user = known ?? { fullName: getNameFromEmail(normalized), email: normalized };
        set({ user });
        return user;
      },
      register: ({ fullName, email }) => {
        const user = { fullName: fullName.trim(), email: normalizeEmail(email) };
        set((state) => ({
          user,
          knownUsers: [...state.knownUsers.filter((known) => known.email !== user.email), user],
        }));
        return user;
      },
      logout: () => set({ user: null }),
    }),
    {
      name: "ticketera-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ user, knownUsers }) => ({ user, knownUsers }),
    },
  ),
);
