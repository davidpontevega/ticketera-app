import { and, eq, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "../db/user.table";
import type { UserEntity } from "../types/user.types";
import { getCurrentDbUser, requireRole } from "./user-access.service";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: unknown[]) => auth(...args),
}));

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: (...args: [string]) => redirect(...args),
}));

const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const selectLimit = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  selectWhere.mockImplementation(() => ({ limit: selectLimit }));
  selectLimit.mockResolvedValue([]);
  redirect.mockImplementation((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  });
});

const dbUser = { id: "user-1", clerkId: "clerk_1", role: "organizer" } as UserEntity;

describe("getCurrentDbUser", () => {
  it("sin userId no llama a la DB y devuelve null", async () => {
    auth.mockResolvedValue({ userId: null });

    const result = await getCurrentDbUser();

    expect(result).toBeNull();
    expect(select).not.toHaveBeenCalled();
  });

  it("con userId pero sin fila devuelve null", async () => {
    auth.mockResolvedValue({ userId: "clerk_1" });
    selectLimit.mockResolvedValue([]);

    const result = await getCurrentDbUser();

    expect(result).toBeNull();
  });

  it("con userId y fila devuelve la fila, filtrando deleted_at IS NULL", async () => {
    auth.mockResolvedValue({ userId: "clerk_1" });
    selectLimit.mockResolvedValue([dbUser]);

    const result = await getCurrentDbUser();

    expect(result).toEqual(dbUser);
    expect(selectWhere).toHaveBeenCalledWith(and(eq(users.clerkId, "clerk_1"), isNull(users.deletedAt)));
    expect(selectLimit).toHaveBeenCalledWith(1);
  });
});

describe("requireRole", () => {
  it("sin sesion redirige a /login", async () => {
    auth.mockResolvedValue({ userId: null });

    await expect(requireRole(["organizer"])).rejects.toThrow("REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("sesion sin fila activa redirige a /", async () => {
    auth.mockResolvedValue({ userId: "clerk_1" });
    selectLimit.mockResolvedValue([]);

    await expect(requireRole(["organizer"])).rejects.toThrow("REDIRECT:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("rol fuera de allowed redirige a /", async () => {
    auth.mockResolvedValue({ userId: "clerk_1" });
    selectLimit.mockResolvedValue([dbUser]);

    await expect(requireRole(["super_admin"])).rejects.toThrow("REDIRECT:/");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("rol permitido devuelve la fila sin redirigir", async () => {
    auth.mockResolvedValue({ userId: "clerk_1" });
    selectLimit.mockResolvedValue([dbUser]);

    const result = await requireRole(["organizer", "admin"]);

    expect(result).toEqual(dbUser);
    expect(redirect).not.toHaveBeenCalled();
  });
});
