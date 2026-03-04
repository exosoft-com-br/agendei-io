import { criarProvedorWhatsApp, WhatsAppProvider } from "./whatsappAdapter";

function obterProvedor(): WhatsAppProvider | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const providerType = process.env.WHATSAPP_PROVIDER || "evolution";
  const instanceName = process.env.WHATSAPP_INSTANCE_NAME || "default";

  if (!apiUrl || !apiToken) return null;

  return criarProvedorWhatsApp(providerType, apiUrl, apiToken, instanceName);
}

export async function notificarConfirmacao(params: {
  telefone: string;
  protocolo: string;
  servico: string;
  prestador: string;
  nicho: string;
  dataFormatada: string;
}): Promise<void> {
  const provedor = obterProvedor();
  if (!provedor) return;

  const mensagem =
    `✅ *Agendamento Confirmado!*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n` +
    `🏢 ${params.nicho}\n` +
    `👤 Profissional: ${params.prestador}\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 ${params.dataFormatada}\n\n` +
    `Para cancelar, envie: *cancelar ${params.protocolo}*`;

  try {
    await provedor.sendMessage(params.telefone, mensagem);
  } catch (erro) {
    console.error("Falha ao enviar notificação de confirmação:", erro);
  }
}

export async function notificarCancelamento(params: {
  telefone: string;
  protocolo: string;
}): Promise<void> {
  const provedor = obterProvedor();
  if (!provedor) return;

  const mensagem =
    `❌ *Agendamento Cancelado*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n\n` +
    `Seu agendamento foi cancelado com sucesso.`;

  try {
    await provedor.sendMessage(params.telefone, mensagem);
  } catch (erro) {
    console.error("Falha ao enviar notificação de cancelamento:", erro);
  }
}
