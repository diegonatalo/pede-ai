import { describe, expect, it } from "vitest";
import { parseLocalDate, periodRange, toDateInput } from "@/lib/periods";

// Datas locais: o teste vale em qualquer fuso (o app calcula no fuso do aparelho).
const local = (year: number, month: number, day: number) => new Date(year, month - 1, day).toISOString();
const NOW = new Date(2026, 10, 20, 15, 30); // 20/11/2026, 15h30

describe("periodRange", () => {
  it("monta os períodos prontos a partir de agora", () => {
    expect(periodRange("today", NOW)).toEqual({ since: local(2026, 11, 20), until: local(2026, 11, 21), label: "Hoje" });
    expect(periodRange("yesterday", NOW)).toMatchObject({ since: local(2026, 11, 19), until: local(2026, 11, 20) });
    expect(periodRange("last7", NOW)).toMatchObject({ since: local(2026, 11, 14), until: local(2026, 11, 21) });
    expect(periodRange("month", NOW)).toMatchObject({ since: local(2026, 11, 1), until: local(2026, 11, 21) });
  });

  it("aceita datas escolhidas, as duas incluídas", () => {
    expect(periodRange("custom", NOW, { from: "2026-10-01", to: "2026-10-31" })).toEqual({
      since: local(2026, 10, 1),
      until: local(2026, 11, 1),
      label: "01/10/2026 a 31/10/2026",
    });
    expect(periodRange("custom", NOW, { from: "2026-11-05", to: "2026-11-05" })?.label).toBe("05/11/2026");
  });

  it("recusa datas inválidas, invertidas ou um período maior que um ano", () => {
    expect(periodRange("custom", NOW, { from: "2026-11-10", to: "2026-11-01" })).toBeNull();
    expect(periodRange("custom", NOW, { from: "2026-02-30", to: "2026-03-01" })).toBeNull();
    expect(periodRange("custom", NOW, { from: "2024-01-01", to: "2026-11-01" })).toBeNull();
    expect(periodRange("custom", NOW)).toBeNull();
  });
});

describe("datas dos campos", () => {
  it("lê e escreve AAAA-MM-DD no fuso local", () => {
    expect(parseLocalDate("2026-11-20")?.getDate()).toBe(20);
    expect(parseLocalDate("20/11/2026")).toBeNull();
    expect(toDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
