import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFeed } from "@/hooks/use-feed";

const respond = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe("useFeed", () => {
  it("consulta depois do último seq e avisa quando mudou", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => respond({ lastSeq: 4, changed: false }))
      .mockImplementationOnce(() => respond({ lastSeq: 5, changed: true }));
    const onChange = vi.fn();
    renderHook(() => useFeed("/api/customer/feed", 4, onChange, 1000));

    await tick(1000);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/customer/feed?after=4");
    expect(onChange).not.toHaveBeenCalled();
    await tick(1000);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("junta o after a uma URL que já tem parâmetros", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond({ lastSeq: 1, changed: false }));
    renderHook(() => useFeed("/api/staff/feed?role=kitchen", 1, vi.fn(), 1000));
    await tick(1000);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/staff/feed?role=kitchen&after=1");
  });

  it("avisa quando perde o acesso, para a tela descobrir", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => respond({ error: "session_closed" }, 409));
    const onChange = vi.fn();
    renderHook(() => useFeed("/api/customer/feed", 1, onChange, 1000));
    await tick(1000);
    expect(onChange).toHaveBeenCalled();
  });

  it("não consulta com a aba escondida e consulta na hora ao voltar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond({ lastSeq: 1, changed: false }));
    renderHook(() => useFeed("/api/customer/feed", 1, vi.fn(), 1000));
    visibility = "hidden";
    await tick(3000);
    expect(fetchSpy).not.toHaveBeenCalled();

    visibility = "visible";
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("fica parado sem URL e para ao desmontar", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => respond({ lastSeq: 1, changed: false }));
    const { rerender, unmount } = renderHook(({ url }) => useFeed(url, 1, vi.fn(), 1000), {
      initialProps: { url: null as string | null },
    });
    await tick(3000);
    expect(fetchSpy).not.toHaveBeenCalled();
    rerender({ url: "/api/customer/feed" });
    await tick(1000);
    expect(fetchSpy).toHaveBeenCalledOnce();
    unmount();
    await tick(3000);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
