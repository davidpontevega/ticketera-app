import { beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeAction } from "./newsletter.actions";

const subscribe = vi.fn();
vi.mock("../services/newsletter.service", () => ({ subscribe: (e: string) => subscribe(e) }));

const IDLE = { status: "idle" } as const;
const form = (data: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
};

describe("subscribeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribe.mockResolvedValue(undefined);
  });

  it("guarda el correo normalizado y responde success", async () => {
    const result = await subscribeAction(IDLE, form({ email: " Ana@Correo.com " }));
    expect(subscribe).toHaveBeenCalledWith("ana@correo.com");
    expect(result.status).toBe("success");
  });

  it("responde lo mismo para un correo repetido", async () => {
    const first = await subscribeAction(IDLE, form({ email: "ana@correo.com" }));
    const second = await subscribeAction(IDLE, form({ email: "ana@correo.com" }));
    expect(second).toEqual(first);
  });

  it("honeypot lleno: success sin llamar al servicio", async () => {
    const result = await subscribeAction(IDLE, form({ email: "bot@spam.com", website: "http://spam" }));
    expect(result.status).toBe("success");
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("email invalido o ausente: error sin llamar al servicio", async () => {
    const invalid = await subscribeAction(IDLE, form({ email: "nope" }));
    const missing = await subscribeAction(IDLE, new FormData());
    expect(invalid).toEqual({ status: "error", message: "Correo invalido" });
    expect(missing.status).toBe("error");
    expect(subscribe).not.toHaveBeenCalled();
  });

  it("excepcion: error generico y log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    subscribe.mockRejectedValue(new Error("db down"));
    const result = await subscribeAction(IDLE, form({ email: "ana@correo.com" }));
    expect(result).toEqual({ status: "error", message: "No se pudo suscribir, intenta de nuevo" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
