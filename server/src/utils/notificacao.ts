import { criarProvedorWhatsApp, WhatsAppProvider } from "./whatsappAdapter";

function obterProvedor(instancia?: string): WhatsAppProvider | null {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const providerType = process.env.WHATSAPP_PROVIDER || "evolution";
  const instanceName = instancia || process.env.WHATSAPP_INSTANCE_NAME || "default";

  if (!apiUrl || !apiToken) return null;

  return criarProvedorWhatsApp(providerType, apiUrl, apiToken, instanceName);
}

// ─── Confirmação para o cliente ───────────────────────────────────────────────

export async function notificarConfirmacao(params: {
  telefone: string;
  protocolo: string;
  servico: string;
  prestador: string;
  nicho: string;
  dataFormatada: string;
  instancia?: string;
}): Promise<void> {
  const provedor = obterProvedor(params.instancia);
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

// ─── Notificação de novo agendamento para o prestador ─────────────────────────

export async function notificarPrestadorNovoAgendamento(params: {
  telefonePrestador: string;
  protocolo: string;
  clienteNome: string;
  servico: string;
  dataFormatada: string;
  instancia?: string;
}): Promise<void> {
  const provedor = obterProvedor(params.instancia);
  if (!provedor || !params.telefonePrestador) return;

  const mensagem =
    `📅 *Novo Agendamento Recebido!*\n\n` +
    `👤 Cliente: *${params.clienteNome}*\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 Data/Hora: *${params.dataFormatada}*\n` +
    `📋 Protocolo: ${params.protocolo}`;

  try {
    await provedor.sendMessage(params.telefonePrestador, mensagem);
  } catch (erro) {
    console.error("Falha ao enviar notificação ao prestador:", erro);
  }
}

// ─── Lembrete 24h para o cliente ──────────────────────────────────────────────

export async function notificarLembreteCliente(params: {
  telefone: string;
  protocolo: string;
  servico: string;
  prestador: string;
  nicho: string;
  dataFormatada: string;
  instancia?: string;
}): Promise<void> {
  const provedor = obterProvedor(params.instancia);
  if (!provedor) return;

  const mensagem =
    `⏰ *Lembrete de Agendamento*\n\n` +
    `Olá! Seu agendamento é *amanhã*:\n\n` +
    `🏢 ${params.nicho}\n` +
    `👤 Profissional: ${params.prestador}\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 ${params.dataFormatada}\n\n` +
    `📋 Protocolo: ${params.protocolo}\n\n` +
    `Para cancelar, envie: *cancelar ${params.protocolo}*`;

  try {
    await provedor.sendMessage(params.telefone, mensagem);
  } catch (erro) {
    console.error("Falha ao enviar lembrete ao cliente:", erro);
  }
}

// ─── Lembrete 24h para o prestador ────────────────────────────────────────────

export async function notificarLembretePrestador(params: {
  telefonePrestador: string;
  clienteNome: string;
  servico: string;
  dataFormatada: string;
  protocolo: string;
  instancia?: string;
}): Promise<void> {
  const provedor = obterProvedor(params.instancia);
  if (!provedor || !params.telefonePrestador) return;

  const mensagem =
    `⏰ *Lembrete de Agendamento*\n\n` +
    `Você tem um agendamento *amanhã*:\n\n` +
    `👤 Cliente: *${params.clienteNome}*\n` +
    `✂️ Serviço: ${params.servico}\n` +
    `📅 *${params.dataFormatada}*\n` +
    `📋 Protocolo: ${params.protocolo}`;

  try {
    await provedor.sendMessage(params.telefonePrestador, mensagem);
  } catch (erro) {
    console.error("Falha ao enviar lembrete ao prestador:", erro);
  }
}

// ─── Cancelamento para o cliente ──────────────────────────────────────────────

export async function notificarCancelamento(params: {
  telefone: string;
  protocolo: string;
  instancia?: string;
}): Promise<void> {
  const provedor = obterProvedor(params.instancia);
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
