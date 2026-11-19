import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateRestaurantForm } from "@/components/account/create-restaurant-form";

afterEach(() => {
  vi.restoreAllMocks();
});

const mockFetch = (response: Response) => vi.spyOn(globalThis, "fetch").mockResolvedValue(response);

describe("CreateRestaurantForm", () => {
  it("sugere o endereço pelo nome e cria o restaurante", async () => {
    const restaurant = { id: "r1", slug: "cantina-do-ze", name: "Cantina do Zé", ownerUserId: "u1" };
    const spy = mockFetch(Response.json({ restaurant, pin: "818181" }));
    const onCreated = vi.fn();
    render(<CreateRestaurantForm onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText("Nome do restaurante"), "Cantina do Zé!");
    expect(screen.getByLabelText("Endereço")).toHaveValue("cantina-do-ze");
    expect(screen.getByLabelText("Endereço")).toHaveAccessibleDescription(/\/r\/cantina-do-ze/);
    await userEvent.click(screen.getByRole("button", { name: "Criar restaurante" }));

    const [url, init] = spy.mock.calls[0];
    expect(url).toBe("/api/account/restaurants");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Cantina do Zé!", slug: "cantina-do-ze" });
    expect(onCreated).toHaveBeenCalledWith(restaurant, "818181");
  });

  it("deixa trocar o endereço e mostra o erro do servidor", async () => {
    const spy = mockFetch(
      Response.json({ error: "slug_taken", message: "Esse endereço já está em uso. Escolha outro." }, { status: 409 }),
    );
    const onCreated = vi.fn();
    render(<CreateRestaurantForm onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText("Nome do restaurante"), "Bar");
    await userEvent.clear(screen.getByLabelText("Endereço"));
    await userEvent.type(screen.getByLabelText("Endereço"), "Bar-Central");
    // Depois de editado, o endereço não segue mais o nome.
    await userEvent.type(screen.getByLabelText("Nome do restaurante"), " do Centro");
    expect(screen.getByLabelText("Endereço")).toHaveValue("bar-central");
    await userEvent.click(screen.getByRole("button", { name: "Criar restaurante" }));

    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toEqual({ name: "Bar do Centro", slug: "bar-central" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse endereço já está em uso.");
    expect(onCreated).not.toHaveBeenCalled();
  });
});
