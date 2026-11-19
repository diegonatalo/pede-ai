import { describe, expect, it } from "vitest";
import {
  allocateCents,
  allocateItem,
  computeSessionBills,
  computeTabBill,
  itemTotal,
  validateShares,
} from "@/lib/billing";
import type { ItemShare, ItemStatus, OrderItem } from "@/types/domain";

const makeItem = (
  id: string,
  unitPriceCents: number,
  shares: ItemShare[],
  overrides: { quantity?: number; status?: ItemStatus } = {},
): OrderItem => ({
  id,
  orderId: "order-1",
  menuItemId: id,
  nameSnapshot: id,
  unitPriceCents,
  quantity: overrides.quantity ?? 1,
  station: "kitchen",
  status: overrides.status ?? "delivered",
  shares,
  updatedAt: "2026-11-18T20:00:00.000Z",
});

const only = (tabId: string): ItemShare[] => [{ tabId, parts: 1 }];
const split = (...tabIds: string[]): ItemShare[] => tabIds.map((tabId) => ({ tabId, parts: 1 }));

const noFees = { serviceFeePercent: 0, couvertCents: 0 };
const withFees = { serviceFeePercent: 10, couvertCents: 1500 };

describe("allocateCents", () => {
  it("divide igualmente e dá o centavo que sobra para a primeira parte", () => {
    expect(allocateCents(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocateCents(1001, [1, 1, 1])).toEqual([334, 334, 333]);
    expect(allocateCents(900, [1, 1, 1])).toEqual([300, 300, 300]);
  });

  it("respeita os pesos", () => {
    expect(allocateCents(1000, [2, 1])).toEqual([667, 333]);
    expect(allocateCents(12900, [3, 1])).toEqual([9675, 3225]);
  });

  it("nunca perde nem cria centavos", () => {
    for (const total of [1, 7, 99, 1000, 12345]) {
      for (const weights of [[1], [1, 1], [1, 2, 3], [5, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1]]) {
        const shares = allocateCents(total, weights);
        expect(shares.reduce((sum, share) => sum + share, 0)).toBe(total);
      }
    }
  });

  it("não dá centavo para peso zero", () => {
    expect(allocateCents(1000, [0, 1, 1])).toEqual([0, 500, 500]);
    expect(allocateCents(1001, [0, 1, 1])).toEqual([0, 501, 500]);
  });

  it("recusa pesos que somam zero", () => {
    expect(() => allocateCents(1000, [])).toThrow();
    expect(() => allocateCents(1000, [0, 0])).toThrow();
  });
});

describe("validateShares", () => {
  const tabIds = ["ana", "bia"];

  it("aceita uma divisão válida", () => {
    expect(validateShares(split("ana", "bia"), tabIds)).toBeNull();
    expect(validateShares([{ tabId: "ana", parts: 2 }], tabIds)).toBeNull();
  });

  it("aponta o problema", () => {
    expect(validateShares([], tabIds)).toBe("empty");
    expect(validateShares([{ tabId: "ana", parts: 0 }], tabIds)).toBe("invalid_parts");
    expect(validateShares([{ tabId: "ana", parts: 1.5 }], tabIds)).toBe("invalid_parts");
    expect(validateShares(split("ana", "ana"), tabIds)).toBe("duplicate_tab");
    expect(validateShares(split("ana", "caio"), tabIds)).toBe("unknown_tab");
  });
});

describe("itemTotal e allocateItem", () => {
  it("multiplica preço por quantidade e divide entre as comandas", () => {
    const wine = makeItem("vinho", 12900, split("ana", "bia", "caio"), { quantity: 1 });
    expect(itemTotal(wine)).toBe(12900);
    expect(allocateItem(wine)).toEqual([
      { tabId: "ana", amountCents: 4300 },
      { tabId: "bia", amountCents: 4300 },
      { tabId: "caio", amountCents: 4300 },
    ]);
  });
});

describe("computeTabBill", () => {
  it("soma só os itens da comanda", () => {
    const items = [makeItem("risoto", 6400, only("ana")), makeItem("lasanha", 6200, only("bia"))];
    const bill = computeTabBill({ id: "ana", peopleCount: 1 }, items, noFees);
    expect(bill.lines.map((line) => line.itemId)).toEqual(["risoto"]);
    expect(bill.totalCents).toBe(6400);
  });

  it("inclui a parte de um item dividido", () => {
    const items = [makeItem("polenta", 2900, split("ana", "bia"), { quantity: 1 })];
    const ana = computeTabBill({ id: "ana", peopleCount: 1 }, items, noFees);
    const bia = computeTabBill({ id: "bia", peopleCount: 1 }, items, noFees);
    expect(ana.lines[0]).toMatchObject({ parts: 1, totalParts: 2, amountCents: 1450 });
    expect(bia.lines[0]).toMatchObject({ parts: 1, totalParts: 2, amountCents: 1450 });
  });

  it("deixa os cancelados de fora", () => {
    const items = [
      makeItem("chope", 1300, only("ana"), { quantity: 2 }),
      makeItem("tiramisu", 2600, only("ana"), { status: "canceled" }),
    ];
    const bill = computeTabBill({ id: "ana", peopleCount: 1 }, items, noFees);
    expect(bill.lines).toHaveLength(1);
    expect(bill.subtotalCents).toBe(2600);
  });

  it("aplica a taxa sobre os itens e o couvert por pessoa, sem taxa no couvert", () => {
    const items = [makeItem("carbonara", 5900, only("casal"))];
    const bill = computeTabBill({ id: "casal", peopleCount: 2 }, items, withFees);
    expect(bill).toMatchObject({
      subtotalCents: 5900,
      serviceFeeCents: 590,
      couvertCents: 3000,
      totalCents: 9490,
    });
  });

  it("conta os itens que ainda não chegaram", () => {
    const items = [
      makeItem("cafe", 700, only("ana"), { status: "preparing" }),
      makeItem("agua", 700, only("ana")),
    ];
    const bill = computeTabBill({ id: "ana", peopleCount: 1 }, items, noFees);
    expect(bill.pendingCount).toBe(1);
    expect(bill.lines.find((line) => line.itemId === "cafe")?.pending).toBe(true);
  });

  it("devolve conta zerada para comanda sem itens", () => {
    const bill = computeTabBill({ id: "ana", peopleCount: 1 }, [], withFees);
    expect(bill).toMatchObject({ lines: [], subtotalCents: 0, serviceFeeCents: 0, totalCents: 1500 });
  });
});

describe("computeSessionBills", () => {
  // Dois casais e uma amiga na mesma mesa, com uma porção e um vinho divididos.
  const tabs = [
    { id: "casal-1", peopleCount: 2, status: "open" as const },
    { id: "casal-2", peopleCount: 2, status: "bill_requested" as const },
    { id: "lia", peopleCount: 1, status: "open" as const },
    { id: "errada", peopleCount: 1, status: "canceled" as const },
  ];
  const items = [
    makeItem("parmegiana", 9800, only("casal-1")),
    makeItem("lasanha", 6200, only("casal-2"), { quantity: 2 }),
    makeItem("risoto", 6400, only("lia")),
    makeItem("burrata", 5800, split("casal-1", "casal-2", "lia")),
    makeItem("vinho-garrafa", 12900, [
      { tabId: "casal-1", parts: 2 },
      { tabId: "casal-2", parts: 2 },
      { tabId: "lia", parts: 1 },
    ]),
  ];

  it("fecha a soma da mesa com a soma dos itens, sem perder centavos", () => {
    const { bills } = computeSessionBills(tabs, items, noFees);
    const itemsTotal = items.reduce((sum, item) => sum + itemTotal(item), 0);
    expect(bills.reduce((sum, bill) => sum + bill.subtotalCents, 0)).toBe(itemsTotal);
  });

  it("ignora a comanda cancelada", () => {
    const { bills } = computeSessionBills(tabs, items, noFees);
    expect(bills.map((bill) => bill.tabId)).toEqual(["casal-1", "casal-2", "lia"]);
  });

  it("calcula cada comanda com taxa e couvert", () => {
    const { bills, totalCents } = computeSessionBills(tabs, items, withFees);
    const lia = bills.find((bill) => bill.tabId === "lia");
    // risoto 6400 + burrata 5800/3 (1933) + vinho 12900 × 1/5 (2580)
    expect(lia?.subtotalCents).toBe(6400 + 1933 + 2580);
    expect(lia?.serviceFeeCents).toBe(1091);
    expect(lia?.couvertCents).toBe(1500);
    expect(totalCents).toBe(bills.reduce((sum, bill) => sum + bill.totalCents, 0));
  });
});
