import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { autenticar } from "../middleware/auth";
import { obterEvolutionProvider } from "../utils/whatsappAdapter";
import { sanitizarId } from "../utils/sanitizar";

export const whatsappNegocioRouter = Router();

const API_URL = process.env.API_URL || "https://plataforma-agendamentos-api.onrender.com";

function nomeInstancia(negocioId: string): string {
  return `neg-${negocioId.replace(/-/g, "").substring(0, 20)}`;
}

/**
 * POST /api/negocio/:id/whatsapp/conectar
 * Cria instância na Evolution API e retorna QR code para o negócio escanear.
 */
whatsappNegocioRouter.post(
  "/negocio/:id/whatsapp/conectar",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    const evolution = obterEvolutionProvider();
    if (!evolution) {
      res.status(503).json({ erro: "WhatsApp não configurado no servidor." });
      return;
    }

    const instancia = nomeInstancia(negocioId);
    const webhookUrl = `${API_URL}/api/whatsapp/webhook`;

    try {
      await evolution.criarInstancia(instancia, webhookUrl);
    } catch (e: unknown) {
      // Instância pode já existir — continua para buscar QR
      const err = e as { response?: { status?: number } };
      if (err?.response?.status !== 409) {
        console.error("[whatsapp] Erro ao criar instância:", e);
      }
    }

    const qrcode = await evolution.obterQRCode(instancia);

    // Salva instância no banco
    await supabase
      .from("negocios")
      .update({ whatsapp_instancia: instancia, whatsapp_status: "conectando" })
      .eq("id", negocioId);

    res.json({ instancia, qrcode });
  }
);

/**
 * GET /api/negocio/:id/whatsapp/status
 * Retorna status da conexão. Se ainda conectando, retorna novo QR code.
 */
whatsappNegocioRouter.get(
  "/negocio/:id/whatsapp/status",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    const { data: negocio } = await supabase
      .from("negocios")
      .select("whatsapp_instancia, whatsapp_status")
      .eq("id", negocioId)
      .single();

    if (!negocio?.whatsapp_instancia) {
      res.json({ status: "desconectado" });
      return;
    }

    const evolution = obterEvolutionProvider();
    if (!evolution) {
      res.json({ status: negocio.whatsapp_status || "desconectado" });
      return;
    }

    const statusReal = await evolution.obterStatus(negocio.whatsapp_instancia);

    // Sincroniza banco se mudou
    if (statusReal !== negocio.whatsapp_status) {
      await supabase
        .from("negocios")
        .update({ whatsapp_status: statusReal })
        .eq("id", negocioId);
    }

    let qrcode: string | null = null;
    if (statusReal === "conectando") {
      qrcode = await evolution.obterQRCode(negocio.whatsapp_instancia);
    }

    res.json({ status: statusReal, qrcode });
  }
);

/**
 * DELETE /api/negocio/:id/whatsapp/desconectar
 * Remove instância e limpa campos no banco.
 */
whatsappNegocioRouter.delete(
  "/negocio/:id/whatsapp/desconectar",
  autenticar,
  async (req: Request, res: Response) => {
    const negocioId = sanitizarId(req.params.id);
    if (!negocioId) { res.status(400).json({ erro: "negocioId inválido." }); return; }

    const { data: negocio } = await supabase
      .from("negocios")
      .select("whatsapp_instancia")
      .eq("id", negocioId)
      .single();

    if (negocio?.whatsapp_instancia) {
      const evolution = obterEvolutionProvider();
      if (evolution) {
        try {
          await evolution.deletarInstancia(negocio.whatsapp_instancia);
        } catch {
          // Ignora se já não existia
        }
      }
    }

    await supabase
      .from("negocios")
      .update({ whatsapp_instancia: null, whatsapp_status: "desconectado", whatsapp_numero: null })
      .eq("id", negocioId);

    res.json({ sucesso: true });
  }
);

/**
 * POST /api/whatsapp/webhook
 * Recebe eventos da Evolution API (CONNECTION_UPDATE, QRCODE_UPDATED).
 */
whatsappNegocioRouter.post(
  "/whatsapp/webhook",
  async (req: Request, res: Response) => {
    res.status(200).json({ ok: true }); // Responde rápido para a Evolution API

    const payload = req.body as Record<string, unknown>;
    const event = payload.event as string | undefined;
    const instancia = payload.instance as string | undefined;

    if (!instancia) return;

    if (event === "connection.update") {
      const data = payload.data as Record<string, unknown> | undefined;
      const state = data?.state as string | undefined;

      let novoStatus: string | null = null;
      if (state === "open") novoStatus = "conectado";
      else if (state === "connecting") novoStatus = "conectando";
      else if (state === "close") novoStatus = "desconectado";

      if (novoStatus) {
        await supabase
          .from("negocios")
          .update({ whatsapp_status: novoStatus })
          .eq("whatsapp_instancia", instancia);

        console.log(`[whatsapp] Instância ${instancia} → ${novoStatus}`);
      }
    }
  }
);
