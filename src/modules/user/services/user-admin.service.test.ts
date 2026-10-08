import { and, desc, eq, ilike, isNull, ne, or } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { users } from "../db/user.table";
import { USERS_PAGE_SIZE } from "../constants/user.constants";
import {
  changeUserRole,
  deleteUser,
  inviteUser,
  listUsers,
} from "./user-admin.service";

const createInvitation = vi.fn();
const deleteClerkUser = vi.fn();
const clerkClient = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: (...args: unknown[]) => clerkClient(...args),
}));

class FakeClerkAPIResponseError extends Error {
  errors: Array<{ code: string }>;
  status: number;
  constructor(errors: Array<{ code: string }>, status = 422) {
    super("clerk-error");
    this.errors = errors;
    this.status = status;
  }
}
vi.mock("@clerk/nextjs/errors", () => ({
  isClerkAPIResponseError: (
    error: unknown,
  ): error is FakeClerkAPIResponseError =>
    error instanceof FakeClerkAPIResponseError,
}));

const softDeleteUserByClerkId = vi.fn();
vi.mock("./user-sync.service", () => ({
  softDeleteUserByClerkId: (...args: unknown[]) =>
    softDeleteUserByClerkId(...args),
}));

// Cadena de `select`: where().limit(n) se usa para lookups de una fila (await directo);
// where().orderBy().limit(n).offset(n) se usa para la lista paginada.
const select = vi.fn();
const selectFrom = vi.fn();
const selectWhere = vi.fn();
const selectLimit = vi.fn();
const selectOrderBy = vi.fn();
const selectPaginatedLimit = vi.fn();
const selectOffset = vi.fn();
const dbCount = vi.fn();

const update = vi.fn();
const updateSet = vi.fn();
const updateWhere = vi.fn();
const updateReturning = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => select(...args),
    update: (...args: unknown[]) => update(...args),
    $count: (...args: unknown[]) => dbCount(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();

  select.mockImplementation(() => ({ from: selectFrom }));
  selectFrom.mockImplementation(() => ({ where: selectWhere }));
  selectWhere.mockImplementation(() => ({
    limit: selectLimit,
    orderBy: selectOrderBy,
  }));
  selectLimit.mockResolvedValue([]);
  selectOrderBy.mockImplementation(() => ({ limit: selectPaginatedLimit }));
  selectPaginatedLimit.mockImplementation(() => ({ offset: selectOffset }));
  selectOffset.mockResolvedValue([]);
  dbCount.mockResolvedValue(0);

  update.mockImplementation(() => ({ set: updateSet }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
  updateWhere.mockImplementation(() => ({ returning: updateReturning }));
  updateReturning.mockResolvedValue([]);

  clerkClient.mockResolvedValue({
    invitations: { createInvitation },
    users: { deleteUser: deleteClerkUser },
  });
});

describe("listUsers", () => {
  it("sin filtros usa solo el status default (active)", async () => {
    await listUsers({ status: "active", page: 1 });

    expect(selectWhere).toHaveBeenCalledWith(and(isNull(users.deletedAt)));
  });

  it("aplica el filtro de rol", async () => {
    await listUsers({ status: "active", role: "organizer", page: 1 });

    expect(selectWhere).toHaveBeenCalledWith(
      and(isNull(users.deletedAt), eq(users.role, "organizer")),
    );
  });

  it("escapa % y _ en la busqueda q", async () => {
    await listUsers({ status: "active", q: "50%_off\\x", page: 1 });

    const expectedPattern = "%50\\%\\_off\\\\x%";
    expect(selectWhere).toHaveBeenCalledWith(
      and(
        isNull(users.deletedAt),
        or(
          ilike(users.fullName, expectedPattern),
          ilike(users.email, expectedPattern),
        ),
      ),
    );
  });

  it("status=all no filtra por deletedAt", async () => {
    await listUsers({ status: "all", page: 1 });

    expect(selectWhere).toHaveBeenCalledWith(and());
  });

  it("calcula offset segun la pagina pedida", async () => {
    dbCount.mockResolvedValue(100);

    const result = await listUsers({ status: "active", page: 3 });

    expect(selectPaginatedLimit).toHaveBeenCalledWith(USERS_PAGE_SIZE);
    expect(selectOffset).toHaveBeenCalledWith((3 - 1) * USERS_PAGE_SIZE);
    expect(result.page).toBe(3);
  });

  it("si la pagina pedida excede el total, usa la ultima pagina valida", async () => {
    dbCount.mockResolvedValue(15); // 2 paginas con USERS_PAGE_SIZE = 10

    const result = await listUsers({ status: "active", page: 9 });

    expect(result.page).toBe(2);
    expect(selectOffset).toHaveBeenCalledWith((2 - 1) * USERS_PAGE_SIZE);
  });

  it("con total 0, la pagina efectiva es 1", async () => {
    dbCount.mockResolvedValue(0);

    const result = await listUsers({ status: "active", page: 5 });

    expect(result.page).toBe(1);
    expect(result.total).toBe(0);
  });

  it("ordena por created_at desc, id desc", async () => {
    await listUsers({ status: "active", page: 1 });

    expect(selectOrderBy).toHaveBeenCalledWith(
      desc(users.createdAt),
      desc(users.id),
    );
  });
});

describe("inviteUser", () => {
  const input = { email: "nuevo@test.com", role: "organizer" as const };

  it("email ya activo en la DB devuelve already-registered sin llamar a Clerk", async () => {
    selectLimit.mockResolvedValue([{ id: "user-1" }]);

    const result = await inviteUser(input, { origin: "https://app.test" });

    expect(result).toEqual({ ok: false, error: "already-registered" });
    expect(clerkClient).not.toHaveBeenCalled();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(selectWhere).toHaveBeenCalledWith(
      and(eq(users.email, input.email), isNull(users.deletedAt)),
    );
  });

  it("caso feliz llama createInvitation con publicMetadata.role y redirectUrl terminado en /register", async () => {
    selectLimit.mockResolvedValue([]);
    createInvitation.mockResolvedValue({});

    const result = await inviteUser(input, { origin: "https://app.test" });

    expect(result).toEqual({ ok: true });
    expect(createInvitation).toHaveBeenCalledWith({
      emailAddress: input.email,
      publicMetadata: { role: input.role },
      redirectUrl: "https://app.test/register",
    });
  });

  it("duplicate_record -> already-invited", async () => {
    selectLimit.mockResolvedValue([]);
    createInvitation.mockRejectedValue(
      new FakeClerkAPIResponseError([{ code: "duplicate_record" }]),
    );

    const result = await inviteUser(input, { origin: "https://app.test" });

    expect(result).toEqual({ ok: false, error: "already-invited" });
  });

  it("form_identifier_exists -> already-registered", async () => {
    selectLimit.mockResolvedValue([]);
    createInvitation.mockRejectedValue(
      new FakeClerkAPIResponseError([{ code: "form_identifier_exists" }]),
    );

    const result = await inviteUser(input, { origin: "https://app.test" });

    expect(result).toEqual({ ok: false, error: "already-registered" });
  });

  it("error generico -> invitation-failed", async () => {
    selectLimit.mockResolvedValue([]);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    createInvitation.mockRejectedValue(new Error("network down"));

    const result = await inviteUser(input, { origin: "https://app.test" });

    expect(result).toEqual({ ok: false, error: "invitation-failed" });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});

describe("changeUserRole", () => {
  const input = { userId: "user-1", role: "admin" as const };

  it("devuelve true cuando el update afecta 1 fila", async () => {
    updateReturning.mockResolvedValue([{ id: "user-1" }]);

    const result = await changeUserRole(input);

    expect(result).toBe(true);
    expect(updateWhere).toHaveBeenCalledWith(
      and(
        eq(users.id, input.userId),
        ne(users.role, "super_admin"),
        isNull(users.deletedAt),
      ),
    );
  });

  it("devuelve false cuando el update no afecta ninguna fila", async () => {
    updateReturning.mockResolvedValue([]);

    const result = await changeUserRole(input);

    expect(result).toBe(false);
  });
});

describe("deleteUser", () => {
  const input = { userId: "user-1" };

  it("sin fila activa (o super_admin) devuelve not-found sin llamar a Clerk", async () => {
    selectLimit.mockResolvedValue([]);

    const result = await deleteUser(input);

    expect(result).toEqual({ ok: false, error: "not-found" });
    expect(clerkClient).not.toHaveBeenCalled();
    expect(selectWhere).toHaveBeenCalledWith(
      and(
        eq(users.id, input.userId),
        ne(users.role, "super_admin"),
        isNull(users.deletedAt),
      ),
    );
  });

  it("caso feliz llama users.deleteUser y luego softDeleteUserByClerkId", async () => {
    selectLimit.mockResolvedValue([{ id: "user-1", clerkId: "clerk_1" }]);
    deleteClerkUser.mockResolvedValue({});

    const result = await deleteUser(input);

    expect(deleteClerkUser).toHaveBeenCalledWith("clerk_1");
    expect(softDeleteUserByClerkId).toHaveBeenCalledWith("clerk_1");
    expect(result).toEqual({ ok: true });
  });

  it("si Clerk responde 404, igual hace soft-delete y devuelve ok", async () => {
    selectLimit.mockResolvedValue([{ id: "user-1", clerkId: "clerk_1" }]);
    deleteClerkUser.mockRejectedValue(
      new FakeClerkAPIResponseError([{ code: "resource_not_found" }], 404),
    );

    const result = await deleteUser(input);

    expect(softDeleteUserByClerkId).toHaveBeenCalledWith("clerk_1");
    expect(result).toEqual({ ok: true });
  });

  it("si Clerk responde otro error, no hace soft-delete y devuelve delete-failed", async () => {
    selectLimit.mockResolvedValue([{ id: "user-1", clerkId: "clerk_1" }]);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    deleteClerkUser.mockRejectedValue(
      new FakeClerkAPIResponseError([{ code: "internal_error" }], 500),
    );

    const result = await deleteUser(input);

    expect(softDeleteUserByClerkId).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: "delete-failed" });
    consoleErrorSpy.mockRestore();
  });
});
