import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const accountsCreate = vi.fn();
const accountsRetrieve = vi.fn();
const accountLinksCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    accounts: { create: (...a: unknown[]) => accountsCreate(...a), retrieve: (...a: unknown[]) => accountsRetrieve(...a) },
    accountLinks: { create: (...a: unknown[]) => accountLinksCreate(...a) },
  },
}));

const set = vi.fn();
const where = vi.fn();
const limit = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    update: () => ({ set: (v: unknown) => (set(v), { where }) }),
    select: () => ({ from: () => ({ where: () => ({ limit }) }) }),
  },
}));

const { startConnectOnboarding, syncOnboardingStatus, getPayoutAccount } = await import("./connect.service");

const ORIGIN = "http://localhost:3000";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("STRIPE_CONNECT_ENABLED", "true");
  accountsCreate.mockResolvedValue({ id: "acct_new" });
  accountLinksCreate.mockResolvedValue({ url: "https://connect.stripe.com/x" });
  where.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe("startConnectOnboarding", () => {
  it("con el flag apagado no llama a Stripe", async () => {
    vi.stubEnv("STRIPE_CONNECT_ENABLED", "");
    expect(await startConnectOnboarding({ id: "u1", stripeAccountId: null }, ORIGIN)).toEqual({ error: "connect-disabled" });
    expect(accountsCreate).not.toHaveBeenCalled();
    expect(accountLinksCreate).not.toHaveBeenCalled();
  });

  it("crea la cuenta Express solo si falta y la guarda como pending", async () => {
    const result = await startConnectOnboarding({ id: "u1", stripeAccountId: null }, ORIGIN);
    expect(result).toEqual({ url: "https://connect.stripe.com/x" });
    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "express", capabilities: { transfers: { requested: true } } }),
      { idempotencyKey: "connect-account-u1" },
    );
    expect(set).toHaveBeenCalledWith({ stripeAccountId: "acct_new", stripeOnboardingStatus: "pending" });
    expect(accountLinksCreate).toHaveBeenCalledWith({
      account: "acct_new",
      type: "account_onboarding",
      return_url: `${ORIGIN}/organizer/payments?connect=return`,
      refresh_url: `${ORIGIN}/organizer/payments?connect=refresh`,
    });
  });

  it("con cuenta existente solo crea un AccountLink nuevo", async () => {
    await startConnectOnboarding({ id: "u1", stripeAccountId: "acct_old" }, ORIGIN);
    expect(accountsCreate).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(accountLinksCreate).toHaveBeenCalledWith(expect.objectContaining({ account: "acct_old" }));
  });
});

describe("syncOnboardingStatus", () => {
  it("sin cuenta devuelve not_started sin llamar a Stripe", async () => {
    expect(await syncOnboardingStatus({ id: "u1", stripeAccountId: null })).toBe("not_started");
    expect(accountsRetrieve).not.toHaveBeenCalled();
  });

  it("persiste complete cuando la cuenta puede recibir transfers", async () => {
    accountsRetrieve.mockResolvedValue({ details_submitted: true, capabilities: { transfers: "active" } });
    expect(await syncOnboardingStatus({ id: "u1", stripeAccountId: "acct_1" })).toBe("complete");
    expect(set).toHaveBeenCalledWith({ stripeOnboardingStatus: "complete" });
  });

  it("persiste pending si falta algo", async () => {
    accountsRetrieve.mockResolvedValue({ details_submitted: true, capabilities: { transfers: "pending" } });
    expect(await syncOnboardingStatus({ id: "u1", stripeAccountId: "acct_1" })).toBe("pending");
    expect(set).toHaveBeenCalledWith({ stripeOnboardingStatus: "pending" });
  });
});

describe("getPayoutAccount", () => {
  it("devuelve la cuenta solo si el estado es complete", async () => {
    limit.mockResolvedValueOnce([{ accountId: "acct_1", status: "complete" }]);
    expect(await getPayoutAccount("u1")).toEqual({ accountId: "acct_1" });
  });

  it.each([
    [[{ accountId: "acct_1", status: "pending" }]],
    [[{ accountId: null, status: "not_started" }]],
    [[]],
  ])("devuelve null en %j", async (rows) => {
    limit.mockResolvedValueOnce(rows);
    expect(await getPayoutAccount("u1")).toBeNull();
  });
});
