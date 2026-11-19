/**
 * Código de 4 dígitos que o garçom informa à mesa. Sorteado com `crypto.getRandomValues`;
 * o viés do módulo 10000 sobre 2³² é desprezível.
 */
export const generateJoinCode = (
  random: (array: Uint32Array) => Uint32Array = (array) => crypto.getRandomValues(array),
): string => {
  const [value] = random(new Uint32Array(1));
  return String(value % 10_000).padStart(4, "0");
};
