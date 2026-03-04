import { Timestamp } from "firebase-admin/firestore";

/**
 * Interface que representa um Nicho (segmento de negócio).
 * Mudar de nicho = mudar dados no Firestore, não código.
 *
 * Coleção Firestore: nichos
 */
export interface Nicho {
  /** Identificador único do nicho (ex: "clinica", "barbearia") */
  id: string;

  /** Nome público exibido para o cliente (ex: "Clínica Saúde Total") */
  nomePublico: string;

  /** Como chamar o cliente neste nicho (ex: "paciente", "cliente", "tutor") */
  tipoCliente: string;

  /** Mensagem de boas-vindas enviada no início da conversa */
  saudacaoInicial: string;

  /** Template da mensagem de confirmação. Suporta {protocolo} e {dataHora} */
  textoConfirmacao: string;

  /** Termos personalizados para o nicho */
  termos: {
    /** Como chamar o serviço (ex: "consulta", "serviço", "procedimento") */
    servico: string;

    /** Como chamar o prestador (ex: "médico", "barbeiro", "consultor") */
    prestador: string;
  };

  /** Se o nicho está ativo e aceitando agendamentos */
  ativo: boolean;

  /** Data de criação do registro */
  criadoEm?: Timestamp;

  /** Data da última atualização */
  atualizadoEm?: Timestamp;
}
