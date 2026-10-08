"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import type { UserResource } from "@clerk/shared/types";

import { getNameFromEmail } from "../utils/auth.utils";
import type { AuthUser } from "../types/auth.types";

export interface CurrentUser {
  user: AuthUser | null; // null sin sesion o mientras carga
  isLoaded: boolean; // useUser().isLoaded; reemplaza useIsClient (evita hydration mismatch)
  signOut: () => Promise<void>; // useClerk().signOut(); Clerk navega luego a afterSignOutUrl (default "/")
}

export function toAuthUser(user: UserResource | null | undefined): AuthUser | null {
  if (!user) return null;

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const normalizedEmail = email.toLowerCase();
  const fullName = user.fullName?.trim() || getNameFromEmail(normalizedEmail);

  return { fullName, email: normalizedEmail };
}

export function useCurrentUser(): CurrentUser {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  return {
    user: toAuthUser(user),
    isLoaded,
    signOut: () => signOut(),
  };
}
