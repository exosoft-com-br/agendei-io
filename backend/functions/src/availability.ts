import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { Prestador } from "./models/Prestador";
import { Servico } from "./models/Servico";
import { Agendamento } from "./models/Agendamento";
import { gerarSlotsDoDia, Slot } from "./utils/validarHorario";

// Referência ao Firestore
const db = admin.firestore();

/**
 * Cloud Function: getAvailableSlots
 *
 * Consulta horários disponíveis para um prestador/serviço em uma data.
 *
 * Endpoint: GET /getAvailableSlots
 * Query params:
 *   - prestadorId (obrigatório): ID do prestador
 *   - servicoId (obrigatório): ID do serviço
 *   - data (opcional): Data no formato YYYY-MM-DD (padrão: hoje)
 *
 * Retorno:
 *   { slots: Slot[] }
 */
export const getAvailableSlots = onRequest(
  { cors: true, region: "southamerica-east1" },
  async (req, res) => {
    try {
      // Apenas GET é permitido
      if (req.method !== "GET") {
        res.status(405).json({ erro: "Método não permitido. Use GET." });
        return;
      }

      // Extrair parâmetros da query string
      const { prestadorId, servicoId, data } = req.query;

      // Validar parâmetros obrigatórios
      if (!prestadorId || !servicoId) {
        res.status(400).json({
          erro: "Parâmetros obrigatórios: prestadorId e servicoId",
        });
        return;
      }

      // Usar data informada ou data de hoje
      const dataConsulta = (data as string) || new Date().toISOString().split("T")[0];

      // Validar formato da data
      const regexData = /^\d{4}-\d{2}-\d{2}$/;
      if (!regexData.test(dataConsulta)) {
        res.status(400).json({
          erro: "Formato de data inválido. Use YYYY-MM-DD.",
        });
        return;
      }

      // 1. Buscar dados do prestador
      const prestadorDoc = await db
        .collection("prestadores")
        .doc(prestadorId as string)
        .get();

      if (!prestadorDoc.exists) {
        res.status(404).json({ erro: "Prestador não encontrado." });
        return;
      }

      const prestador = { id: prestadorDoc.id, ...prestadorDoc.data() } as Prestador;

      // Verificar se o prestador está ativo
      if (!prestador.ativo) {
        res.status(400).json({ erro: "Prestador não está ativo no momento." });
        return;
      }

      // 2. Buscar dados do serviço
      const servicoDoc = await db
        .collection("servicos")
        .doc(servicoId as string)
        .get();

      if (!servicoDoc.exists) {
        res.status(404).json({ erro: "Serviço não encontrado." });
        return;
      }

      const servico = { id: servicoDoc.id, ...servicoDoc.data() } as Servico;

      // Verificar se o serviço está ativo
      if (!servico.ativo) {
        res.status(400).json({ erro: "Serviço não está disponível no momento." });
        return;
      }

      // 3. Gerar todos os slots possíveis para o dia
      const todosSlots = gerarSlotsDoDia(dataConsulta, prestador, servico.duracaoMinutos);

      if (todosSlots.length === 0) {
        res.status(200).json({
          slots: [],
          mensagem: "Não há horários disponíveis para esta data.",
        });
        return;
      }

      // 4. Buscar agendamentos confirmados do dia para este prestador
      const inicioDoDia = new Date(`${dataConsulta}T00:00:00`);
      const fimDoDia = new Date(`${dataConsulta}T23:59:59`);

      const agendamentosSnapshot = await db
        .collection("agendamentos")
        .where("prestadorId", "==", prestadorId)
        .where("status", "==", "confirmado")
        .where("dataHora", ">=", Timestamp.fromDate(inicioDoDia))
        .where("dataHora", "<=", Timestamp.fromDate(fimDoDia))
        .get();

      // Extrair horários ocupados
      const horariosOcupados: string[] = [];
      agendamentosSnapshot.forEach((doc) => {
        const agendamento = doc.data() as Agendamento;
        const dataHoraAgendamento = agendamento.dataHora.toDate().toISOString();
        horariosOcupados.push(dataHoraAgendamento);
      });

      // 5. Marcar slots ocupados
      const slotsComDisponibilidade: Slot[] = todosSlots.map((slot) => {
        // Verificar se há algum agendamento que conflita com este slot
        const slotInicio = new Date(slot.inicio).getTime();
        const slotFim = new Date(slot.fim).getTime();

        const ocupado = horariosOcupados.some((horario) => {
          const horarioMs = new Date(horario).getTime();
          return horarioMs >= slotInicio && horarioMs < slotFim;
        });

        return {
          ...slot,
          disponivel: !ocupado,
        };
      });

      // 6. Retornar lista completa com status de disponibilidade
      res.status(200).json({ slots: slotsComDisponibilidade });
    } catch (erro) {
      console.error("Erro ao buscar horários disponíveis:", erro);
      res.status(500).json({
        erro: "Erro interno ao buscar horários disponíveis.",
      });
    }
  }
);
