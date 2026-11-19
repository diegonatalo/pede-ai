import { describe, expect, it } from "vitest";
import { describeSplit, draftFromItem, draftToShares, setParts, splittableTabs } from "@/lib/split";

const tabs = [
  { id: "ana", customerName: "Ana e Rui", status: "open" as const },
  { id: "lia", customerName: "Lia", status: "bill_requested" as const },
  { id: "bia", customerName: "Bia e Leo", status: "open" as const },
  { id: "ze", customerName: "Zé", status: "paid" as const },
];

describe("splittableTabs", () => {
  it("deixa de fora comandas pagas ou canceladas", () => {
    expect(splittableTabs(tabs).map((tab) => tab.id)).toEqual(["ana", "lia", "bia"]);
  });
});

describe("rascunho da divisão", () => {
  it("parte da divisão atual", () => {
    const draft = draftFromItem({ shares: [{ tabId: "ana", parts: 2 }, { tabId: "bia", parts: 1 }] }, tabs);
    expect(draft).toEqual({ ana: 2, lia: 0, bia: 1, ze: 0 });
  });

  it("limita as partes entre 0 e 10", () => {
    let draft = draftFromItem({ shares: [{ tabId: "ana", parts: 1 }] }, tabs);
    draft = setParts(draft, "lia", 1);
    draft = setParts(draft, "bia", 15);
    draft = setParts(draft, "ana", -2);
    expect(draft).toMatchObject({ ana: 0, lia: 1, bia: 10 });
  });

  it("vira divisões na ordem das comandas, sem quem ficou com 0", () => {
    expect(draftToShares({ bia: 1, ana: 2, lia: 0 }, tabs)).toEqual([
      { tabId: "ana", parts: 2 },
      { tabId: "bia", parts: 1 },
    ]);
  });
});

describe("describeSplit", () => {
  it("descreve do ponto de vista de quem vê", () => {
    expect(describeSplit({ shares: [{ tabId: "ana", parts: 1 }] }, tabs, "ana")).toBe("Só desta comanda");
    expect(describeSplit({ shares: [{ tabId: "ana", parts: 1 }, { tabId: "lia", parts: 1 }] }, tabs, "lia")).toBe(
      "Dividido com Ana e Rui",
    );
    expect(
      describeSplit(
        { shares: [{ tabId: "ana", parts: 1 }, { tabId: "lia", parts: 1 }, { tabId: "bia", parts: 1 }] },
        tabs,
        "ana",
      ),
    ).toBe("Dividido com Lia e Bia e Leo");
  });

  it("mostra a parte quando a divisão não é igual", () => {
    expect(
      describeSplit({ shares: [{ tabId: "ana", parts: 2 }, { tabId: "lia", parts: 1 }] }, tabs, "lia"),
    ).toBe("Dividido com Ana e Rui (sua parte: 1 de 3)");
  });
});
