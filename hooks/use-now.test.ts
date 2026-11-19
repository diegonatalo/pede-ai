import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNow } from "@/hooks/use-now";

afterEach(() => vi.useRealTimers());

describe("useNow", () => {
  it("devolve a hora atual e avança a cada 30 segundos", () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T20:00:00.000Z") });
    const { result, unmount } = renderHook(() => useNow());
    const start = result.current;
    expect(start).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current - start).toBe(30_000);
    unmount();
  });
});
