import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { Agendamento } from "./models/Agendamento";
import { Nicho } from "./models/Nicho";
import { Servico } from "./models/Servico";
import { Prestador } from "./models/Prestador";
import { gerarProtocolo } from "./utils/gerarProtocolo";
import { notificarConfirmacao, notificarCancelamento } from "./utils/notificacao";

// Referência ao Firestore
const db = admin.firestore();

/**
 * Cloud Function: createBooking
 *
 * Cria um novo agendamento após validar disponibilidade.
 *
 * Endpoint: POST /createBooking
 * Body:
 *   - nichoId (string): ID do nicho
 *   - prestadorId (string): ID do prestador
 *   - servicoId (string): ID do serviço
 *   - clienteNome (string): Nome do cliente
 *   - clienteTelefone (string): Telefone no formato "5511999999999"
 *   - dataHora (string): Data/hora no formato ISO 8601
 *
 * Retorno:
 *   { sucesso: true, agendamento: Agendamento, protocolo: string, mensagemConfirmacao: string }
 */
export const createBooking = onRequest(
  { cors: true, region: "southamerica-east1" },
  async (req, res) => {
    try {
      // Apenas POST é permitido
      if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido. Use POST." });
        return;
      }

      // Extrair dados do body
      const { nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora } = req.body;

      // Validar campos obrigatórios
      if (!nichoId || !prestadorId || !servicoId || !clienteNome || !clienteTelefone || !dataHora) {
        res.status(400).json({
          erro: "Campos obrigatórios: nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora",
        });
        return;
      }

      // Validar formato do telefone (apenas números, 12-13 dígitos)
      const regexTelefone = /^\d{12,13}$/;
      if (!regexTelefone.test(clienteTelefone)) {
        res.status(400).json({
          erro: "Formato de telefone inválido. Use apenas números com DDD + DDI (ex: 5511999999999).",
        });
        return;
      }

      // Validar formato da dataHora
      const dataHoraObj = new Date(dataHora);
      if (isNaN(dataHoraObj.getTime())) {
        res.status(400).json({
          erro: "Formato de data/hora inválido. Use ISO 8601 (ex: 2026-03-15T09:00:00).",
        });
        return;
      }

      // Verificar se a data é no futuro
      if (dataHoraObj <= new Date()) {
        res.status(400).json({
          erro: "A data/hora deve ser no futuro.",
        });
        return;
      }

      // Buscar dados necessários em paralelo
      const [nichoDoc, prestadorDoc, servicoDoc] = await Promise.all([
        db.collection("nichos").doc(nichoId).get(),
        db.collection("prestadores").doc(prestadorId).get(),
        db.collection("servicos").doc(servicoId).get(),
      ]);

      // Validar existência dos documentos
      if (!nichoDoc.exists) {
        res.status(404).json({ erro: "Nicho não encontrado." });
        return;
      }
      if (!prestadorDoc.exists) {
        res.status(404).json({ erro: "Prestador não encontrado." });
        return;
      }
      if (!servicoDoc.exists) {
        res.status(404).json({ erro: "Serviço não encontrado." });
        return;
      }

      const nicho = { id: nichoDoc.id, ...nichoDoc.data() } as Nicho;
      const prestador = { id: prestadorDoc.id, ...prestadorDoc.data() } as Prestador;
      const servico = { id: servicoDoc.id, ...servicoDoc.data() } as Servico;

      // Verificar se estão ativos
      if (!nicho.ativo) {
        res.status(400).json({ erro: "Este nicho não está ativo no momento." });
        return;
      }
      if (!prestador.ativo) {
        res.status(400).json({ erro: "Este prestador não está ativo no momento." });
        return;
      }
      if (!servico.ativo) {
        res.status(400).json({ erro: "Este serviço não está disponível no momento." });
        return;
      }

      // 1. Validar se o horário ainda está disponível (evitar conflito/race condition)
      // Usar transação do Firestore para garantir consistência
      const protocolo = gerarProtocolo();
      const agora = Timestamp.now();

      const novoAgendamento = await db.runTransaction(async (transaction) => {
        // Verificar agendamentos conflitantes dentro da transação
        const inicioSlot = Timestamp.fromDate(dataHoraObj);
        const fimSlot = Timestamp.fromDate(
          new Date(dataHoraObj.getTime() + servico.duracaoMinutos * 60 * 1000)
        );

        const conflitosSnapshot = await transaction.get(
          db.collection("agendamentos")
            .where("prestadorId", "==", prestadorId)
            .where("status", "==", "confirmado")
            .where("dataHora", ">=", inicioSlot)
            .where("dataHora", "<", fimSlot)
        );

        if (!conflitosSnapshot.empty) {
          throw new Error("HORARIO_INDISPONIVEL");
        }

        // 2. Criar documento do agendamento
        const agendamentoRef = db.collection("agendamentos").doc();
        const agendamentoData: Omit<Agendamento, "id"> = {
          nichoId,
          prestadorId,
          servicoId,
          clienteNome,
          clienteTelefone,
          dataHora: inicioSlot,
          status: "confirmado",
          protocolo,
          criadoEm: agora,
          atualizadoEm: agora,
        };

        transaction.set(agendamentoRef, agendamentoData);

        return {
          id: agendamentoRef.id,
          ...agendamentoData,
        };
      });

      // 3. Personalizar mensagem de confirmação do nicho
      const dataFormatada = dataHoraObj.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const mensagemConfirmacao = nicho.textoConfirmacao
        .replace("{protocolo}", protocolo)
        .replace("{dataHora}", dataFormatada);

      // 4. Enviar notificação WhatsApp (fire-and-forget, não bloqueia resposta)
      notificarConfirmacao({
        telefone: clienteTelefone,
        protocolo,
        servico: servico.nome,
        prestador: prestador.nome,
        nicho: nicho.nomePublico,
        dataFormatada,
      }).catch(() => {}); // Ignora erros silenciosamente

      // 5. Retornar dados completos
      res.status(201).json({
        sucesso: true,
        agendamento: novoAgendamento,
        protocolo,
        mensagemConfirmacao,
        detalhes: {
          servico: servico.nome,
          prestador: prestador.nome,
          nicho: nicho.nomePublico,
        },
      });
    } catch (erro) {
      // Tratar erro de horário indisponível
      if (erro instanceof Error && erro.message === "HORARIO_INDISPONIVEL") {
        res.status(409).json({
          erro: "Este horário não está mais disponível. Por favor, escolha outro.",
        });
        return;
      }

      console.error("Erro ao criar agendamento:", erro);
      res.status(500).json({
        erro: "Erro interno ao criar agendamento.",
      });
    }
  }
);

/**
 * Cloud Function: cancelBooking
 *
 * Cancela um agendamento existente.
 *
 * Endpoint: POST /cancelBooking
 * Body:
 *   - protocolo (string): Protocolo do agendamento
 *   - clienteTelefone (string): Telefone do cliente (para validação)
 *
 * Retorno:
 *   { sucesso: true, mensagem: string }
 */
export const cancelBooking = onRequest(
  { cors: true, region: "southamerica-east1" },
  async (req, res) => {
    try {
      // Apenas POST é permitido
      if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido. Use POST." });
        return;
      }

      const { protocolo, clienteTelefone } = req.body;

      // Validar campos obrigatórios
      if (!protocolo || !clienteTelefone) {
        res.status(400).json({
          erro: "Campos obrigatórios: protocolo e clienteTelefone",
        });
        return;
      }

      // Buscar agendamento pelo protocolo
      const agendamentosSnapshot = await db
        .collection("agendamentos")
        .where("protocolo", "==", protocolo)
        .limit(1)
        .get();

      if (agendamentosSnapshot.empty) {
        res.status(404).json({
          erro: "Agendamento não encontrado com este protocolo.",
        });
        return;
      }

      const agendamentoDoc = agendamentosSnapshot.docs[0];
      const agendamento = agendamentoDoc.data() as Agendamento;

      // Validar que o telefone confere (segurança básica)
      if (agendamento.clienteTelefone !== clienteTelefone) {
        res.status(403).json({
          erro: "Telefone não confere com o cadastrado no agendamento.",
        });
        return;
      }

      // Verificar se já está cancelado
      if (agendamento.status === "cancelado") {
        res.status(400).json({
          erro: "Este agendamento já foi cancelado anteriormente.",
        });
        return;
      }

      // Atualizar status para cancelado
      await agendamentoDoc.ref.update({
        status: "cancelado",
        atualizadoEm: Timestamp.now(),
      });

      // Enviar notificação WhatsApp de cancelamento (fire-and-forget)
      notificarCancelamento({
        telefone: clienteTelefone,
        protocolo,
      }).catch(() => {});

      res.status(200).json({
        sucesso: true,
        mensagem: `Agendamento ${protocolo} cancelado com sucesso.`,
      });
    } catch (erro) {
      console.error("Erro ao cancelar agendamento:", erro);
      res.status(500).json({
        erro: "Erro interno ao cancelar agendamento.",
      });
    }
  }
);
