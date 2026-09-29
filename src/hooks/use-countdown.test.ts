import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCountdown } from "./use-countdown";

describe("useCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the given seconds formatted as MM:SS", () => {
    const { result } = renderHook(() => useCountdown(600));
    expect(result.current).toEqual({ secondsLeft: 600, isExpired: false, label: "10:00" });
  });

  it("decreases every second", () => {
    const { result } = renderHook(() => useCountdown(600));
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(result.current.secondsLeft).toBe(588);
    expect(result.current.label).toBe("09:48");
  });

  it("stops at zero and reports expiration", () => {
    const { result } = renderHook(() => useCountdown(2));
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current).toEqual({ secondsLeft: 0, isExpired: true, label: "00:00" });
  });
});
