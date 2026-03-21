import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { gerarProtocolo } from "../utils/gerarProtocolo";
import { notificarConfirmacao, notificarCancelamento } from "../utils/notificacao";
import { sanitizar, sanitizarId, validarTelefone, validarDataHora } from "../utils/sanitizar";
import { autenticar } from "../middleware/auth";

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
        erro: "Telefone inválido. Use apenas números com DDD (ex: 11999999999 ou 5511999999999).",
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

    // Registrar/atualizar cliente por negócio (fire-and-forget)
    supabase
      .from("negocios")
      .select("id")
      .eq("nicho_id", nichoId)
      .limit(1)
      .single()
      .then(({ data: negocioRow }) => {
        if (!negocioRow?.id) return;
        return supabase.rpc("registrar_cliente_agendamento", {
          p_negocio_id: negocioRow.id,
          p_nome: clienteNome,
          p_telefone: clienteTelefone,
          p_data_hora: dataHoraObj.toISOString(),
        });
      })
      .catch(() => {});

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
 * Lista agendamentos com filtros combinados.
 * Query params: negocioId, nichoId, prestadorId,
 *               data (YYYY-MM-DD), dataInicio + dataFim (range),
 *               clienteNome, clienteTelefone
 * Requer autenticação (Bearer token).
 */
bookingRouter.get("/booking", autenticar(), async (req: Request, res: Response) => {
  try {
    const {
      data,
      dataInicio,
      dataFim,
      clienteNome,
      clienteTelefone,
      nichoId,
      prestadorId,
      negocioId,
    } = req.query;

    let query;

    if (negocioId) {
      // Busca o nicho_id do negócio e usa-o para encontrar TODOS os prestadores
      // (negocio_id nos prestadores é opcional e inconsistente — não usar como filtro primário)
      const { data: negocioData } = await supabase
        .from("negocios")
        .select("nicho_id")
        .eq("id", negocioId)
        .single();

      if (!negocioData?.nicho_id) {
        return res.json({ agendamentos: [] });
      }

      const { data: prestByNicho } = await supabase
        .from("prestadores")
        .select("id")
        .eq("nicho_id", negocioData.nicho_id);

      const prestadorIds = (prestByNicho || []).map((p: any) => p.id);

      if (!prestadorIds.length) {
        return res.json({ agendamentos: [] });
      }

      query = supabase.from("agendamentos").select("*, prestadores(nome), servicos(nome,preco)");
      query = query.in("prestador_id", prestadorIds);
    } else {
      query = supabase.from("agendamentos").select("*, prestadores(nome), servicos(nome,preco)");
      if (nichoId) {
        query = query.eq("nicho_id", nichoId);
      }
    }

    // Filtro por prestador específico (dentro do conjunto do negócio)
    if (prestadorId) {
      query = query.eq("prestador_id", prestadorId);
    }

    // Parse de data considerando fuso de Brasília (UTC-3)
    // "2026-03-15" sem timezone = UTC midnight, mas queremos midnight de SP (= UTC+3h)
    const SP_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3 → soma 3h ao UTC midnight
    function parseDateSP(dateStr: string): Date {
      return new Date(new Date(dateStr).getTime() + SP_OFFSET_MS);
    }

    // Filtro de data: intervalo tem prioridade sobre data única
    if (dataInicio && dataFim) {
      const start = parseDateSP(dataInicio as string);
      const end = parseDateSP(dataFim as string);
      end.setUTCDate(end.getUTCDate() + 1); // inclui o último dia do intervalo
      query = query
        .gte("data_hora", start.toISOString())
        .lt("data_hora", end.toISOString());
    } else if (data) {
      const start = parseDateSP(data as string);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      query = query
        .gte("data_hora", start.toISOString())
        .lt("data_hora", end.toISOString());
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
    const agendamentos = result.data || [];
    const error = result.error;

    if (error) {
      console.error("Erro ao buscar agendamentos:", error);
      return res.status(500).json({ erro: "Erro ao buscar agendamentos." });
    }

    const mappedAgendamentos = agendamentos.map((ag: any) => ({
      ...ag,
      prestadores: undefined,
      servicos: undefined,
      prestadorNome: ag.prestadores?.nome || null,
      servicoNome: ag.servicos?.nome || null,
      servicoPreco: ag.servicos?.preco ?? null,
    }));

    res.json({ agendamentos: mappedAgendamentos });
  } catch (erro) {
    console.error("Erro interno ao buscar agendamentos:", erro);
    res.status(500).json({ erro: "Erro interno ao buscar agendamentos." });
  }
});

/**
 * PUT /api/booking/:id
 * Edita um agendamento existente (status, data/hora, cliente, prestador, serviço).
 * Requer autenticação (Bearer token).
 */
bookingRouter.put("/booking/:id", autenticar(), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) { res.status(400).json({ erro: "ID do agendamento obrigatório." }); return; }

    const { status, clienteNome, clienteTelefone, dataHora, prestadorId, servicoId } = req.body;

    const updates: Record<string, any> = {
      atualizado_em: new Date().toISOString(),
    };

    if (status !== undefined) {
      if (!["confirmado", "cancelado", "concluido"].includes(status)) {
        res.status(400).json({ erro: "Status inválido. Use: confirmado, cancelado ou concluido." });
        return;
      }
      updates.status = status;
    }
    if (clienteNome !== undefined) updates.cliente_nome = sanitizar(clienteNome);
    if (clienteTelefone !== undefined) updates.cliente_telefone = (clienteTelefone as string).replace(/\D/g, "");
    if (prestadorId !== undefined) updates.prestador_id = sanitizarId(prestadorId);
    if (servicoId !== undefined) updates.servico_id = sanitizarId(servicoId);
    if (dataHora !== undefined) {
      const dataHoraObj = validarDataHora(dataHora);
      if (!dataHoraObj) { res.status(400).json({ erro: "Formato de data/hora inválido." }); return; }
      updates.data_hora = dataHoraObj.toISOString();
    }

    if (Object.keys(updates).length === 1) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { error } = await supabase
      .from("agendamentos")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Erro ao editar agendamento:", error);
      res.status(500).json({ erro: "Erro ao atualizar agendamento." });
      return;
    }

    res.json({ sucesso: true });
  } catch (erro) {
    console.error("Erro ao editar agendamento:", erro);
    res.status(500).json({ erro: "Erro interno ao editar agendamento." });
  }
});

/**
 * GET /api/clientes/buscar?negocioId=xxx&telefone=yyy
 * Rota PÚBLICA — busca cliente por telefone dentro de um negócio.
 * Retorna nome caso encontrado, para auto-preenchimento na página de agendamento.
 */
bookingRouter.get("/clientes/buscar", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.query.negocioId as string);
    const telefone  = ((req.query.telefone as string) || "").replace(/\D/g, "");

    if (!negocioId || telefone.length < 10) {
      res.json({ encontrado: false });
      return;
    }

    // 1ª tentativa: tabela clientes (mais rápida, tem contador)
    const { data: clienteRow } = await supabase
      .from("clientes")
      .select("nome, telefone, total_agendamentos")
      .eq("negocio_id", negocioId)
      .ilike("telefone", `%${telefone}%`)
      .limit(1)
      .maybeSingle();

    if (clienteRow) {
      res.json({
        encontrado: true,
        nome: clienteRow.nome,
        telefone: clienteRow.telefone,
        totalAgendamentos: clienteRow.total_agendamentos,
      });
      return;
    }

    // 2ª tentativa: fallback nos agendamentos existentes (funciona sem a tabela clientes)
    const { data: negocioRow } = await supabase
      .from("negocios")
      .select("nicho_id")
      .eq("id", negocioId)
      .single();

    if (negocioRow?.nicho_id) {
      const { data: agRow } = await supabase
        .from("agendamentos")
        .select("cliente_nome, cliente_telefone")
        .eq("nicho_id", negocioRow.nicho_id)
        .ilike("cliente_telefone", `%${telefone}%`)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (agRow) {
        res.json({
          encontrado: true,
          nome: agRow.cliente_nome,
          telefone: agRow.cliente_telefone,
          totalAgendamentos: null,
        });
        return;
      }
    }

    res.json({ encontrado: false });
  } catch (erro) {
    console.error("Erro ao buscar cliente:", erro);
    res.json({ encontrado: false });
  }
});

/**
 * GET /api/clientes/count?negocioId=xxx
 * Retorna o total de clientes únicos cadastrados no negócio.
 * Requer autenticação.
 */
bookingRouter.get("/clientes/count", autenticar(), async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.query.negocioId as string);
    if (!negocioId) {
      res.status(400).json({ erro: "negocioId obrigatório." });
      return;
    }

    const { count, error } = await supabase
      .from("clientes")
      .select("id", { count: "exact", head: true })
      .eq("negocio_id", negocioId);

    if (error) {
      console.error("Erro ao contar clientes:", error);
      res.status(500).json({ erro: "Erro ao contar clientes." });
      return;
    }

    res.json({ total: count ?? 0 });
  } catch (erro) {
    console.error("Erro interno ao contar clientes:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});
