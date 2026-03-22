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
  criarInstancia(instanceName: string, webhookUrl: string): Promise<void>;
  obterQRCode(instanceName: string): Promise<string | null>;
  obterStatus(instanceName: string): Promise<"conectado" | "conectando" | "desconectado">;
  deletarInstancia(instanceName: string): Promise<void>;
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

  async criarInstancia(instanceName: string, webhookUrl: string): Promise<void> {
    await axios.post(
      `${this.apiUrl}/instance/create`,
      {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: webhookUrl,
          byEvents: true,
          base64: false,
          events: ["QRCODE_UPDATED", "CONNECTION_UPDATE"],
        },
      },
      { headers: { "Content-Type": "application/json", apikey: this.apiToken } }
    );
  }

  async obterQRCode(instanceName: string): Promise<string | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/connect/${instanceName}`,
        { headers: { apikey: this.apiToken } }
      );
      return (response.data?.base64 as string) || null;
    } catch {
      return null;
    }
  }

  async obterStatus(instanceName: string): Promise<"conectado" | "conectando" | "desconectado"> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/connectionState/${instanceName}`,
        { headers: { apikey: this.apiToken } }
      );
      const state = response.data?.instance?.state as string | undefined;
      if (state === "open") return "conectado";
      if (state === "connecting") return "conectando";
      return "desconectado";
    } catch {
      return "desconectado";
    }
  }

  async deletarInstancia(instanceName: string): Promise<void> {
    await axios.delete(
      `${this.apiUrl}/instance/delete/${instanceName}`,
      { headers: { apikey: this.apiToken } }
    );
  }
}

export function obterEvolutionProvider(): EvolutionAPIProvider | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  if (!apiUrl || !apiToken) return null;
  return new EvolutionAPIProvider(apiUrl, apiToken);
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
