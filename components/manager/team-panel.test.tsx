import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TeamPanel } from "@/components/manager/team-panel";
import type { StaffMember } from "@/types/domain";

const member = (id: string, name: string, role: StaffMember["role"], extra: Partial<StaffMember> = {}): StaffMember => ({
  id,
  restaurantId: "demo",
  name,
  role,
  active: true,
  system: false,
  createdAt: "2026-11-19T00:00:00.000Z",
  ...extra,
});

let team: StaffMember[] = [];

/** Simula a API da equipe; guarda as chamadas para conferir o corpo. */
const mockApi = () =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (method === "GET" && url.startsWith("/api/staff/team")) return Response.json(team);
    if (method === "POST" && url === "/api/staff/team?role=manager") {
      const body = JSON.parse(String(init?.body));
      const created = member("novo", body.name, body.role);
      team = [...team, created];
      return Response.json({ member: created, pin: "482913" });
    }
    if (url.includes("/pin")) return Response.json({ member: team[0], pin: "650127" });
    if (url.includes("/active")) return Response.json({});
    throw new Error(`rota não simulada: ${method} ${url}`);
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TeamPanel", () => {
  it("cadastra a pessoa e mostra o PIN uma vez só", async () => {
    team = [member("demo-g", "Garçom da demo", "waiter", { system: true })];
    const spy = mockApi();
    render(<TeamPanel meId="eu" />);
    await screen.findByText("Garçom da demo");
    expect(screen.getByText("PIN público da demo; não pode ser alterado.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Nome"), "Bruno");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "kitchen");
    await userEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    const pinBox = await screen.findByRole("status", { name: "PIN de Bruno" });
    expect(within(pinBox).getByText("482913")).toBeInTheDocument();
    const post = spy.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[1]?.body).toBe(JSON.stringify({ name: "Bruno", role: "kitchen" }));

    await userEvent.click(screen.getByRole("button", { name: "Já anotei" }));
    expect(screen.queryByText("482913")).not.toBeInTheDocument();
    expect(await screen.findByText("Bruno")).toBeInTheDocument();
  });

  it("gera outro PIN e desativa, mas não oferece desativar a si mesmo", async () => {
    team = [member("ana", "Ana", "waiter"), member("eu", "Dona", "manager")];
    const spy = mockApi();
    render(<TeamPanel meId="eu" />);
    await screen.findByText("Ana");

    await userEvent.click(screen.getByRole("button", { name: "Gerar outro PIN para Ana" }));
    expect(within(await screen.findByRole("status", { name: "PIN de Ana" })).getByText("650127")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Desativar Ana" }));
    const active = spy.mock.calls.find(([url]) => String(url).includes("/active"));
    expect(active?.[1]?.body).toBe(JSON.stringify({ active: false }));
    expect(screen.queryByRole("button", { name: "Desativar Dona" })).not.toBeInTheDocument();
  });
});
