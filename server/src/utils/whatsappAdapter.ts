import axios from "axios";

export interface WhatsAppMessage {
  de: string;
  para: string;
  texto: string;
  timestamp: number;
}

export interface WhatsAppProvider {
  parseWebhook(payload: unknown): WhatsAppMessage | null;
  sendMessage(para: string, texto: string): Promise<void>;
}

export class EvolutionAPIProvider implements WhatsAppProvider {
  private apiUrl: string;
  private apiToken: string;
  private instanceName: string;

  constructor(apiUrl: string, apiToken: string, instanceName = "default") {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.apiToken = apiToken;
    this.instanceName = instanceName;
  }

  parseWebhook(payload: unknown): WhatsAppMessage | null {
    try {
      const data = payload as Record<string, unknown>;
      const eventData = data.data as Record<string, unknown> | undefined;
      if (!eventData) return null;

      const key = eventData.key as Record<string, unknown> | undefined;
      const message = eventData.message as Record<string, unknown> | undefined;
      if (!key || !message) return null;
      if (key.fromMe) return null;

      const remoteJid = key.remoteJid as string;
      const texto =
        (message.conversation as string) ||
        ((message.extendedTextMessage as Record<string, unknown>)?.text as string) ||
        "";

      if (!remoteJid || !texto) return null;

      const numero = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

      return {
        de: numero,
        para: "",
        texto: texto.trim(),
        timestamp: (eventData.messageTimestamp as number) || Math.floor(Date.now() / 1000),
      };
    } catch {
      return null;
    }
  }

  async sendMessage(para: string, texto: string): Promise<void> {
    await axios.post(
      `${this.apiUrl}/message/sendText/${this.instanceName}`,
      { number: para, text: texto },
      { headers: { "Content-Type": "application/json", apikey: this.apiToken } }
    );
  }
}

export function criarProvedorWhatsApp(
  provider: string,
  apiUrl: string,
  apiToken: string,
  instanceName = "default"
): WhatsAppProvider {
  switch (provider.toLowerCase()) {
    case "evolution":
      return new EvolutionAPIProvider(apiUrl, apiToken, instanceName);
    default:
      throw new Error(`Provedor não suportado: ${provider}`);
  }
}
