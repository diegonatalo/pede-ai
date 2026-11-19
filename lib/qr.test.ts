// @vitest-environment node
import { describe, expect, it } from "vitest";
import { qrSvg, tableUrl } from "@/lib/qr";

describe("tableUrl", () => {
  it("monta o link da mesa a partir do endereço do site", () => {
    expect(tableUrl("https://dn-pede-ai.vercel.app", "mesa-3")).toBe("https://dn-pede-ai.vercel.app/mesa/mesa-3");
    expect(tableUrl("http://localhost:3000/", "mesa-1")).toBe("http://localhost:3000/mesa/mesa-1");
  });

  it("protege ids com caracteres especiais", () => {
    expect(tableUrl("https://x.dev", "varanda 2")).toBe("https://x.dev/mesa/varanda%202");
  });
});

describe("qrSvg", () => {
  it("gera um SVG preto no branco", async () => {
    const svg = await qrSvg("https://dn-pede-ai.vercel.app/mesa/mesa-3");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("#000000");
    expect(svg).toContain("#ffffff");
  });

  it("gera códigos diferentes para mesas diferentes", async () => {
    expect(await qrSvg("https://x.dev/mesa/mesa-1")).not.toBe(await qrSvg("https://x.dev/mesa/mesa-2"));
  });
});
