/**
 * Interface que representa um Prestador de serviço.
 * Pode ser médico, barbeiro, consultor, etc — depende do nicho.
 *
 * Coleção Firestore: prestadores
 */
export interface Prestador {
  /** Identificador único do prestador */
  id: string;

  /** Referência ao nicho a que pertence */
  nichoId: string;

  /** Nome completo do prestador (ex: "Dr. João Silva") */
  nome: string;

  /** Categoria/especialidade (ex: "Cardiologista", "Corte Masculino") */
  categoria: string;

  /** Se o prestador está ativo e aceitando agendamentos */
  ativo: boolean;

  /** Configuração de horário de atendimento */
  horarioAtendimento: {
    /** Horário de início no formato "HH:mm" (ex: "08:00") */
    inicio: string;

    /** Horário de fim no formato "HH:mm" (ex: "18:00") */
    fim: string;

    /**
     * Dias da semana em que atende.
     * 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
     * Ex: [1,2,3,4,5] = Segunda a Sexta
     */
    diasSemana: number[];
  };

  /** Número de WhatsApp do prestador (opcional, formato: "5511999999999") */
  whatsappNumero?: string;
}
