import { Prestador } from "../models/Prestador";

/**
 * Representa um slot de horário disponível ou ocupado.
 */
export interface Slot {
  /** Início do slot no formato ISO 8601 */
  inicio: string;

  /** Fim do slot no formato ISO 8601 */
  fim: string;

  /** Se o slot está disponível para agendamento */
  disponivel: boolean;
}

/**
 * Valida se uma data/hora está dentro do horário de atendimento do prestador.
 *
 * @param dataHora - Data e hora a validar (ISO 8601)
 * @param prestador - Dados do prestador com horário de atendimento
 * @returns true se o horário é válido para o prestador
 */
export function validarHorario(dataHora: string, prestador: Prestador): boolean {
  const data = new Date(dataHora);

  // Verificar se o dia da semana está na lista de dias de atendimento
  const diaSemana = data.getDay();
  if (!prestador.horarioAtendimento.diasSemana.includes(diaSemana)) {
    return false;
  }

  // Extrair hora e minuto da data solicitada
  const horaSlot = data.getHours();
  const minutoSlot = data.getMinutes();
  const minutosDoSlot = horaSlot * 60 + minutoSlot;

  // Converter horário de início do prestador para minutos
  const [horaInicio, minInicio] = prestador.horarioAtendimento.inicio.split(":").map(Number);
  const minutosInicio = horaInicio * 60 + minInicio;

  // Converter horário de fim do prestador para minutos
  const [horaFim, minFim] = prestador.horarioAtendimento.fim.split(":").map(Number);
  const minutosFim = horaFim * 60 + minFim;

  // Verificar se o horário está dentro do intervalo de atendimento
  return minutosDoSlot >= minutosInicio && minutosDoSlot < minutosFim;
}

/**
 * Gera todos os slots possíveis para um dia, com base no horário do
 * prestador e na duração do serviço. Não verifica disponibilidade —
 * isso é feito pela function getAvailableSlots.
 *
 * @param data - Data no formato "YYYY-MM-DD"
 * @param prestador - Dados do prestador com horário de atendimento
 * @param duracaoMinutos - Duração do serviço em minutos
 * @returns Lista de slots gerados (todos marcados como disponíveis inicialmente)
 */
export function gerarSlotsDoDia(
  data: string,
  prestador: Prestador,
  duracaoMinutos: number
): Slot[] {
  const slots: Slot[] = [];

  // Verificar se o dia da semana é um dia de atendimento
  const dataObj = new Date(`${data}T00:00:00`);
  const diaSemana = dataObj.getDay();

  if (!prestador.horarioAtendimento.diasSemana.includes(diaSemana)) {
    return slots; // Retorna lista vazia se não atende neste dia
  }

  // Converter horários de início e fim para minutos
  const [horaInicio, minInicio] = prestador.horarioAtendimento.inicio.split(":").map(Number);
  const [horaFim, minFim] = prestador.horarioAtendimento.fim.split(":").map(Number);

  let minutosAtual = horaInicio * 60 + minInicio;
  const minutosFim = horaFim * 60 + minFim;

  // Gerar slots a cada intervalo de duração do serviço
  while (minutosAtual + duracaoMinutos <= minutosFim) {
    const horaInicioSlot = Math.floor(minutosAtual / 60);
    const minInicioSlot = minutosAtual % 60;
    const horaFimSlot = Math.floor((minutosAtual + duracaoMinutos) / 60);
    const minFimSlot = (minutosAtual + duracaoMinutos) % 60;

    // Formatar como ISO 8601
    const inicioStr = `${data}T${String(horaInicioSlot).padStart(2, "0")}:${String(minInicioSlot).padStart(2, "0")}:00`;
    const fimStr = `${data}T${String(horaFimSlot).padStart(2, "0")}:${String(minFimSlot).padStart(2, "0")}:00`;

    slots.push({
      inicio: inicioStr,
      fim: fimStr,
      disponivel: true, // Será atualizado pela function que consulta agendamentos
    });

    minutosAtual += duracaoMinutos;
  }

  return slots;
}
