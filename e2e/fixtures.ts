import type { Page } from "@playwright/test";

export const title = (page: Page, name: string) =>
  page.getByRole("heading", { level: 1, name, exact: true });

/** Junta os erros do console e da página para conferir no fim do teste. */
export const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
};
