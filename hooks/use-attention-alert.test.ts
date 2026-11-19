import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAttentionAlert } from "@/hooks/use-attention-alert";

const vibrate = vi.fn();
const start = vi.fn();

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => {});
  createOscillator() {
    return { frequency: { value: 0 }, connect: (node: unknown) => node, start, stop: vi.fn() };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: (node: unknown) => node,
    };
  }
}

beforeEach(() => {
  vibrate.mockClear();
  start.mockClear();
  Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAttentionAlert", () => {
  it("vibra quando aparece algo novo, e não quando diminui", () => {
    const { rerender } = renderHook(({ count }) => useAttentionAlert(count), { initialProps: { count: 1 } });
    expect(vibrate).not.toHaveBeenCalled();
    rerender({ count: 2 });
    expect(vibrate).toHaveBeenCalledOnce();
    rerender({ count: 0 });
    expect(vibrate).toHaveBeenCalledOnce();
  });

  it("toca o som só depois de ligado", () => {
    const { result, rerender } = renderHook(({ count }) => useAttentionAlert(count), { initialProps: { count: 0 } });
    rerender({ count: 1 });
    expect(start).not.toHaveBeenCalled();

    act(() => result.current.toggleSound());
    expect(result.current.soundOn).toBe(true);
    // Ao ligar, toca um bipe de teste (dois tons).
    expect(start).toHaveBeenCalledTimes(2);

    rerender({ count: 2 });
    expect(start).toHaveBeenCalledTimes(4);

    act(() => result.current.toggleSound());
    expect(result.current.soundOn).toBe(false);
  });
});
