import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { sanitizar, sanitizarId } from "../utils/sanitizar";

export const calendarioRouter = Router();

/**
 * POST /api/integracoes/email
 * Cadastra integração de calendário por email.
 */
calendarioRouter.post("/integracoes/email", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.body.negocioId);
    const prestadorId = sanitizarId(req.body.prestadorId);
    const provedor = sanitizar(req.body.provedor || "");
    const emailCalendario = sanitizar(req.body.emailCalendario || "");

    if (!negocioId || !prestadorId || !provedor || !emailCalendario) {
      res.status(400).json({
        erro: "Campos obrigatórios: negocioId, prestadorId, provedor, emailCalendario",
      });
      return;
    }

    // Validar provedor
    const provedoresValidos = ["google", "outlook", "apple", "ical", "smtp"];
    if (!provedoresValidos.includes(provedor)) {
      res.status(400).json({
        erro: `Provedor inválido. Use: ${provedoresValidos.join(", ")}`,
      });
      return;
    }

    // Validar formato de email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCalendario)) {
      res.status(400).json({ erro: "Formato de email inválido." });
      return;
    }

    const enviarConfirmacao = req.body.enviarConfirmacao !== false;
    const enviarCancelamento = req.body.enviarCancelamento !== false;
    const enviarLembrete = req.body.enviarLembrete !== false;
    const lembreteHorasAntes = Number(req.body.lembreteHorasAntes) || 24;

    const { data, error } = await supabase
      .from("integracoes_email")
      .insert({
        negocio_id: negocioId,
        prestador_id: prestadorId,
        provedor,
        email_calendario: emailCalendario,
        enviar_confirmacao: enviarConfirmacao,
        enviar_cancelamento: enviarCancelamento,
        enviar_lembrete: enviarLembrete,
        lembrete_horas_antes: lembreteHorasAntes,
        status: "pendente",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ erro: "Integração já existe para este prestador e provedor." });
        return;
      }
      console.error("Erro ao criar integração:", error);
      res.status(500).json({ erro: "Erro ao criar integração." });
      return;
    }

    res.status(201).json({
      sucesso: true,
      integracao: {
        id: data.id,
        negocioId: data.negocio_id,
        prestadorId: data.prestador_id,
        provedor: data.provedor,
        emailCalendario: data.email_calendario,
        enviarConfirmacao: data.enviar_confirmacao,
        enviarCancelamento: data.enviar_cancelamento,
        enviarLembrete: data.enviar_lembrete,
        lembreteHorasAntes: data.lembrete_horas_antes,
        status: data.status,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar integração:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * GET /api/integracoes/email/:negocioId
 * Lista integrações de email de um negócio.
 */
calendarioRouter.get("/integracoes/email/:negocioId", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.params.negocioId);
    if (!negocioId) {
      res.status(400).json({ erro: "negocioId inválido." });
      return;
    }

    const { data, error } = await supabase
      .from("integracoes_email")
      .select(`
        *,
        prestadores (nome, email)
      `)
      .eq("negocio_id", negocioId)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao listar integrações:", error);
      res.status(500).json({ erro: "Erro ao listar integrações." });
      return;
    }

    const integracoes = (data || []).map((i: any) => ({
      id: i.id,
      prestadorId: i.prestador_id,
      prestadorNome: i.prestadores?.nome || "",
      provedor: i.provedor,
      emailCalendario: i.email_calendario,
      enviarConfirmacao: i.enviar_confirmacao,
      enviarCancelamento: i.enviar_cancelamento,
      enviarLembrete: i.enviar_lembrete,
      lembreteHorasAntes: i.lembrete_horas_antes,
      status: i.status,
      ultimoSync: i.ultimo_sync,
      erroMensagem: i.erro_mensagem,
    }));

    res.json({ integracoes });
  } catch (erro) {
    console.error("Erro ao listar integrações:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/integracoes/email/:integracaoId
 * Atualiza configurações de integração.
 */
calendarioRouter.put("/integracoes/email/:integracaoId", async (req: Request, res: Response) => {
  try {
    const integracaoId = sanitizarId(req.params.integracaoId);
    if (!integracaoId) {
      res.status(400).json({ erro: "integracaoId inválido." });
      return;
    }

    const updates: Record<string, any> = {};

    if (req.body.emailCalendario) {
      const email = sanitizar(req.body.emailCalendario);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ erro: "Formato de email inválido." });
        return;
      }
      updates.email_calendario = email;
    }
    if (req.body.enviarConfirmacao !== undefined) updates.enviar_confirmacao = Boolean(req.body.enviarConfirmacao);
    if (req.body.enviarCancelamento !== undefined) updates.enviar_cancelamento = Boolean(req.body.enviarCancelamento);
    if (req.body.enviarLembrete !== undefined) updates.enviar_lembrete = Boolean(req.body.enviarLembrete);
    if (req.body.lembreteHorasAntes !== undefined) updates.lembrete_horas_antes = Number(req.body.lembreteHorasAntes) || 24;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("integracoes_email")
      .update(updates)
      .eq("id", integracaoId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar integração:", error);
      res.status(500).json({ erro: "Erro ao atualizar integração." });
      return;
    }

    res.json({ sucesso: true, integracao: data });
  } catch (erro) {
    console.error("Erro ao atualizar integração:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * DELETE /api/integracoes/email/:integracaoId
 * Remove integração de email.
 */
calendarioRouter.delete("/integracoes/email/:integracaoId", async (req: Request, res: Response) => {
  try {
    const integracaoId = sanitizarId(req.params.integracaoId);
    if (!integracaoId) {
      res.status(400).json({ erro: "integracaoId inválido." });
      return;
    }

    const { error } = await supabase
      .from("integracoes_email")
      .delete()
      .eq("id", integracaoId);

    if (error) {
      console.error("Erro ao remover integração:", error);
      res.status(500).json({ erro: "Erro ao remover integração." });
      return;
    }

    res.json({ sucesso: true, mensagem: "Integração removida." });
  } catch (erro) {
    console.error("Erro ao remover integração:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});
