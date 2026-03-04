/**
 * Interface que representa um Serviço oferecido por um prestador.
 *
 * Coleção Firestore: servicos
 */
export interface Servico {
  /** Identificador único do serviço */
  id: string;

  /** Referência ao prestador que oferece este serviço */
  prestadorId: string;

  /** Referência ao nicho a que pertence */
  nichoId: string;

  /** Nome do serviço (ex: "Consulta Inicial", "Corte + Barba") */
  nome: string;

  /** Duração do serviço em minutos (ex: 30, 45, 60) */
  duracaoMinutos: number;

  /** Preço do serviço em reais (opcional) */
  preco?: number;

  /** Se o serviço está ativo e disponível para agendamento */
  ativo: boolean;
}
