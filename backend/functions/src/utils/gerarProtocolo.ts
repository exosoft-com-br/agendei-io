/**
 * Gera um protocolo único para identificação do agendamento.
 *
 * Formato: AGD-{ANO}-{HASH_4_CHARS}
 * Exemplo: AGD-2026-A3F7
 *
 * @returns Protocolo único como string
 */
export function gerarProtocolo(): string {
  const ano = new Date().getFullYear();

  // Gera 4 caracteres hexadecimais aleatórios em maiúsculo
  const hash = Math.random()
    .toString(16)
    .substring(2, 6)
    .toUpperCase();

  return `AGD-${ano}-${hash}`;
}
