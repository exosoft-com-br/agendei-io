import { Router, Request, Response } from "express";
import axios from "axios";
import { criarProvedorWhatsApp } from "../utils/whatsappAdapter";

export const webhookRouter = Router();

/**
 * POST /api/whatsapp/webhook
 *
 * Recebe mensagens do provedor WhatsApp e encaminha para o Typebot.
 */
webhookRouter.post("/whatsapp/webhook", async (req: Request, res: Response) => {
  try {
    // Validar token de autenticação (se configurado)
    const tokenSecreto = process.env.WEBHOOK_AUTH_TOKEN;
    if (tokenSecreto) {
      const authHeader = req.headers.authorization;
      const tokenRecebido = authHeader?.replace("Bearer ", "");
      if (tokenRecebido !== tokenSecreto) {
        console.warn("Tentativa de acesso ao webhook com token inválido.");
        res.status(401).json({ erro: "Token de autenticação inválido." });
        return;
      }
    }

    // Criar provedor WhatsApp e extrair mensagem
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiToken = process.env.WHATSAPP_API_TOKEN;
    const providerType = process.env.WHATSAPP_PROVIDER || "evolution";

    if (!apiUrl || !apiToken) {
      console.warn("WhatsApp não configurado. Webhook recebido mas ignorado.");
      res.status(200).json({ status: "whatsapp_nao_configurado" });
      return;
    }

    const provedor = criarProvedorWhatsApp(providerType, apiUrl, apiToken);
    const mensagem = provedor.parseWebhook(req.body);

    if (!mensagem) {
      res.status(200).json({ status: "ignorado" });
      return;
    }

    console.log(`Mensagem recebida de ${mensagem.de}: "${mensagem.texto}"`);

    // Encaminhar para Typebot
    const typebotUrl = process.env.TYPEBOT_WEBHOOK_URL;
    if (typebotUrl) {
      try {
        await axios.post(
          typebotUrl,
          {
            message: mensagem.texto,
            sessionId: mensagem.de,
            metadata: {
              telefone: mensagem.de,
              timestamp: mensagem.timestamp,
            },
          },
          { headers: { "Content-Type": "application/json" }, timeout: 10000 }
        );
        console.log(`Mensagem encaminhada ao Typebot para sessão ${mensagem.de}`);
      } catch (erroTypebot) {
        console.error("Erro ao encaminhar para Typebot:", erroTypebot);
      }
    }

    res.status(200).json({
      status: "recebido",
      de: mensagem.de,
      timestamp: mensagem.timestamp,
    });
  } catch (erro) {
    console.error("Erro no webhook do WhatsApp:", erro);
    res.status(200).json({ status: "erro_interno" });
  }
});
