import { Timestamp } from "firebase-admin/firestore";

/**
 * Status possíveis de um agendamento.
 */
export type StatusAgendamento = "pendente" | "confirmado" | "cancelado";

/**
 * Interface que representa um Agendamento.
 *
 * Coleção Firestore: agendamentos
 */
export interface Agendamento {
  /** Identificador único do agendamento */
  id: string;

  /** Referência ao nicho */
  nichoId: string;

  /** Referência ao prestador */
  prestadorId: string;

  /** Referência ao serviço */
  servicoId: string;

  /** Nome do cliente que fez o agendamento */
  clienteNome: string;

  /** Telefone do cliente no formato "5511999999999" */
  clienteTelefone: string;

  /** Data e hora do agendamento */
  dataHora: Timestamp;

  /** Status atual do agendamento */
  status: StatusAgendamento;

  /** Protocolo único para rastreamento (ex: "AGD-2026-A3F7") */
  protocolo: string;

  /** Data de criação do registro */
  criadoEm: Timestamp;

  /** Data da última atualização */
  atualizadoEm: Timestamp;
}
