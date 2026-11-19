import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStaffCommand } from "@/hooks/use-staff-command";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStaffCommand", () => {
  it("manda o comando com o papel, relê a tela e libera o botão", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
    const refresh = vi.fn(async () => {});
    const { result } = renderHook(() => useStaffCommand("kitchen", refresh));

    await act(() => result.current.run("i1", "/api/staff/items/i1/status", { to: "preparing" }));

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/staff/items/i1/status?role=kitchen");
    expect(init?.body).toBe(JSON.stringify({ to: "preparing" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(result.current.busy).toBeNull();
    expect(result.current.message).toBe("");
  });

  it("guarda a mensagem de erro e relê mesmo assim", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: "invalid_transition", message: "Isso não pode ser feito agora." }, { status: 409 }),
    );
    const refresh = vi.fn(async () => {});
    const { result } = renderHook(() => useStaffCommand("waiter", refresh));
    await act(() => result.current.run("t1", "/api/staff/tabs/t1/approve"));
    expect(result.current.message).toBe("Isso não pode ser feito agora.");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
