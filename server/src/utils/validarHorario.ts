/**
 * Interface do Prestador usada pelos utilitários de horário.
 */
export interface PrestadorHorario {
  id: string;
  horarioAtendimento: {
    inicio: string;
    fim: string;
    diasSemana: number[];
  };
}

/**
 * Representa um slot de horário.
 */
export interface Slot {
  inicio: string;
  fim: string;
  disponivel: boolean;
}

/**
 * Valida se uma data/hora está dentro do horário de atendimento.
 */
export function validarHorario(dataHora: string, prestador: PrestadorHorario): boolean {
  const data = new Date(dataHora);
  const diaSemana = data.getDay();

  if (!prestador.horarioAtendimento.diasSemana.includes(diaSemana)) {
    return false;
  }

  const minutosDoSlot = data.getHours() * 60 + data.getMinutes();

  const [horaInicio, minInicio] = prestador.horarioAtendimento.inicio.split(":").map(Number);
  const minutosInicio = horaInicio * 60 + minInicio;

  const [horaFim, minFim] = prestador.horarioAtendimento.fim.split(":").map(Number);
  const minutosFim = horaFim * 60 + minFim;

  return minutosDoSlot >= minutosInicio && minutosDoSlot < minutosFim;
}

/**
 * Gera todos os slots possíveis para um dia.
 */
export function gerarSlotsDoDia(
  data: string,
  prestador: PrestadorHorario,
  duracaoMinutos: number
): Slot[] {
  const slots: Slot[] = [];
  const dataObj = new Date(`${data}T00:00:00`);
  const diaSemana = dataObj.getDay();

  if (!prestador.horarioAtendimento.diasSemana.includes(diaSemana)) {
    return slots;
  }

  const [horaInicio, minInicio] = prestador.horarioAtendimento.inicio.split(":").map(Number);
  const [horaFim, minFim] = prestador.horarioAtendimento.fim.split(":").map(Number);

  let minutosAtual = horaInicio * 60 + minInicio;
  const minutosFim = horaFim * 60 + minFim;

  while (minutosAtual + duracaoMinutos <= minutosFim) {
    const hI = Math.floor(minutosAtual / 60);
    const mI = minutosAtual % 60;
    const hF = Math.floor((minutosAtual + duracaoMinutos) / 60);
    const mF = (minutosAtual + duracaoMinutos) % 60;

    slots.push({
      inicio: `${data}T${String(hI).padStart(2, "0")}:${String(mI).padStart(2, "0")}:00`,
      fim: `${data}T${String(hF).padStart(2, "0")}:${String(mF).padStart(2, "0")}:00`,
      disponivel: true,
    });

    minutosAtual += duracaoMinutos;
  }

  return slots;
}
