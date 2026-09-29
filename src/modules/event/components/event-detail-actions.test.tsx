import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDetailActions } from "./event-detail-actions";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubNavigator(value: Partial<Navigator>) {
  vi.stubGlobal("navigator", { ...navigator, ...value });
}

describe("EventDetailActions", () => {
  it("toggles aria-pressed on the save button", () => {
    render(<EventDetailActions title="Bad Bunny" />);
    const save = screen.getByRole("button", { name: "Guardar evento" });

    expect(save.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(save);
    expect(save.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(save);
    expect(save.getAttribute("aria-pressed")).toBe("false");
  });

  it("uses the native share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share });
    render(<EventDetailActions title="Bad Bunny" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartir evento" }));
    });

    expect(share).toHaveBeenCalledWith({ title: "Bad Bunny", url: window.location.href });
    expect(screen.queryByText("Enlace copiado")).toBeNull();
  });

  it("copies the link when native share is not available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: undefined, clipboard: { writeText } as unknown as Clipboard });
    render(<EventDetailActions title="Bad Bunny" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Compartir evento" }));
    });

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByText("Enlace copiado")).toBeTruthy();
  });
});
