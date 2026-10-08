import { act, renderHook } from "@testing-library/react";
import { startTransition } from "react";
import { describe, expect, it, vi } from "vitest";

import type { UserAdminActionState } from "../types/user.types";
import { useUserAdminAction } from "./use-user-admin-action";

function dispatch(formAction: (formData: FormData) => void, formData: FormData) {
  return act(async () => {
    startTransition(() => formAction(formData));
  });
}

describe("useUserAdminAction", () => {
  it("starts with idle state", () => {
    const action = vi.fn();
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUserAdminAction(action, onSuccess));

    expect(result.current[0]).toEqual<UserAdminActionState>({ status: "idle" });
  });

  it("does not call onSuccess when the action resolves with an error", async () => {
    const errorState: UserAdminActionState = { status: "error", message: "Revisa los datos" };
    const action = vi.fn().mockResolvedValue(errorState);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUserAdminAction(action, onSuccess));

    await dispatch(result.current[1], new FormData());

    expect(result.current[0]).toEqual(errorState);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onSuccess exactly once with the success message", async () => {
    const successState: UserAdminActionState = { status: "success", message: "Usuario eliminado" };
    const action = vi.fn().mockResolvedValue(successState);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useUserAdminAction(action, onSuccess));

    await dispatch(result.current[1], new FormData());

    expect(result.current[0]).toEqual(successState);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith("Usuario eliminado");
  });
});
