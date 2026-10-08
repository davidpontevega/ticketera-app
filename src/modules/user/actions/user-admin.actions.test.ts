import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ADMIN_ROLES } from "../constants/user.constants";

const requireRole = vi.fn();
vi.mock("../services/user-access.service", () => ({
  requireRole: (...args: unknown[]) => requireRole(...args),
}));

const inviteUser = vi.fn();
const changeUserRole = vi.fn();
const deleteUser = vi.fn();
vi.mock("../services/user-admin.service", () => ({
  inviteUser: (...args: unknown[]) => inviteUser(...args),
  changeUserRole: (...args: unknown[]) => changeUserRole(...args),
  deleteUser: (...args: unknown[]) => deleteUser(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

const headersGet = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (...args: unknown[]) => headersGet(...args) }),
}));

const { inviteUserAction, changeUserRoleAction, deleteUserAction } = await import(
  "./user-admin.actions"
);

const VALID_USER_ID = "11111111-1111-4111-8111-111111111111";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ id: "admin-1" });
  headersGet.mockReturnValue("https://app.test");
  inviteUser.mockResolvedValue({ ok: true });
  changeUserRole.mockResolvedValue(true);
  deleteUser.mockResolvedValue({ ok: true });
});

describe("requireRole guard (AC4)", () => {
  it("inviteUserAction llama requireRole antes que inviteUser", async () => {
    await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(requireRole).toHaveBeenCalledWith(USER_ADMIN_ROLES);
  });

  it("si requireRole rechaza, inviteUser nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      inviteUserAction({ status: "idle" }, formData({ email: "a@test.com", role: "organizer" })),
    ).rejects.toThrow();

    expect(inviteUser).not.toHaveBeenCalled();
  });

  it("si requireRole rechaza, changeUserRole nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      changeUserRoleAction(
        { status: "idle" },
        formData({ userId: VALID_USER_ID, role: "admin" }),
      ),
    ).rejects.toThrow();

    expect(changeUserRole).not.toHaveBeenCalled();
  });

  it("si requireRole rechaza, deleteUser nunca se llama", async () => {
    requireRole.mockRejectedValue(new Error("redirect"));

    await expect(
      deleteUserAction({ status: "idle" }, formData({ userId: VALID_USER_ID })),
    ).rejects.toThrow();

    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("inviteUserAction", () => {
  it("FormData invalida devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "no-es-un-email", role: "organizer" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { email: expect.any(String) } });
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it("sin header origin devuelve error sin llamar a inviteUser", async () => {
    headersGet.mockReturnValue(null);

    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(result).toEqual({ status: "error", message: "No se pudo enviar la invitacion" });
    expect(inviteUser).not.toHaveBeenCalled();
  });

  it("already-registered mapea al mensaje correcto, sin revalidate", async () => {
    inviteUser.mockResolvedValue({ ok: false, error: "already-registered" });

    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Ese email ya tiene cuenta: cambia su rol desde la lista",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("already-invited mapea al mensaje correcto", async () => {
    inviteUser.mockResolvedValue({ ok: false, error: "already-invited" });

    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Ese email ya tiene una invitacion pendiente",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("invitation-failed mapea al mensaje correcto", async () => {
    inviteUser.mockResolvedValue({ ok: false, error: "invitation-failed" });

    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(result).toEqual({ status: "error", message: "No se pudo enviar la invitacion" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exito revalida ADMIN_USERS_PATH y devuelve mensaje con el email", async () => {
    inviteUser.mockResolvedValue({ ok: true });

    const result = await inviteUserAction(
      { status: "idle" },
      formData({ email: "nuevo@test.com", role: "organizer" }),
    );

    expect(result).toEqual({ status: "success", message: "Invitacion enviada a nuevo@test.com" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

describe("changeUserRoleAction", () => {
  it("FormData invalida (rol no asignable) devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await changeUserRoleAction(
      { status: "idle" },
      formData({ userId: VALID_USER_ID, role: "super_admin" }),
    );

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { role: expect.any(String) } });
    expect(changeUserRole).not.toHaveBeenCalled();
  });

  it("false mapea a error sin revalidate", async () => {
    changeUserRole.mockResolvedValue(false);

    const result = await changeUserRoleAction(
      { status: "idle" },
      formData({ userId: VALID_USER_ID, role: "admin" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "No se puede cambiar el rol de este usuario",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("true mapea a exito y revalida", async () => {
    changeUserRole.mockResolvedValue(true);

    const result = await changeUserRoleAction(
      { status: "idle" },
      formData({ userId: VALID_USER_ID, role: "admin" }),
    );

    expect(result).toEqual({ status: "success", message: "Rol actualizado" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});

describe("deleteUserAction", () => {
  it("FormData invalida (userId no uuid) devuelve fieldErrors sin llamar al servicio", async () => {
    const result = await deleteUserAction({ status: "idle" }, formData({ userId: "no-uuid" }));

    expect(result.status).toBe("error");
    expect(result).toMatchObject({ fieldErrors: { userId: expect.any(String) } });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("not-found mapea al mensaje correcto, sin revalidate", async () => {
    deleteUser.mockResolvedValue({ ok: false, error: "not-found" });

    const result = await deleteUserAction({ status: "idle" }, formData({ userId: VALID_USER_ID }));

    expect(result).toEqual({ status: "error", message: "No se puede eliminar este usuario" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("delete-failed mapea al mensaje correcto", async () => {
    deleteUser.mockResolvedValue({ ok: false, error: "delete-failed" });

    const result = await deleteUserAction({ status: "idle" }, formData({ userId: VALID_USER_ID }));

    expect(result).toEqual({
      status: "error",
      message: "No se pudo eliminar el usuario. Intenta de nuevo",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("exito revalida y devuelve mensaje de exito", async () => {
    deleteUser.mockResolvedValue({ ok: true });

    const result = await deleteUserAction({ status: "idle" }, formData({ userId: VALID_USER_ID }));

    expect(result).toEqual({ status: "success", message: "Usuario eliminado" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
  });
});
