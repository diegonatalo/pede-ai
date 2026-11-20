import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MapEditor } from "@/components/manager/map-editor";
import { TablesEditor } from "@/components/manager/tables-editor";
import type { MapSpot, Table } from "@/types/domain";

const TABLES: Table[] = [
  { id: "t1", restaurantId: "r", label: "Mesa 1", archived: false },
  { id: "t2", restaurantId: "r", label: "Mesa 2", archived: false },
  { id: "t3", restaurantId: "r", label: "Varanda", archived: false },
];

const SPOTS: MapSpot[] = [
  { id: "s1", restaurantId: "r", kind: "table", label: "1", tableId: "t1", x: 10, y: 10, w: 10, h: 10 },
  { id: "s2", restaurantId: "r", kind: "restroom", label: "Banheiros", x: 80, y: 0, w: 20, h: 10 },
];

const bodyOf = (run: ReturnType<typeof vi.fn>, call = 0) => {
  const args = run.mock.calls[call] as unknown[];
  expect(args[1]).toBe("/api/staff/floor");
  return args[2];
};

describe("TablesEditor", () => {
  const setup = (open: string[] = []) => {
    const run = vi.fn(async () => true);
    render(<TablesEditor tables={TABLES} openTableIds={new Set(open)} busy={null} run={run} />);
    return run;
  };

  it("cria, renomeia e muda a ordem", async () => {
    const run = setup();
    const form = screen.getByRole("form", { name: "Nova mesa" });
    await userEvent.type(within(form).getByLabelText("Nova mesa"), "Mesa 9");
    await userEvent.click(within(form).getByRole("button", { name: "Criar mesa" }));
    expect(bodyOf(run)).toEqual({ type: "save_table", label: "Mesa 9" });
    expect(within(form).getByLabelText("Nova mesa")).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: "Renomear Varanda" }));
    const rename = screen.getByRole("form", { name: "Renomear Varanda" });
    await userEvent.clear(within(rename).getByLabelText("Nome da mesa"));
    await userEvent.type(within(rename).getByLabelText("Nome da mesa"), "Varanda 1");
    await userEvent.click(within(rename).getByRole("button", { name: "Salvar" }));
    expect(bodyOf(run, 1)).toEqual({ type: "save_table", id: "t3", label: "Varanda 1" });

    expect(screen.getByRole("button", { name: "Subir Mesa 1" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Descer Mesa 1" }));
    expect(bodyOf(run, 2)).toEqual({ type: "move_table", id: "t1", direction: "down" });
  });

  it("tira do salão em dois passos, mas não a mesa aberta", async () => {
    const run = setup(["t2"]);
    expect(screen.getByRole("button", { name: "Tirar Mesa 2 do salão" })).toBeDisabled();
    expect(screen.getByText("aberta")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tirar Mesa 1 do salão" }));
    expect(run).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar: tirar Mesa 1 do salão" }));
    expect(bodyOf(run)).toEqual({ type: "archive_table", id: "t1" });
  });
});

describe("MapEditor", () => {
  const setup = () => {
    const run = vi.fn(async () => true);
    render(<MapEditor tables={TABLES} spots={SPOTS} busy={false} run={run} />);
    return run;
  };

  it("move e redimensiona o ponto escolhido, sem passar da grade, e salva tudo de uma vez", async () => {
    const run = setup();
    expect(screen.getByRole("button", { name: "Salvar mapa" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Banheiros" }));
    // Já está encostado à direita e no fundo: não sai da grade.
    await userEvent.click(screen.getByRole("button", { name: "Mover para a direita" }));
    await userEvent.click(screen.getByRole("button", { name: "Mover para o fundo" }));
    await userEvent.click(screen.getByRole("button", { name: "Mover para a esquerda" }));
    await userEvent.click(screen.getByRole("button", { name: "Mais alto" }));
    expect(screen.getByText("Há mudanças não salvas.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salvar mapa" }));
    expect(bodyOf(run)).toEqual({
      type: "save_map",
      spots: [
        { id: "s1", kind: "table", label: "1", tableId: "t1", x: 10, y: 10, w: 10, h: 10 },
        { id: "s2", kind: "restroom", label: "Banheiros", x: 78, y: 0, w: 20, h: 12 },
      ],
    });
  });

  it("adiciona mesa ainda fora do mapa e lugares, e tira pontos", async () => {
    const run = setup();
    const select = screen.getByLabelText("Adicionar ao mapa");
    // A Mesa 1 já está no mapa: só as outras aparecem.
    expect(within(select).queryByRole("option", { name: "Mesa 1" })).not.toBeInTheDocument();
    await userEvent.selectOptions(select, "table:t3");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByRole("button", { name: "Varanda", pressed: true })).toBeInTheDocument();
    await userEvent.selectOptions(select, "cashier");
    await userEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    await userEvent.click(screen.getByRole("button", { name: "Mesa 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Tirar do mapa" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar mapa" }));
    const body = bodyOf(run) as { spots: { kind: string; tableId?: string; id?: string }[] };
    expect(body.spots.map((spot) => [spot.kind, spot.tableId ?? null, spot.id ?? null])).toEqual([
      ["restroom", null, "s2"],
      ["table", "t3", null],
      ["cashier", null, null],
    ]);
  });

  it("desfaz as mudanças não salvas", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Mesa 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Tirar do mapa" }));
    await userEvent.click(screen.getByRole("button", { name: "Desfazer mudanças" }));
    expect(screen.getByRole("button", { name: "Mesa 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar mapa" })).toBeDisabled();
  });
});
