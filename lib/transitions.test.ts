import { describe, expect, it } from "vitest";
import {
  canCloseSession,
  canOrder,
  checkCallTransition,
  checkItemTransition,
  checkTabTransition,
  initialItemStatus,
  isFinalItemStatus,
  nextItemStatuses,
} from "@/lib/transitions";
import type { ItemStatus, Role } from "@/types/domain";

const ok = { ok: true };
const invalid = { ok: false, error: "invalid_transition" };
const forbidden = { ok: false, error: "forbidden" };

describe("checkItemTransition", () => {
  it("segue o caminho feliz com o papel certo em cada passo", () => {
    const path: [ItemStatus, ItemStatus, Role][] = [
      ["awaiting_approval", "sent", "waiter"],
      ["sent", "preparing", "kitchen"],
      ["preparing", "ready", "kitchen"],
      ["ready", "picked_up", "waiter"],
      ["picked_up", "delivered", "waiter"],
    ];
    for (const [from, to, role] of path) expect(checkItemTransition(from, to, role)).toEqual(ok);
  });

  it("deixa o gerente fazer qualquer passo do caminho", () => {
    expect(checkItemTransition("sent", "preparing", "manager")).toEqual(ok);
    expect(checkItemTransition("ready", "picked_up", "manager")).toEqual(ok);
  });

  it("não deixa o cliente aprovar o próprio pedido nem mexer no preparo", () => {
    expect(checkItemTransition("awaiting_approval", "sent", "customer")).toEqual(forbidden);
    expect(checkItemTransition("sent", "preparing", "customer")).toEqual(forbidden);
    expect(checkItemTransition("preparing", "ready", "customer")).toEqual(forbidden);
  });

  it("não deixa a cozinha aprovar pedidos nem marcar entrega", () => {
    expect(checkItemTransition("awaiting_approval", "sent", "kitchen")).toEqual(forbidden);
    expect(checkItemTransition("picked_up", "delivered", "kitchen")).toEqual(forbidden);
  });

  it("não deixa o garçom fazer o trabalho da cozinha", () => {
    expect(checkItemTransition("sent", "preparing", "waiter")).toEqual(forbidden);
    expect(checkItemTransition("preparing", "ready", "waiter")).toEqual(forbidden);
  });

  it("recusa pular etapas", () => {
    expect(checkItemTransition("sent", "ready", "kitchen")).toEqual(invalid);
    expect(checkItemTransition("awaiting_approval", "preparing", "manager")).toEqual(invalid);
    expect(checkItemTransition("ready", "delivered", "waiter")).toEqual(invalid);
  });

  it("deixa o cliente cancelar só antes do preparo", () => {
    expect(checkItemTransition("awaiting_approval", "canceled", "customer")).toEqual(ok);
    expect(checkItemTransition("sent", "canceled", "customer")).toEqual(ok);
    expect(checkItemTransition("preparing", "canceled", "customer")).toEqual(forbidden);
    expect(checkItemTransition("preparing", "canceled", "waiter")).toEqual(ok);
  });

  it("permite desfazer um passo dado por engano", () => {
    expect(checkItemTransition("preparing", "sent", "kitchen")).toEqual(ok);
    expect(checkItemTransition("ready", "preparing", "kitchen")).toEqual(ok);
    expect(checkItemTransition("picked_up", "ready", "waiter")).toEqual(ok);
  });

  it("não sai de entregue nem de cancelado", () => {
    for (const to of ["sent", "ready", "canceled"] as ItemStatus[]) {
      expect(checkItemTransition("delivered", to, "manager")).toEqual(invalid);
      expect(checkItemTransition("canceled", to, "manager")).toEqual(invalid);
    }
  });

  it("recusa ficar no mesmo estado", () => {
    expect(checkItemTransition("sent", "sent", "manager")).toEqual(invalid);
  });
});

describe("nextItemStatuses e isFinalItemStatus", () => {
  it("lista os botões de cada papel", () => {
    expect(nextItemStatuses("sent", "kitchen")).toEqual(["preparing"]);
    expect(nextItemStatuses("sent", "customer")).toEqual(["canceled"]);
    expect(nextItemStatuses("ready", "waiter")).toEqual(["picked_up", "canceled"]);
    expect(nextItemStatuses("delivered", "manager")).toEqual([]);
  });

  it("marca entregue e cancelado como finais", () => {
    expect(isFinalItemStatus("delivered")).toBe(true);
    expect(isFinalItemStatus("canceled")).toBe(true);
    expect(isFinalItemStatus("ready")).toBe(false);
  });
});

describe("checkTabTransition", () => {
  it("deixa o cliente pedir a conta e voltar a pedir", () => {
    expect(checkTabTransition("open", "bill_requested", "customer")).toEqual(ok);
    expect(checkTabTransition("bill_requested", "open", "customer")).toEqual(ok);
  });

  it("deixa só a equipe marcar como paga", () => {
    expect(checkTabTransition("bill_requested", "paid", "customer")).toEqual(forbidden);
    expect(checkTabTransition("bill_requested", "paid", "waiter")).toEqual(ok);
    expect(checkTabTransition("open", "paid", "manager")).toEqual(ok);
  });

  it("deixa só o gerente cancelar a comanda", () => {
    expect(checkTabTransition("open", "canceled", "waiter")).toEqual(forbidden);
    expect(checkTabTransition("open", "canceled", "manager")).toEqual(ok);
  });

  it("não reabre comanda paga", () => {
    expect(checkTabTransition("paid", "open", "manager")).toEqual(invalid);
  });
});

describe("checkCallTransition", () => {
  it("deixa o garçom ver e resolver o chamado", () => {
    expect(checkCallTransition("open", "acknowledged", "waiter")).toEqual(ok);
    expect(checkCallTransition("acknowledged", "resolved", "waiter")).toEqual(ok);
  });

  it("deixa o cliente desistir só antes de o garçom ver", () => {
    expect(checkCallTransition("open", "resolved", "customer")).toEqual(ok);
    expect(checkCallTransition("acknowledged", "resolved", "customer")).toEqual(forbidden);
  });

  it("não deixa a cozinha mexer em chamados", () => {
    expect(checkCallTransition("open", "acknowledged", "kitchen")).toEqual(forbidden);
  });
});

describe("initialItemStatus", () => {
  it("espera a confirmação no primeiro pedido quando a regra está ligada", () => {
    expect(initialItemStatus({ requireFirstOrderApproval: true }, { approved: false })).toBe(
      "awaiting_approval",
    );
  });

  it("manda direto depois que a comanda foi confirmada", () => {
    expect(initialItemStatus({ requireFirstOrderApproval: true }, { approved: true })).toBe("sent");
  });

  it("manda direto quando a regra está desligada", () => {
    expect(initialItemStatus({ requireFirstOrderApproval: false }, { approved: false })).toBe("sent");
  });
});

describe("canOrder e canCloseSession", () => {
  it("aceita pedido só com a comanda aberta", () => {
    expect(canOrder({ status: "open" })).toBe(true);
    expect(canOrder({ status: "bill_requested" })).toBe(false);
    expect(canOrder({ status: "paid" })).toBe(false);
  });

  it("fecha a mesa só com todas as comandas pagas ou canceladas", () => {
    expect(canCloseSession([{ status: "paid" }, { status: "canceled" }])).toBe(true);
    expect(canCloseSession([{ status: "paid" }, { status: "bill_requested" }])).toBe(false);
    expect(canCloseSession([])).toBe(true);
  });
});
