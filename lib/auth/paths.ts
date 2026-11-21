/** Área logada do dono (a conta e os restaurantes dela). */
export const ACCOUNT_PATH = "/conta";

/** Entrar ou criar a conta. */
export const SIGN_IN_PATH = "/entrar";

/** Parâmetro com a página para onde voltar depois de entrar. */
export const RETURN_PARAM = "de";

/** Link de entrar que traz a pessoa de volta para `from` depois. */
export const signInPath = (from?: string) =>
  from && from !== ACCOUNT_PATH ? `${SIGN_IN_PATH}?${RETURN_PARAM}=${encodeURIComponent(from)}` : SIGN_IN_PATH;

/**
 * Para onde voltar depois de entrar. Só aceita caminhos da área logada, para que
 * um link `?de=https://...` (ou `//outro.site`) não leve a pessoa a outro site.
 */
export const safeReturnPath = (target: string | null | undefined): string => {
  if (!target || target.startsWith("//") || target.includes("\\")) return ACCOUNT_PATH;
  if (target !== ACCOUNT_PATH && !target.startsWith(`${ACCOUNT_PATH}/`) && !target.startsWith(`${ACCOUNT_PATH}?`)) {
    return ACCOUNT_PATH;
  }
  return target;
};
