import { criarProvedorWhatsApp, WhatsAppProvider } from "./whatsappAdapter";

/**
 * Tenta criar um provedor WhatsApp a partir de variáveis de ambiente.
 * Retorna null se não estiver configurado (permitindo funcionar sem WhatsApp).
 */
function obterProvedor(): WhatsAppProvider | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const providerType = process.env.WHATSAPP_PROVIDER || "evolution";
  const instanceName = process.env.WHATSAPP_INSTANCE_NAME || "default";

  if (!apiUrl || !apiToken) {
    console.warn(
      "⚠️  WhatsApp não configurado (WHATSAPP_API_URL / WHATSAPP_API_TOKEN ausentes). " +
      "Notificações WhatsApp desabilitadas."
    );
    return null;
  }

  return criarProvedorWhatsApp(providerType, apiUrl, apiToken, instanceName);
}

/**
 * Envia notificação de confirmação de agendamento via WhatsApp.
 * Falha silenciosamente se o WhatsApp não estiver configurado.
 */
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
    console.log(`✅ Notificação de confirmação enviada para ${params.telefone}`);
  } catch (erro) {
    console.error(`❌ Falha ao enviar notificação de confirmação:`, erro);
    // Não lança erro — agendamento já foi criado
  }
}

/**
 * Envia notificação de cancelamento via WhatsApp.
 * Falha silenciosamente se o WhatsApp não estiver configurado.
 */
export async function notificarCancelamento(params: {
  telefone: string;
  protocolo: string;
}): Promise<void> {
  const provedor = obterProvedor();
  if (!provedor) return;

  const mensagem =
    `❌ *Agendamento Cancelado*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n\n` +
    `Seu agendamento foi cancelado com sucesso.\n` +
    `Para fazer um novo agendamento, envie *oi* a qualquer momento.`;

  try {
    await provedor.sendMessage(params.telefone, mensagem);
    console.log(`✅ Notificação de cancelamento enviada para ${params.telefone}`);
  } catch (erro) {
    console.error(`❌ Falha ao enviar notificação de cancelamento:`, erro);
  }
}

/**
 * Envia lembrete de agendamento via WhatsApp (para uso com Cloud Scheduler).
 * Falha silenciosamente se o WhatsApp não estiver configurado.
 */
export async function notificarLembrete(params: {
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
    `⏰ *Lembrete de Agendamento*\n\n` +
    `📋 Protocolo: *${params.protocolo}*\n` +
    `🏢 ${params.nicho}\n` +
    `👤 Profissional: ${params.prestador}\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 ${params.dataFormatada}\n\n` +
    `Te esperamos! Para cancelar, envie: *cancelar ${params.protocolo}*`;

  try {
    await provedor.sendMessage(params.telefone, mensagem);
    console.log(`✅ Lembrete enviado para ${params.telefone}`);
  } catch (erro) {
    console.error(`❌ Falha ao enviar lembrete:`, erro);
  }
}
