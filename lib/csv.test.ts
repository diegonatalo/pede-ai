import { describe, expect, it } from "vitest";
import { csvMoney, itemsCsv, tabsCsv, toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("usa ponto e vírgula, BOM e aspas só quando precisa", () => {
    const csv = toCsv(["Nome", "Obs"], [["Ana", 'disse "oi"; tchau'], ["Rui", 2]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.slice(1).split("\r\n")).toEqual(["Nome;Obs", 'Ana;"disse ""oi""; tchau"', "Rui;2", ""]);
  });

  it("escreve dinheiro com vírgula e sem R$", () => {
    expect(csvMoney(1250)).toBe("12,50");
    expect(csvMoney(0)).toBe("0,00");
    expect(csvMoney(123456)).toBe("1234,56");
  });
});

describe("planilhas do relatório", () => {
  it("monta itens e comandas com data e hora no fuso pedido", () => {
    const items = itemsCsv(
      [
        {
          orderedAt: "2026-11-20T23:30:00.000Z",
          table: "Mesa 2",
          tab: "Ana",
          item: "Chope",
          station: "Bar",
          quantity: 2,
          unitPriceCents: 1300,
          totalCents: 2600,
          status: "Entregue",
        },
      ],
      "America/Sao_Paulo",
    );
    expect(items.slice(1).split("\r\n")[1]).toBe("20/11/2026;20:30;Mesa 2;Ana;Chope;Bar;2;13,00;26,00;Entregue");

    const tabs = tabsCsv(
      [
        {
          openedAt: "2026-11-20T22:00:00.000Z",
          table: "Mesa 2",
          tab: "Ana",
          people: 2,
          status: "Paga",
          itemsCents: 2600,
          serviceFeeCents: 260,
          couvertCents: 0,
          totalCents: 2860,
        },
      ],
      "America/Sao_Paulo",
    );
    expect(tabs.slice(1).split("\r\n")).toEqual([
      "Data;Hora;Mesa;Comanda;Pessoas;Situação;Itens (R$);Taxa de serviço (R$);Couvert (R$);Total (R$)",
      "20/11/2026;19:00;Mesa 2;Ana;2;Paga;26,00;2,60;0,00;28,60",
      "",
    ]);
  });
});
