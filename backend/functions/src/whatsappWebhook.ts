import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import axios from "axios";
import { criarProvedorWhatsApp } from "./utils/whatsappAdapter";

// Definir segredos (serão lidos do Secret Manager em produção)
const whatsappApiUrl = defineSecret("WHATSAPP_API_URL");
const whatsappApiToken = defineSecret("WHATSAPP_API_TOKEN");
const webhookAuthToken = defineSecret("WEBHOOK_AUTH_TOKEN");
const typebotWebhookUrl = defineSecret("TYPEBOT_WEBHOOK_URL");

/**
 * Cloud Function: whatsappWebhook
 *
 * Recebe mensagens do provedor WhatsApp (Evolution API) e
 * encaminha para o Typebot para processamento do fluxo conversacional.
 *
 * Endpoint: POST /whatsappWebhook
 *
 * Headers:
 *   - Authorization: Bearer {WEBHOOK_AUTH_TOKEN} (opcional, para segurança)
 *
 * Fluxo:
 *   1. Validar token de autenticação (se configurado)
 *   2. Extrair dados da mensagem recebida
 *   3. Encaminhar para o Typebot
 *   4. Retornar 200 OK imediatamente
 */
export const whatsappWebhook = onRequest(
  {
    cors: true,
    region: "southamerica-east1",
    secrets: [whatsappApiUrl, whatsappApiToken, webhookAuthToken, typebotWebhookUrl],
  },
  async (req, res) => {
    try {
      // Apenas POST é permitido
      if (req.method !== "POST") {
        res.status(405).json({ erro: "Método não permitido. Use POST." });
        return;
      }

      // 1. Validar token de autenticação do webhook (se configurado)
      const tokenSecreto = webhookAuthToken.value();
      if (tokenSecreto) {
        const authHeader = req.headers.authorization;
        const tokenRecebido = authHeader?.replace("Bearer ", "");

        if (tokenRecebido !== tokenSecreto) {
          console.warn("Tentativa de acesso ao webhook com token inválido.");
          res.status(401).json({ erro: "Token de autenticação inválido." });
          return;
        }
      }

      // 2. Criar instância do provedor WhatsApp e extrair mensagem
      const provedor = criarProvedorWhatsApp(
        "evolution",
        whatsappApiUrl.value(),
        whatsappApiToken.value()
      );

      const mensagem = provedor.parseWebhook(req.body);

      // Se não for uma mensagem válida (ex: evento de status), ignorar
      if (!mensagem) {
        console.log("Evento recebido não é uma mensagem de texto. Ignorando.");
        res.status(200).json({ status: "ignorado" });
        return;
      }

      console.log(`Mensagem recebida de ${mensagem.de}: "${mensagem.texto}"`);

      // 3. Encaminhar para o Typebot via HTTP
      const typebotUrl = typebotWebhookUrl.value();
      if (typebotUrl) {
        try {
          await axios.post(typebotUrl, {
            message: mensagem.texto,
            sessionId: mensagem.de, // Usar número como ID de sessão
            metadata: {
              telefone: mensagem.de,
              timestamp: mensagem.timestamp,
            },
          }, {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 10000, // Timeout de 10 segundos
          });

          console.log(`Mensagem encaminhada ao Typebot para sessão ${mensagem.de}`);
        } catch (erroTypebot) {
          // Logar erro mas não falhar — a mensagem já foi recebida
          console.error("Erro ao encaminhar para Typebot:", erroTypebot);
        }
      } else {
        console.warn("TYPEBOT_WEBHOOK_URL não configurada. Mensagem não encaminhada.");
      }

      // 4. Retornar 200 OK imediatamente (resposta assíncrona via Typebot)
      res.status(200).json({
        status: "recebido",
        de: mensagem.de,
        timestamp: mensagem.timestamp,
      });
    } catch (erro) {
      console.error("Erro no webhook do WhatsApp:", erro);
      // Sempre retornar 200 para evitar reenvio de webhooks pelo provedor
      res.status(200).json({ status: "erro_interno" });
    }
  }
);
