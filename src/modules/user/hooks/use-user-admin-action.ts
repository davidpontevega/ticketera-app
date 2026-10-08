"use client";

import { useActionState, useEffect } from "react";

import type { UserAdminActionState } from "../types/user.types";

type UserAdminAction = (
  prev: UserAdminActionState,
  formData: FormData,
) => Promise<UserAdminActionState>;

const INITIAL_STATE: UserAdminActionState = { status: "idle" };

export function useUserAdminAction(
  action: UserAdminAction,
  onSuccess: (message: string) => void,
): [state: UserAdminActionState, formAction: (formData: FormData) => void, pending: boolean] {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") {
      onSuccess(state.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return [state, formAction, pending];
}
