// @vitest-environment node
import { describe, expect, it } from "vitest";
import { clientIp, rateKey, windowActive } from "@/lib/rate-limit";

describe("clientIp", () => {
  it("usa o primeiro endereço do x-forwarded-for, depois o x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "200.1.2.3, 10.0.0.1" }))).toBe("200.1.2.3");
    expect(clientIp(new Headers({ "x-real-ip": "200.9.9.9" }))).toBe("200.9.9.9");
    expect(clientIp(new Headers())).toBe("local");
  });
});

describe("rateKey", () => {
  it("guarda um HMAC do endereço, nunca o endereço, separado por escopo", () => {
    const key = rateKey("join", "200.1.2.3", "segredo");
    expect(key.startsWith("join:")).toBe(true);
    expect(key).not.toContain("200.1.2.3");
    expect(rateKey("join", "200.1.2.3", "segredo")).toBe(key);
    expect(rateKey("join", "200.1.2.4", "segredo")).not.toBe(key);
    expect(rateKey("join", "200.1.2.3", "outro")).not.toBe(key);
    expect(rateKey("login", "200.1.2.3", "segredo")).not.toBe(key);
  });
});

describe("windowActive", () => {
  it("vale enquanto não passou a janela", () => {
    expect(windowActive(1000, 1500, 600)).toBe(true);
    expect(windowActive(1000, 1600, 600)).toBe(false);
  });
});
