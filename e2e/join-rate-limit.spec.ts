import { expect, json, openTable, staffLogin, test } from "./fixtures";

/** Endereço de internet inventado e único: o limite é por endereço, e os testes rodam em paralelo. */
const fakeIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${Date.now() % 1e6}`;

test("quem erra o código em várias mesas é barrado; quem está em outro endereço, não", async ({
  playwright,
  baseURL,
  restaurant,
}) => {
  const staff = await playwright.request.newContext({ baseURL });
  await staffLogin(staff, restaurant, "waiter");
  const codes: string[] = [];
  for (const label of ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6"]) {
    codes.push((await openTable(staff, restaurant, label)).joinCode);
  }

  const attacker = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  const join = (device: typeof attacker, label: string, code: string) =>
    device.post(restaurant.api(`/api/tables/${restaurant.table(label)}/join`), json({ code }));
  const wrong = (code: string) => (code === "0000" ? "1111" : "0000");

  // 3 erros em cada uma de 5 mesas: fica abaixo do limite de cada mesa (5), mas soma 15 no endereço.
  for (const [index, label] of ["Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5"].entries()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      expect((await join(attacker, label, wrong(codes[index]))).status()).toBe(401);
    }
  }
  // Agora nem o código certo entra, em qualquer mesa.
  const blocked = await join(attacker, "Mesa 6", codes[5]);
  expect(blocked.status()).toBe(429);
  expect(await blocked.json()).toMatchObject({ error: "locked" });

  // Outro aparelho, em outro endereço, entra normalmente.
  const customer = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": fakeIp() } });
  expect((await join(customer, "Mesa 6", codes[5])).ok()).toBe(true);
});
