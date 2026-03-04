/**
 * Gera um protocolo único para identificação do agendamento.
 * Formato: AGD-{ANO}-{HASH_4_CHARS}
 */
export function gerarProtocolo(): string {
  const ano = new Date().getFullYear();
  const hash = Math.random().toString(16).substring(2, 6).toUpperCase();
  return `AGD-${ano}-${hash}`;
}
