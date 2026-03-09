import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { gerarProtocolo } from "../utils/gerarProtocolo";
import { notificarConfirmacao, notificarCancelamento } from "../utils/notificacao";
import { sanitizar, sanitizarId, validarTelefone, validarDataHora } from "../utils/sanitizar";

export const bookingRouter = Router();

/**
 * POST /api/booking
 *
 * Cria um novo agendamento.
 * Body: { nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora }
 */
bookingRouter.post("/booking", async (req: Request, res: Response) => {
  try {
    const rawBody = req.body;

    // Sanitizar inputs
    const nichoId = sanitizarId(rawBody.nichoId);
    const prestadorId = sanitizarId(rawBody.prestadorId);
    const servicoId = sanitizarId(rawBody.servicoId);
    const clienteNome = sanitizar(rawBody.clienteNome || "");
    const clienteTelefone = (rawBody.clienteTelefone || "").replace(/\D/g, "");
    const dataHora = rawBody.dataHora;

    // Validar campos obrigatórios
    if (!nichoId || !prestadorId || !servicoId || !clienteNome || !clienteTelefone || !dataHora) {
      res.status(400).json({
        erro: "Campos obrigatórios: nichoId, prestadorId, servicoId, clienteNome, clienteTelefone, dataHora",
      });
      return;
    }

    // Validar formato do telefone
    if (!validarTelefone(clienteTelefone)) {
      res.status(400).json({
        erro: "Formato de telefone inválido. Use apenas números com DDD + DDI (ex: 5511999999999).",
      });
      return;
    }

    // Validar data
    const dataHoraObj = validarDataHora(dataHora);
    if (!dataHoraObj) {
      res.status(400).json({ erro: "Formato de data/hora inválido. Use ISO 8601." });
      return;
    }

    if (dataHoraObj <= new Date()) {
      res.status(400).json({ erro: "A data/hora deve ser no futuro." });
      return;
    }

    // Buscar nicho, prestador e serviço em paralelo
    const [nichoRes, prestadorRes, servicoRes] = await Promise.all([
      supabase.from("nichos").select("*").eq("id", nichoId).single(),
      supabase.from("prestadores").select("*").eq("id", prestadorId).single(),
      supabase.from("servicos").select("*").eq("id", servicoId).single(),
    ]);

    if (!nichoRes.data) {
      res.status(404).json({ erro: "Nicho não encontrado." });
      return;
    }
    if (!prestadorRes.data) {
      res.status(404).json({ erro: "Prestador não encontrado." });
      return;
    }
    if (!servicoRes.data) {
      res.status(404).json({ erro: "Serviço não encontrado." });
      return;
    }

    const nicho = nichoRes.data;
    const prestador = prestadorRes.data;
    const servico = servicoRes.data;

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

    // Verificar conflitos de horário
    const fimSlot = new Date(dataHoraObj.getTime() + servico.duracao_minutos * 60 * 1000);

    const { data: conflitos } = await supabase
      .from("agendamentos")
      .select("id")
      .eq("prestador_id", prestadorId)
      .eq("status", "confirmado")
      .gte("data_hora", dataHoraObj.toISOString())
      .lt("data_hora", fimSlot.toISOString());

    if (conflitos && conflitos.length > 0) {
      res.status(409).json({
        erro: "Este horário não está mais disponível. Por favor, escolha outro.",
      });
      return;
    }

    // Criar agendamento
    const protocolo = gerarProtocolo();

    const { data: agendamento, error: insertErr } = await supabase
      .from("agendamentos")
      .insert({
        nicho_id: nichoId,
        prestador_id: prestadorId,
        servico_id: servicoId,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        data_hora: dataHoraObj.toISOString(),
        status: "confirmado",
        protocolo,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Erro ao inserir agendamento:", insertErr);
      res.status(500).json({ erro: "Erro ao criar agendamento." });
      return;
    }

    // Formatar data para mensagem
    const dataFormatada = dataHoraObj.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const mensagemConfirmacao = nicho.texto_confirmacao
      .replace("{protocolo}", protocolo)
      .replace("{dataHora}", dataFormatada);

    // Notificação WhatsApp (fire-and-forget)
    notificarConfirmacao({
      telefone: clienteTelefone,
      protocolo,
      servico: servico.nome,
      prestador: prestador.nome,
      nicho: nicho.nome_publico,
      dataFormatada,
    }).catch(() => {});

    res.status(201).json({
      sucesso: true,
      agendamento: {
        id: agendamento.id,
        nichoId,
        prestadorId,
        servicoId,
        clienteNome,
        clienteTelefone,
        dataHora: agendamento.data_hora,
        status: agendamento.status,
        protocolo,
      },
      protocolo,
      mensagemConfirmacao,
      detalhes: {
        servico: servico.nome,
        prestador: prestador.nome,
        nicho: nicho.nome_publico,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar agendamento:", erro);
    res.status(500).json({ erro: "Erro interno ao criar agendamento." });
  }
});

/**
 * POST /api/booking/cancel
 *
 * Cancela um agendamento existente.
 * Body: { protocolo, clienteTelefone }
 */
bookingRouter.post("/booking/cancel", async (req: Request, res: Response) => {
  try {
    const protocolo = sanitizar(req.body.protocolo || "");
    const clienteTelefone = (req.body.clienteTelefone || "").replace(/\D/g, "");

    if (!protocolo || !clienteTelefone) {
      res.status(400).json({ erro: "Campos obrigatórios: protocolo e clienteTelefone" });
      return;
    }

    if (!validarTelefone(clienteTelefone)) {
      res.status(400).json({ erro: "Formato de telefone inválido." });
      return;
    }

    // Buscar agendamento
    const { data: agendamento, error: findErr } = await supabase
      .from("agendamentos")
      .select("*")
      .eq("protocolo", protocolo)
      .single();

    if (findErr || !agendamento) {
      res.status(404).json({ erro: "Agendamento não encontrado com este protocolo." });
      return;
    }

    if (agendamento.cliente_telefone !== clienteTelefone) {
      res.status(403).json({ erro: "Telefone não confere com o cadastrado no agendamento." });
      return;
    }

    if (agendamento.status === "cancelado") {
      res.status(400).json({ erro: "Este agendamento já foi cancelado anteriormente." });
      return;
    }

    // Cancelar
    const { error: updateErr } = await supabase
      .from("agendamentos")
      .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
      .eq("id", agendamento.id);

    if (updateErr) {
      console.error("Erro ao cancelar:", updateErr);
      res.status(500).json({ erro: "Erro ao cancelar agendamento." });
      return;
    }

    // Notificação WhatsApp (fire-and-forget)
    notificarCancelamento({ telefone: clienteTelefone, protocolo }).catch(() => {});

    res.json({
      sucesso: true,
      mensagem: `Agendamento ${protocolo} cancelado com sucesso.`,
    });
  } catch (erro) {
    console.error("Erro ao cancelar agendamento:", erro);
    res.status(500).json({ erro: "Erro interno ao cancelar agendamento." });
  }
});

/**
 * GET /api/booking
 * Lista agendamentos filtrando por data, nome ou telefone do cliente.
 * Query params: data (YYYY-MM-DD), clienteNome, clienteTelefone
 */
bookingRouter.get("/booking", async (req: Request, res: Response) => {
  try {
    const { data, clienteNome, clienteTelefone, nichoId, prestadorId, negocioId } = req.query;
    let agendamentos = [];
    let error = null;

    let query;

    if (negocioId) {
      const { data: prestadores, error: errPrest } = await supabase
        .from("prestadores")
        .select("id")
        .eq("negocio_id", negocioId);

      if (errPrest) {
        return res.status(500).json({ erro: "Erro ao buscar prestadores do negócio." });
      }
      const prestadorIds = (prestadores || []).map((p: any) => p.id);
      if (!prestadorIds.length) {
        return res.json({ agendamentos: [] });
      }

      query = supabase.from("agendamentos").select("*, prestadores(nome)");
      query = query.in("prestador_id", prestadorIds);
    } else {
      query = supabase.from("agendamentos").select("*, prestadores(nome)");
      if (nichoId) {
        query = query.eq("nicho_id", nichoId);
      }
      if (prestadorId) {
        query = query.eq("prestador_id", prestadorId);
      }
    }

    if (data) {
      const start = new Date(data as string);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      query = query.gte("data_hora", start.toISOString()).lt("data_hora", end.toISOString());
    }
    if (clienteNome) {
      query = query.ilike("cliente_nome", `%${clienteNome}%`);
    }
    if (clienteTelefone) {
      const tel = (clienteTelefone as string).replace(/\D/g, "");
      query = query.ilike("cliente_telefone", `%${tel}%`);
    }

    query = query.order("data_hora", { ascending: true });

    const result = await query;
    agendamentos = result.data || [];
    error = result.error;

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return res.status(500).json({ erro: "Erro ao buscar agendamentos." });
    }

    const mappedAgendamentos = (agendamentos || []).map((ag: any) => ({
      ...ag,
      prestadores: undefined, // remover o objeto aninhado
      prestadorNome: ag.prestadores?.nome || null,
    }));

    res.json({ agendamentos: mappedAgendamentos });
  } catch (erro) {
    console.error("Erro interno ao buscar agendamentos:", erro);
    res.status(500).json({ erro: "Erro interno ao buscar agendamentos." });
  }
});
