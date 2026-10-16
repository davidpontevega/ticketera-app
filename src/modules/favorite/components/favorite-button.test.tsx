import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FavoriteButton } from "./favorite-button";
import { FavoritesProvider } from "./favorites-provider";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const setFavoriteAction = vi.fn();
vi.mock("../actions/favorite.actions", () => ({
  setFavoriteAction: (...args: unknown[]) => setFavoriteAction(...args),
}));

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

function renderButton(opts: { ids?: string[]; isAuthenticated?: boolean } = {}) {
  render(
    <FavoritesProvider favoriteEventIds={opts.ids ?? []} isAuthenticated={opts.isAuthenticated ?? true}>
      <FavoriteButton eventId={EVENT_ID} title="Rock" />
    </FavoritesProvider>,
  );
  return screen.getByRole("button", { name: "Agregar a favoritos: Rock" });
}

beforeEach(() => {
  push.mockReset();
  setFavoriteAction.mockReset();
});
afterEach(cleanup);

describe("FavoriteButton", () => {
  it("reflects the initial state", () => {
    expect(renderButton({ ids: [EVENT_ID] }).getAttribute("aria-pressed")).toBe("true");
  });

  it("is not pressed when the event is not a favorite", () => {
    expect(renderButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("toggles optimistically and calls the action with the desired state", async () => {
    setFavoriteAction.mockResolvedValue({ status: "success" });
    const button = renderButton();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(setFavoriteAction).toHaveBeenCalledWith({ eventId: EVENT_ID, favorite: true });
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it("rolls back when the action fails", async () => {
    setFavoriteAction.mockResolvedValue({ status: "error" });
    const button = renderButton();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button.getAttribute("aria-pressed")).toBe("false");
  });

  it("is disabled while the action is pending", async () => {
    let resolve!: (value: unknown) => void;
    setFavoriteAction.mockReturnValue(new Promise((r) => (resolve = r)));
    const button = renderButton();

    await act(async () => {
      fireEvent.click(button);
    });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-pressed")).toBe("true");

    await act(async () => resolve({ status: "success" }));
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("sends anonymous users to login without calling the action", () => {
    window.history.pushState({}, "", "/events/rock");
    fireEvent.click(renderButton({ isAuthenticated: false }));

    expect(setFavoriteAction).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login?redirect=%2Fevents%2Frock");
  });
});
