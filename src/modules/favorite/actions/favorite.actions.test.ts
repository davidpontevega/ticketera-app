import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentDbUser = vi.fn();
vi.mock("@/modules/user", () => ({ getCurrentDbUser: () => getCurrentDbUser() }));

const setFavorite = vi.fn();
vi.mock("../services/favorite.service", () => ({ setFavorite: (...args: unknown[]) => setFavorite(...args) }));

const { setFavoriteAction } = await import("./favorite.actions");

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentDbUser.mockResolvedValue({ id: "user-1" });
  setFavorite.mockResolvedValue("ok");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("setFavoriteAction", () => {
  it("sin sesion devuelve unauthenticated sin tocar el servicio", async () => {
    getCurrentDbUser.mockResolvedValue(null);
    expect(await setFavoriteAction({ eventId: ID, favorite: true })).toEqual({ status: "unauthenticated" });
    expect(setFavorite).not.toHaveBeenCalled();
  });

  it("usa el id del usuario de la sesion e ignora userId del input", async () => {
    const result = await setFavoriteAction({ eventId: ID, favorite: false, userId: "hacker" } as never);
    expect(result).toEqual({ status: "success" });
    expect(setFavorite).toHaveBeenCalledWith("user-1", ID, false);
  });

  it("payload invalido devuelve error sin llamar al servicio", async () => {
    expect(await setFavoriteAction({ eventId: "x", favorite: true })).toEqual({ status: "error" });
    expect(setFavorite).not.toHaveBeenCalled();
  });

  it("propaga not-found del servicio", async () => {
    setFavorite.mockResolvedValue("not-found");
    expect(await setFavoriteAction({ eventId: ID, favorite: true })).toEqual({ status: "not-found" });
  });

  it("ante excepcion devuelve error generico y loguea", async () => {
    setFavorite.mockRejectedValue(new Error("db down"));
    expect(await setFavoriteAction({ eventId: ID, favorite: true })).toEqual({ status: "error" });
    expect(console.error).toHaveBeenCalled();
  });
});
