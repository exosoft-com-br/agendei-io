/**
 * pagamento.ts
 * Rotas de pagamento PIX.
 *
 * Modo Inter (automático):
 *   - POST /api/pagamento/webhook/inter  → Inter notifica pagamento → confirma automaticamente
 *   - GET  /api/pagamento/verificar/:id  → polling frontend (backup do webhook)
 *
 * Modo manual (fallback):
 *   - POST /api/pagamento/confirmar/:id  → cliente clica "Já Paguei"
 *
 * Admin:
 *   - PUT  /api/pagamento/admin/:id      → admin confirma ou cancela
 *   - GET  /api/pagamento/pendentes      → lista agendamentos com pagamento pendente
 */

import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { autenticar } from "../middleware/auth";
import { notificarConfirmacao, notificarPrestadorNovoAgendamento } from "../utils/notificacao";
import { verificarPagamentoPix, InterCredentials } from "../utils/pixInter";

export const pagamentoRouter = Router();

// ── Helper: busca negócio com credenciais Inter ────────────────────────────────
async function buscarCredenciaisInter(nichoId: string): Promise<InterCredentials | null> {
  const { data } = await supabase
    .from("negocios")
    .select("pix_banco, pix_client_id, pix_client_secret, pix_chave_pix, pix_cert_pem, pix_key_pem")
    .eq("nicho_id", nichoId)
    .limit(1)
    .single();

  if (
    !data ||
    data.pix_banco !== "inter" ||
    !data.pix_client_id ||
    !data.pix_client_secret ||
    !data.pix_chave_pix ||
    !data.pix_cert_pem ||
    !data.pix_key_pem
  ) return null;

  return {
    clientId:     data.pix_client_id,
    clientSecret: data.pix_client_secret,
    chavePix:     data.pix_chave_pix,
    certPem:      data.pix_cert_pem,
    keyPem:       data.pix_key_pem,
    sandbox:      process.env.PIX_SANDBOX === "true",
  };
}

// ── Helper: confirmar pagamento e notificar via WhatsApp ───────────────────────
async function processarPagamentoConfirmado(agendamentoId: string): Promise<void> {
  // Atualiza status
  await supabase
    .from("agendamentos")
    .update({ pagamento_status: "pago" })
    .eq("id", agendamentoId);

  // Busca dados completos para notificações
  const { data: ag } = await supabase
    .from("agendamentos")
    .select(`*, nichos(nome_publico, texto_confirmacao), prestadores(nome, whatsapp_numero), servicos(nome)`)
    .eq("id", agendamentoId)
    .single();

  if (!ag) return;

  const { data: negocioRow } = await supabase
    .from("negocios")
    .select("id, whatsapp_instancia, whatsapp_status")
    .eq("nicho_id", ag.nicho_id)
    .limit(1)
    .single();

  const negocioId = negocioRow?.id;
  const instancia = negocioRow?.whatsapp_status === "conectado"
    ? (negocioRow.whatsapp_instancia ?? undefined)
    : undefined;

  const nicho     = (ag.nichos as any)?.nome_publico ?? ag.nicho_id;
  const prestador = ag.prestadores as any;
  const servico   = (ag.servicos as any)?.nome ?? "";
  const dataFormatada = new Date(ag.data_hora).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  await notificarConfirmacao({
    telefone: ag.cliente_telefone, protocolo: ag.protocolo,
    servico, prestador: prestador?.nome ?? "", nicho, dataFormatada, negocioId, instancia,
  }).catch(() => {});

  if (prestador?.whatsapp_numero) {
    await notificarPrestadorNovoAgendamento({
      telefonePrestador: prestador.whatsapp_numero, protocolo: ag.protocolo,
      clienteNome: ag.cliente_nome, servico, dataFormatada, negocioId, instancia,
    }).catch(() => {});
  }

  if (negocioId) {
    try {
      await supabase.rpc("registrar_cliente_agendamento", {
        p_negocio_id: negocioId, p_nome: ag.cliente_nome,
        p_telefone: ag.cliente_telefone, p_data_hora: ag.data_hora,
      });
    } catch { /* ignora */ }
  }
}

// ============================================================
// POST /api/pagamento/webhook/inter
// Inter envia notificação automática quando PIX é pago.
// Body: { pix: [{ txid, valor, horario, ... }] }
// ============================================================
pagamentoRouter.post("/pagamento/webhook/inter", async (req: Request, res: Response) => {
  try {
    const pixList: any[] = req.body?.pix || [];

    for (const p of pixList) {
      const txid = p.txid;
      if (!txid) continue;

      const { data: ag } = await supabase
        .from("agendamentos")
        .select("id, pagamento_status")
        .eq("pagamento_txid", txid)
        .single();

      if (!ag || ag.pagamento_status === "pago") continue;

      console.log(`[pagamento] Webhook Inter: PIX pago — agendamento ${ag.id}`);
      processarPagamentoConfirmado(ag.id).catch(console.error);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[pagamento] Erro no webhook Inter:", e);
    res.status(200).json({ ok: true }); // sempre 200 para o Inter não reenviar
  }
});

// ============================================================
// GET /api/pagamento/verificar/:agendamentoId
// Polling do frontend — verifica se pagamento foi confirmado.
// Se modo Inter: consulta API do banco diretamente.
// ============================================================
pagamentoRouter.get("/pagamento/verificar/:agendamentoId", async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;

  try {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, pagamento_status, pagamento_txid, pagamento_expira_em, nicho_id, protocolo, taxa_cobrada")
      .eq("id", agendamentoId)
      .single();

    if (!ag) { res.status(404).json({ erro: "Não encontrado." }); return; }

    // Já confirmado
    if (ag.pagamento_status === "pago") {
      res.json({ pago: true, status: "CONCLUIDA", protocolo: ag.protocolo });
      return;
    }

    // Verificar expiração
    const expirado = ag.pagamento_expira_em
      ? new Date(ag.pagamento_expira_em) < new Date()
      : false;

    if (expirado) {
      res.json({ pago: false, expirado: true, status: "EXPIRADA" });
      return;
    }

    // Modo Inter: consulta API para confirmação automática
    if (ag.pagamento_txid) {
      const creds = await buscarCredenciaisInter(ag.nicho_id);
      if (creds) {
        try {
          const { pago, status } = await verificarPagamentoPix(creds, ag.pagamento_txid);
          if (pago) {
            processarPagamentoConfirmado(ag.id).catch(console.error);
          }
          res.json({ pago, status, expirado: false, protocolo: ag.protocolo });
          return;
        } catch (e: any) {
          console.error("[pagamento] Erro ao consultar Inter:", e?.message);
          // Fallback: retorna status do banco local
        }
      }
    }

    // Modo manual: retorna status atual do banco
    res.json({
      pago: false,
      status: "PENDENTE",
      expirado: false,
      modoManual: true,
      protocolo: ag.protocolo,
    });
  } catch (e) {
    console.error("[pagamento] Erro ao verificar:", e);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// POST /api/pagamento/confirmar/:agendamentoId
// Cliente clica "Já Paguei" (modo manual — sem Inter API)
// ============================================================
pagamentoRouter.post("/pagamento/confirmar/:agendamentoId", async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;

  try {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, pagamento_status, pagamento_expira_em, protocolo")
      .eq("id", agendamentoId)
      .single();

    if (!ag) { res.status(404).json({ erro: "Agendamento não encontrado." }); return; }
    if (ag.pagamento_status === "pago") {
      res.json({ sucesso: true, mensagem: "Pagamento já confirmado.", protocolo: ag.protocolo });
      return;
    }
    if (ag.pagamento_expira_em && new Date(ag.pagamento_expira_em) < new Date()) {
      res.status(400).json({ erro: "O PIX expirou. Faça um novo agendamento." });
      return;
    }

    processarPagamentoConfirmado(agendamentoId).catch(console.error);

    res.json({
      sucesso: true,
      mensagem: "Agendamento confirmado! Você receberá uma confirmação via WhatsApp.",
      protocolo: ag.protocolo,
    });
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// PUT /api/pagamento/admin/:agendamentoId
// Admin confirma ou cancela pagamento manualmente no painel
// ============================================================
pagamentoRouter.put("/pagamento/admin/:agendamentoId", autenticar, async (req: Request, res: Response) => {
  const { agendamentoId } = req.params;
  const { acao } = req.body; // 'pago' | 'cancelar'

  if (!["pago", "cancelar"].includes(acao)) {
    res.status(400).json({ erro: "acao deve ser 'pago' ou 'cancelar'." });
    return;
  }

  try {
    // Sub-usuários só podem confirmar/cancelar agendamentos do próprio negócio
    if (req.auth!.role !== "admin") {
      const negocioId = req.auth!.negocioId;
      if (!negocioId) { res.status(403).json({ erro: "Sem negócio vinculado." }); return; }
      const { data: neg } = await supabase.from("negocios").select("nicho_id").eq("id", negocioId).single();
      if (!neg) { res.status(403).json({ erro: "Negócio não encontrado." }); return; }
      const { data: ag } = await supabase.from("agendamentos").select("nicho_id").eq("id", agendamentoId).single();
      if (!ag || ag.nicho_id !== neg.nicho_id) { res.status(403).json({ erro: "Acesso negado." }); return; }
    }
    if (acao === "pago") {
      processarPagamentoConfirmado(agendamentoId).catch(console.error);
      res.json({ sucesso: true, mensagem: "Pagamento confirmado." });
    } else {
      await supabase
        .from("agendamentos")
        .update({ status: "cancelado", atualizado_em: new Date().toISOString() })
        .eq("id", agendamentoId);
      res.json({ sucesso: true, mensagem: "Agendamento cancelado." });
    }
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// GET /api/pagamento/pendentes
// Admin: lista agendamentos com pagamento pendente
// ============================================================
pagamentoRouter.get("/pagamento/pendentes", autenticar, async (req: Request, res: Response) => {
  try {
    const ownerId = req.auth!.ownerId;
    // Sub-usuários só veem pendentes do próprio negócio
    const negocioRestrito = req.auth!.role !== "admin" ? req.auth!.negocioId : null;

    let negociosQuery = supabase
      .from("negocios")
      .select("nicho_id, nome_fantasia")
      .eq("owner_id", ownerId);
    if (negocioRestrito) negociosQuery = negociosQuery.eq("id", negocioRestrito);
    const { data: negocios } = await negociosQuery;

    if (!negocios?.length) { res.json({ agendamentos: [] }); return; }

    const nichoIds = negocios.map((n: any) => n.nicho_id);
    const nomePorNicho: Record<string, string> = {};
    for (const n of negocios) nomePorNicho[n.nicho_id] = n.nome_fantasia;

    const { data } = await supabase
      .from("agendamentos")
      .select("id, protocolo, cliente_nome, cliente_telefone, data_hora, taxa_cobrada, pagamento_status, pagamento_expira_em, nicho_id")
      .in("nicho_id", nichoIds)
      .eq("pagamento_status", "pendente")
      .eq("status", "confirmado")
      .order("criado_em", { ascending: false });

    res.json({
      agendamentos: (data || []).map((a: any) => ({
        ...a,
        negocioNome: nomePorNicho[a.nicho_id] || "",
        taxaCobrada: a.taxa_cobrada ? Number(a.taxa_cobrada) : 0,
        expirado: a.pagamento_expira_em ? new Date(a.pagamento_expira_em) < new Date() : false,
      })),
    });
  } catch (e) {
    res.status(500).json({ erro: "Erro interno." });
  }
});
