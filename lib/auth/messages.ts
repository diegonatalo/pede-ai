/** Mensagens em português para os códigos de erro do Better Auth que a tela pode receber. */
const MESSAGES: Record<string, string> = {
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Entre com a sua senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Já existe uma conta com este e-mail. Use outro ou entre com a sua senha.",
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha errados.",
  INVALID_EMAIL: "Este e-mail não parece válido.",
  INVALID_PASSWORD: "Senha errada.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha está longa demais.",
  USER_NOT_FOUND: "Não achamos uma conta com este e-mail.",
  FAILED_TO_CREATE_USER: "Não deu para criar a conta agora. Tente de novo.",
};

const TOO_MANY = "Muitas tentativas. Espere um pouco e tente de novo.";
const FALLBACK = "Algo deu errado. Tente de novo.";

/** Traduz o erro do cliente do Better Auth (`{ code, status, message }`) para mostrar na tela. */
export const authErrorMessage = (error: { code?: string; status?: number } | null | undefined) => {
  if (!error) return FALLBACK;
  if (error.status === 429) return TOO_MANY;
  return (error.code && MESSAGES[error.code]) || FALLBACK;
};
