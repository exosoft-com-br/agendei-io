import axios from "axios";

/**
 * Mensagem padronizada recebida/enviada via WhatsApp.
 * Independente do provedor usado (Evolution API, Meta, Z-API, etc.)
 */
export interface WhatsAppMessage {
  /** Número do remetente no formato "5511999999999" */
  de: string;

  /** Número do destinatário no formato "5511999999999" */
  para: string;

  /** Conteúdo de texto da mensagem */
  texto: string;

  /** Timestamp Unix da mensagem */
  timestamp: number;
}

/**
 * Interface genérica para provedores de WhatsApp.
 * Permite trocar de provedor sem alterar o restante do código.
 */
export interface WhatsAppProvider {
  /** Extrai uma mensagem padronizada do payload bruto do webhook */
  parseWebhook(payload: unknown): WhatsAppMessage | null;

  /** Envia uma mensagem de texto para um número */
  sendMessage(para: string, texto: string): Promise<void>;
}

// ============================================================
// Implementação: Evolution API (PoC)
// ============================================================

/**
 * Provedor de WhatsApp usando Evolution API (open source).
 * Documentação: https://doc.evolution-api.com/
 */
export class EvolutionAPIProvider implements WhatsAppProvider {
  private apiUrl: string;
  private apiToken: string;
  private instanceName: string;

  /**
   * @param apiUrl - URL base da Evolution API (ex: "https://sua-api.com")
   * @param apiToken - Token de autenticação da API
   * @param instanceName - Nome da instância WhatsApp na Evolution API
   */
  constructor(apiUrl: string, apiToken: string, instanceName = "default") {
    this.apiUrl = apiUrl.replace(/\/$/, ""); // Remover barra final se houver
    this.apiToken = apiToken;
    this.instanceName = instanceName;
  }

  /**
   * Converte o payload do webhook da Evolution API para o formato padronizado.
   *
   * @param payload - Payload bruto recebido do webhook
   * @returns Mensagem padronizada ou null se não for uma mensagem de texto
   */
  parseWebhook(payload: unknown): WhatsAppMessage | null {
    try {
      const data = payload as Record<string, unknown>;

      // Evolution API envia diferentes tipos de evento
      // Apenas processar mensagens de texto recebidas
      const eventData = data.data as Record<string, unknown> | undefined;
      if (!eventData) return null;

      const key = eventData.key as Record<string, unknown> | undefined;
      const message = eventData.message as Record<string, unknown> | undefined;

      if (!key || !message) return null;

      // Ignorar mensagens enviadas por nós mesmos
      const fromMe = key.fromMe as boolean;
      if (fromMe) return null;

      const remoteJid = key.remoteJid as string;
      const texto = (message.conversation as string) ||
        (message.extendedTextMessage as Record<string, unknown>)?.text as string || "";

      if (!remoteJid || !texto) return null;

      // Extrair número (remover @s.whatsapp.net)
      const numero = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

      return {
        de: numero,
        para: "", // Será preenchido pelo processamento
        texto: texto.trim(),
        timestamp: (eventData.messageTimestamp as number) || Math.floor(Date.now() / 1000),
      };
    } catch (erro) {
      console.error("Erro ao processar webhook da Evolution API:", erro);
      return null;
    }
  }

  /**
   * Envia uma mensagem de texto via Evolution API.
   *
   * @param para - Número do destinatário (ex: "5511999999999")
   * @param texto - Texto da mensagem
   */
  async sendMessage(para: string, texto: string): Promise<void> {
    try {
      await axios.post(
        `${this.apiUrl}/message/sendText/${this.instanceName}`,
        {
          number: para,
          text: texto,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "apikey": this.apiToken,
          },
        }
      );
      console.log(`Mensagem enviada com sucesso para ${para}`);
    } catch (erro) {
      console.error(`Erro ao enviar mensagem para ${para}:`, erro);
      throw new Error(`Falha ao enviar mensagem via Evolution API: ${erro}`);
    }
  }
}

// ============================================================
// Stub: Meta Business API (migração futura)
// ============================================================

/**
 * Stub do provedor Meta Business API.
 * Preparado para migração futura — não implementado ainda.
 */
export class MetaBusinessAPIProvider implements WhatsAppProvider {
  parseWebhook(_payload: unknown): WhatsAppMessage | null {
    // TODO: Implementar parsing do webhook da Meta Business API
    throw new Error("MetaBusinessAPIProvider ainda não implementado. Use EvolutionAPIProvider.");
  }

  async sendMessage(_para: string, _texto: string): Promise<void> {
    // TODO: Implementar envio via Meta Business API
    throw new Error("MetaBusinessAPIProvider ainda não implementado. Use EvolutionAPIProvider.");
  }
}

// ============================================================
// Factory: Instanciar o provedor correto
// ============================================================

/**
 * Cria uma instância do provedor de WhatsApp baseado na configuração.
 *
 * @param provider - Nome do provedor ("evolution" ou "meta")
 * @param apiUrl - URL da API
 * @param apiToken - Token de autenticação
 * @param instanceName - Nome da instância (apenas Evolution API)
 * @returns Instância do provedor configurado
 */
export function criarProvedorWhatsApp(
  provider: string,
  apiUrl: string,
  apiToken: string,
  instanceName = "default"
): WhatsAppProvider {
  switch (provider.toLowerCase()) {
    case "evolution":
      return new EvolutionAPIProvider(apiUrl, apiToken, instanceName);
    case "meta":
      return new MetaBusinessAPIProvider();
    default:
      throw new Error(`Provedor de WhatsApp não suportado: ${provider}. Use "evolution" ou "meta".`);
  }
}
