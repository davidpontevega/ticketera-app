import { beforeEach, describe, expect, it } from "vitest";

import { RESET_TOKEN_TTL_MS, useDevMailStore } from "./dev-mail.store";

const { getState, setState } = useDevMailStore;
const NOW = new Date("2026-09-29T12:00:00Z");

describe("useDevMailStore", () => {
  beforeEach(() => {
    setState({ emails: [], resetTokens: [] });
    localStorage.clear();
  });

  it("sends emails to the mock inbox, newest first", () => {
    getState().sendMockEmail({
      to: "a@x.com",
      subject: "1",
      body: "",
      actionLabel: "",
      actionHref: "/",
    });
    const second = getState().sendMockEmail({
      to: "a@x.com",
      subject: "2",
      body: "",
      actionLabel: "",
      actionHref: "/",
    });
    expect(getState().emails.map((email) => email.subject)).toEqual(["2", "1"]);
    expect(second.read).toBe(false);
    getState().markRead(second.id);
    expect(getState().emails[0].read).toBe(true);
    expect(localStorage.getItem("ticketera-dev-mail")).toContain('"subject":"2"');
  });

  it("creates random 64 char tokens that expire in 30 minutes", () => {
    const token = getState().createResetToken("a@x.com", NOW);
    expect(token.token).toMatch(/^[0-9a-f]{64}$/);
    expect(Date.parse(token.expiresAt) - NOW.getTime()).toBe(RESET_TOKEN_TTL_MS);
    expect(getState().createResetToken("a@x.com", NOW).token).not.toBe(token.token);
  });

  it("reports token status", () => {
    const { token } = getState().createResetToken("a@x.com", NOW);
    expect(getState().getResetTokenStatus(token, NOW)).toEqual({
      status: "valid",
      email: "a@x.com",
    });
    expect(getState().getResetTokenStatus("nope", NOW)).toEqual({ status: "invalid" });
    const later = new Date(NOW.getTime() + RESET_TOKEN_TTL_MS + 1);
    expect(getState().getResetTokenStatus(token, later)).toEqual({ status: "expired" });
  });

  it("consumes a token only once", () => {
    const { token } = getState().createResetToken("a@x.com", NOW);
    expect(getState().consumeResetToken(token, NOW)).toBe("a@x.com");
    expect(getState().consumeResetToken(token, NOW)).toBeNull();
    expect(getState().getResetTokenStatus(token, NOW)).toEqual({ status: "used" });
  });
});
