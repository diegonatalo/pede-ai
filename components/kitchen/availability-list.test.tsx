import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AvailabilityList } from "@/components/kitchen/availability-list";
import { MENU_CATEGORIES, MENU_ITEMS } from "@/lib/seed-data";

const menu = {
  categories: MENU_CATEGORIES,
  items: MENU_ITEMS.map((item) => (item.id === "burrata" ? { ...item, available: false } : item)),
};

describe("AvailabilityList", () => {
  it("esgota e devolve itens ao cardápio", async () => {
    const run = vi.fn();
    render(<AvailabilityList menu={menu} station="all" busy={null} run={run} />);
    await userEvent.click(screen.getByRole("button", { name: "Esgotar Chope" }));
    expect(run).toHaveBeenLastCalledWith("chope", "/api/staff/menu/chope/availability", { available: false });
    await userEvent.click(screen.getByRole("button", { name: "Voltar Burrata ao cardápio" }));
    expect(run).toHaveBeenLastCalledWith("burrata", "/api/staff/menu/burrata/availability", { available: true });
  });

  it("mostra só os itens da estação escolhida", () => {
    render(<AvailabilityList menu={menu} station="bar" busy={null} run={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Esgotar Chope" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esgotar Lasanha à bolonhesa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Entradas" })).not.toBeInTheDocument();
  });
});
