import { beforeEach, describe, expect, it } from "vitest";

import { DEMO_ACCOUNT, hashPassword } from "../utils/auth.utils";
import { useAuthStore } from "./auth.store";

const { getState, setState, getInitialState } = useAuthStore;

describe("useAuthStore", () => {
  beforeEach(() => {
    setState(getInitialState());
    localStorage.clear();
  });

  it("seeds the demo account with a valid hash", async () => {
    const result = await getState().login({
      email: DEMO_ACCOUNT.email,
      password: DEMO_ACCOUNT.password,
    });
    expect(result).toEqual({
      ok: true,
      user: { fullName: "Cuenta Demo", email: "demo@ticketera.pe" },
    });
    expect(getState().accounts[0].passwordHash).toBe(
      await hashPassword(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password),
    );
  });

  it("registers an account with a hashed password and signs in", async () => {
    const result = await getState().register({
      fullName: " Maria Perez ",
      email: "Maria@Example.com",
      password: "secreto123",
    });
    expect(result).toEqual({
      ok: true,
      user: { fullName: "Maria Perez", email: "maria@example.com" },
    });
    const stored = localStorage.getItem("ticketera-auth") ?? "";
    expect(stored).toContain("maria@example.com");
    expect(stored).not.toContain("secreto123");
    expect(getState().user?.email).toBe("maria@example.com");
  });

  it("rejects a duplicated email", async () => {
    await getState().register({
      fullName: "Maria",
      email: "maria@example.com",
      password: "secreto123",
    });
    expect(
      await getState().register({
        fullName: "Otra",
        email: "MARIA@example.com",
        password: "otra1234",
      }),
    ).toEqual({ ok: false, field: "email", message: "Ya existe una cuenta con ese correo" });
  });

  it("validates login credentials", async () => {
    await getState().register({
      fullName: "Maria",
      email: "maria@example.com",
      password: "secreto123",
    });
    getState().logout();
    expect(await getState().login({ email: "nadie@example.com", password: "x" })).toMatchObject({
      ok: false,
      field: "email",
    });
    expect(await getState().login({ email: "maria@example.com", password: "mala" })).toEqual({
      ok: false,
      field: "password",
      message: "La contraseña es incorrecta",
    });
    expect(
      await getState().login({ email: "MARIA@example.com", password: "secreto123" }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("creates Google accounts and blocks password login for them", async () => {
    const user = getState().loginWithGoogle({ fullName: "Ana Google", email: "ana@gmail.com" });
    expect(user).toEqual({ fullName: "Ana Google", email: "ana@gmail.com" });
    getState().logout();
    expect(await getState().login({ email: "ana@gmail.com", password: "x" })).toEqual({
      ok: false,
      field: "password",
      message: "Esta cuenta usa Google. Continua con Google.",
    });
  });

  it("links Google to an existing password account", async () => {
    await getState().register({
      fullName: "Maria",
      email: "maria@example.com",
      password: "secreto123",
    });
    const user = getState().loginWithGoogle({
      fullName: "Otro Nombre",
      email: "maria@example.com",
    });
    expect(user.fullName).toBe("Maria");
    const account = getState().accounts.find((item) => item.email === "maria@example.com");
    expect(account?.providers).toEqual(["password", "google"]);
  });

  it("updates the password", async () => {
    await getState().register({
      fullName: "Maria",
      email: "maria@example.com",
      password: "secreto123",
    });
    await getState().updatePassword("maria@example.com", "nueva4567");
    expect(
      await getState().login({ email: "maria@example.com", password: "secreto123" }),
    ).toMatchObject({
      ok: false,
    });
    expect(
      await getState().login({ email: "maria@example.com", password: "nueva4567" }),
    ).toMatchObject({
      ok: true,
    });
  });

  it("migrates the v0 state keeping the session", async () => {
    localStorage.setItem(
      "ticketera-auth",
      JSON.stringify({
        state: { user: { fullName: "Maria", email: "maria@example.com" }, knownUsers: [] },
        version: 0,
      }),
    );
    await useAuthStore.persist.rehydrate();
    expect(getState().user?.email).toBe("maria@example.com");
    expect(getState().accounts.map((account) => account.email)).toEqual(["demo@ticketera.pe"]);
  });
});
