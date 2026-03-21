/**
 * Utilitário de sanitização de input contra XSS e injection.
 */

/**
 * Remove caracteres perigosos de strings de input.
 * Previne XSS e NoSQL injection.
 */
export function sanitizar(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .trim()
    .replace(/[<>]/g, "")           // Remove tags HTML
    .replace(/javascript:/gi, "")    // Remove javascript: URIs
    .replace(/on\w+=/gi, "")        // Remove event handlers (onclick=, etc)
    .substring(0, 500);             // Limita tamanho máximo
}

/**
 * Valida e sanitiza um ID (slug).
 * IDs devem conter apenas letras, números, hífens e underscores.
 */
export function sanitizarId(input: string): string | null {
  if (typeof input !== "string") return null;
  const limpo = input.trim().substring(0, 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(limpo)) return null;
  return limpo;
}

/**
 * Valida telefone pela quantidade de dígitos (10–13).
 * Aceita com ou sem DDI (55).
 */
export function validarTelefone(telefone: string): boolean {
  return /^\d{10,13}$/.test(telefone);
}

/**
 * Valida formato ISO 8601 de data/hora.
 */
export function validarDataHora(dataHora: string): Date | null {
  const obj = new Date(dataHora);
  if (isNaN(obj.getTime())) return null;
  return obj;
}
