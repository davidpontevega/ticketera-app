import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDetailActions } from "./event-detail-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/modules/favorite/actions/favorite.actions", () => ({ setFavoriteAction: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubNavigator(value: Partial<Navigator>) {
  vi.stubGlobal("navigator", { ...navigator, ...value });
}

describe("EventDetailActions", () => {
  it("renders the favorite button", () => {
    render(<EventDetailActions eventId="e1" title="Bad Bunny" />);

    expect(screen.getByRole("button", { name: "Agregar a favoritos: Bad Bunny" })).toBeTruthy();
  });

  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    render(<EventDetailActions eventId="e1" title="Bad Bunny" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartir evento" }));
    });

    expect(share).toHaveBeenCalledWith({ title: "Bad Bunny", url: window.location.href });
    expect(screen.queryByText("Enlace copiado")).toBeNull();
  });

  it("copies the link when native share is not available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: undefined, clipboard: { writeText } as unknown as Clipboard });
    render(<EventDetailActions eventId="e1" title="Bad Bunny" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartir evento" }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByText("Enlace copiado")).toBeTruthy();
  });
});
