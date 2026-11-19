import { describe, expect, it } from "vitest";
import { formatCents, parseCents, percentOf, sumCents } from "@/lib/money";

// O Intl separa "R$" do número com espaço não separável.
const normalize = (text: string) => text.replace(/ /g, " ");

describe("formatCents", () => {
  it("formata em reais", () => {
    expect(normalize(formatCents(1050))).toBe("R$ 10,50");
    expect(normalize(formatCents(0))).toBe("R$ 0,00");
    expect(normalize(formatCents(123456))).toBe("R$ 1.234,56");
  });
});

describe("parseCents", () => {
  it.each([
    ["10", 1000],
    ["10,5", 1050],
    ["10,50", 1050],
    ["0,99", 99],
    ["R$ 1.234,56", 123456],
    ["1234,56", 123456],
    ["10.50", 1050],
    ["  7 ", 700],
  ])("lê %j como %i centavos", (input, cents) => {
    expect(parseCents(input)).toBe(cents);
  });

  it.each(["", "abc", "10,555", "-5", "1,2,3", "12.3456", "1.23,4"])("recusa %j", (input) => {
    expect(parseCents(input)).toBeNull();
  });
});

describe("percentOf", () => {
  it("calcula a taxa de serviço em centavos", () => {
    expect(percentOf(10000, 10)).toBe(1000);
    expect(percentOf(1234, 10)).toBe(123);
  });

  it("arredonda meio centavo para cima", () => {
    expect(percentOf(1235, 10)).toBe(124);
  });
});

describe("sumCents", () => {
  it("soma valores e devolve zero para lista vazia", () => {
    expect(sumCents([100, 250, 1])).toBe(351);
    expect(sumCents([])).toBe(0);
  });
});
