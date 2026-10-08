import type { UserJSON, WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNameFromEmail } from "@/modules/auth";
import { users } from "../db/user.table";
import { SUPER_ADMIN_EMAIL } from "../constants/user.constants";
import { handleClerkWebhookEvent, mapClerkUser } from "./user-sync.service";

const insertValues = vi.fn();
const insertOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const updateSet = vi.fn();
const updateWhere = vi.fn().mockResolvedValue(undefined);
const insert = vi.fn();
const update = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    insert: (...args: unknown[]) => insert(...args),
    update: (...args: unknown[]) => update(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockImplementation(() => ({ values: insertValues }));
  insertValues.mockImplementation(() => ({ onConflictDoUpdate: insertOnConflictDoUpdate }));
  update.mockImplementation(() => ({ set: updateSet }));
  updateSet.mockImplementation(() => ({ where: updateWhere }));
});

function buildUserJson(overrides: {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddressId?: string | null;
  emails?: Array<{ id: string; emailAddress: string; verified?: boolean }>;
  publicMetadata?: Record<string, unknown> | null;
}): UserJSON {
  const emails = overrides.emails ?? [{ id: "idn_1", emailAddress: "user@example.com" }];
  return {
    id: overrides.id ?? "user_1",
    first_name: overrides.firstName ?? null,
    last_name: overrides.lastName ?? null,
    primary_email_address_id: overrides.primaryEmailAddressId ?? (emails[0]?.id ?? null),
    email_addresses: emails.map((email) => ({
      id: email.id,
      email_address: email.emailAddress,
      object: "email_address",
      verification: email.verified ? { status: "verified" } : null,
      linked_to: [],
    })),
    public_metadata: overrides.publicMetadata ?? {},
  } as unknown as UserJSON;
}

function buildEvent(type: string, data: unknown): WebhookEvent {
  return {
    type,
    object: "event",
    data,
    event_attributes: { http_request: { client_ip: "", user_agent: "" } },
    timestamp: Date.now(),
    instance_id: "ins_1",
  } as unknown as WebhookEvent;
}

describe("mapClerkUser", () => {
  it("usa el email primario aunque no sea el primero del array, normalizado a minusculas", () => {
    const data = buildUserJson({
      firstName: "Maria",
      lastName: "Perez",
      emails: [
        { id: "idn_1", emailAddress: "first@example.com" },
        { id: "idn_2", emailAddress: "Second@Example.com" },
      ],
      primaryEmailAddressId: "idn_2",
    });

    expect(mapClerkUser(data).email).toBe("second@example.com");
  });

  it("arma fullName con nombre y apellido", () => {
    const data = buildUserJson({ firstName: "Maria", lastName: "Perez" });

    expect(mapClerkUser(data).fullName).toBe("Maria Perez");
  });

  it("sin nombre cae a getNameFromEmail", () => {
    const data = buildUserJson({
      firstName: null,
      lastName: null,
      emails: [{ id: "idn_1", emailAddress: "jon.doe@example.com" }],
    });

    expect(mapClerkUser(data).fullName).toBe(getNameFromEmail("jon.doe@example.com"));
  });

  it("sin emails lanza", () => {
    const data = buildUserJson({ emails: [] });

    expect(() => mapClerkUser(data)).toThrow();
  });

  it("email primario = SUPER_ADMIN_EMAIL verificado -> super_admin", () => {
    const data = buildUserJson({
      emails: [{ id: "idn_1", emailAddress: SUPER_ADMIN_EMAIL, verified: true }],
    });

    expect(mapClerkUser(data).role).toBe("super_admin");
  });

  it("email primario = SUPER_ADMIN_EMAIL en mayusculas y verificado -> super_admin", () => {
    const data = buildUserJson({
      emails: [{ id: "idn_1", emailAddress: "PontevegaDavid@gmail.com", verified: true }],
    });

    expect(mapClerkUser(data).role).toBe("super_admin");
  });

  it("email primario = SUPER_ADMIN_EMAIL pero sin verificar -> customer", () => {
    const data = buildUserJson({
      emails: [{ id: "idn_1", emailAddress: SUPER_ADMIN_EMAIL, verified: false }],
    });

    expect(mapClerkUser(data).role).toBe("customer");
  });

  it("SUPER_ADMIN_EMAIL presente pero no como email primario -> no es super admin", () => {
    const data = buildUserJson({
      emails: [
        { id: "idn_1", emailAddress: "other@example.com", verified: true },
        { id: "idn_2", emailAddress: SUPER_ADMIN_EMAIL, verified: true },
      ],
      primaryEmailAddressId: "idn_1",
    });

    expect(mapClerkUser(data).role).toBe("customer");
  });

  it("public_metadata.role = organizer -> organizer", () => {
    const data = buildUserJson({ publicMetadata: { role: "organizer" } });

    expect(mapClerkUser(data).role).toBe("organizer");
  });

  it("public_metadata.role = admin -> admin", () => {
    const data = buildUserJson({ publicMetadata: { role: "admin" } });

    expect(mapClerkUser(data).role).toBe("admin");
  });

  it("public_metadata.role = super_admin nunca se acepta -> customer", () => {
    const data = buildUserJson({ publicMetadata: { role: "super_admin" } });

    expect(mapClerkUser(data).role).toBe("customer");
  });

  it("public_metadata.role con valor desconocido -> customer", () => {
    const data = buildUserJson({ publicMetadata: { role: "hacker" } });

    expect(mapClerkUser(data).role).toBe("customer");
  });

  it("public_metadata ausente o null -> customer", () => {
    expect(mapClerkUser(buildUserJson({})).role).toBe("customer");
    expect(mapClerkUser(buildUserJson({ publicMetadata: null })).role).toBe("customer");
  });

  it("super admin gana sobre metadata", () => {
    const data = buildUserJson({
      emails: [{ id: "idn_1", emailAddress: SUPER_ADMIN_EMAIL, verified: true }],
      publicMetadata: { role: "admin" },
    });

    expect(mapClerkUser(data).role).toBe("super_admin");
  });
});

describe("handleClerkWebhookEvent", () => {
  it("user.created hace upsert con los campos mapeados y el role resuelto (customer)", async () => {
    const data = buildUserJson({ id: "user_1", firstName: "Maria", lastName: "Perez" });

    await handleClerkWebhookEvent(buildEvent("user.created", data));

    expect(insert).toHaveBeenCalledTimes(1);
    const fields = insertValues.mock.calls[0]?.[0];
    expect(fields).toEqual({
      clerkId: "user_1",
      email: "user@example.com",
      fullName: "Maria Perez",
      role: "customer",
    });
    const setArg = insertOnConflictDoUpdate.mock.calls[0]?.[0]?.set;
    expect(setArg).not.toHaveProperty("role");
    expect(insertOnConflictDoUpdate).toHaveBeenCalledWith({
      target: users.clerkId,
      set: expect.objectContaining({
        email: "user@example.com",
        fullName: "Maria Perez",
        deletedAt: null,
        updatedAt: expect.any(Date),
      }),
    });
  });

  it("user.updated hace upsert con los campos mapeados", async () => {
    const data = buildUserJson({ id: "user_2", firstName: "Juan", lastName: "Lopez" });

    await handleClerkWebhookEvent(buildEvent("user.updated", data));

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith({
      clerkId: "user_2",
      email: "user@example.com",
      fullName: "Juan Lopez",
      role: "customer",
    });
  });

  it("user.updated para el super admin incluye role en values y en el set del conflicto", async () => {
    const data = buildUserJson({
      id: "user_super",
      emails: [{ id: "idn_1", emailAddress: SUPER_ADMIN_EMAIL, verified: true }],
    });

    await handleClerkWebhookEvent(buildEvent("user.updated", data));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: "user_super", role: "super_admin" }),
    );
    const setArg = insertOnConflictDoUpdate.mock.calls[0]?.[0]?.set;
    expect(setArg).toHaveProperty("role", "super_admin");
  });

  it("user.updated para un admin invitado no incluye role en el set del conflicto", async () => {
    const data = buildUserJson({
      id: "user_admin",
      publicMetadata: { role: "admin" },
    });

    await handleClerkWebhookEvent(buildEvent("user.updated", data));

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ clerkId: "user_admin", role: "admin" }),
    );
    const setArg = insertOnConflictDoUpdate.mock.calls[0]?.[0]?.set;
    expect(setArg).not.toHaveProperty("role");
  });

  it("user.deleted llama al soft delete con data.id", async () => {
    await handleClerkWebhookEvent(buildEvent("user.deleted", { id: "user_3", object: "user", deleted: true }));

    expect(insert).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith({ deletedAt: expect.any(Date), updatedAt: expect.any(Date) });
    expect(updateWhere).toHaveBeenCalledWith(eq(users.clerkId, "user_3"));
  });

  it("otro tipo de evento no toca la DB", async () => {
    await handleClerkWebhookEvent(buildEvent("session.created", {}));

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
