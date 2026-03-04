import { supabase } from "../supabaseClient";

/**
 * Gera um evento iCal (RFC 5545) para um agendamento.
 * Pode ser usado como anexo .ics em emails ou para sincronizar calendários.
 */
export function gerarEventoICal(params: {
  protocolo: string;
  servicoNome: string;
  prestadorNome: string;
  negocioNome: string;
  clienteNome: string;
  clienteTelefone: string;
  dataHoraInicio: Date;
  duracaoMinutos: number;
  endereco?: string;
}): string {
  const {
    protocolo,
    servicoNome,
    prestadorNome,
    negocioNome,
    clienteNome,
    clienteTelefone,
    dataHoraInicio,
    duracaoMinutos,
    endereco,
  } = params;

  const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60 * 1000);

  const formatICalDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const uid = `${protocolo}@plataforma-agendamentos`;
  const now = formatICalDate(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plataforma Agendamentos//BR",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICalDate(dataHoraInicio)}`,
    `DTEND:${formatICalDate(dataFim)}`,
    `SUMMARY:${servicoNome} - ${clienteNome}`,
    `DESCRIPTION:Agendamento ${protocolo}\\nServiço: ${servicoNome}\\nProfissional: ${prestadorNome}\\nCliente: ${clienteNome}\\nTelefone: ${clienteTelefone}`,
    `ORGANIZER;CN=${negocioNome}:MAILTO:noreply@agendamentos.app`,
    endereco ? `LOCATION:${endereco}` : "",
    "STATUS:CONFIRMED",
    `BEGIN:VALARM`,
    `TRIGGER:-PT1H`,
    `ACTION:DISPLAY`,
    `DESCRIPTION:Lembrete: ${servicoNome} em 1 hora`,
    `END:VALARM`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.filter(Boolean).join("\r\n");
}

/**
 * Gera evento iCal de cancelamento.
 */
export function gerarCancelamentoICal(params: {
  protocolo: string;
  servicoNome: string;
  clienteNome: string;
  dataHoraInicio: Date;
  duracaoMinutos: number;
}): string {
  const { protocolo, servicoNome, clienteNome, dataHoraInicio, duracaoMinutos } = params;
  const dataFim = new Date(dataHoraInicio.getTime() + duracaoMinutos * 60 * 1000);
  const formatICalDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = `${protocolo}@plataforma-agendamentos`;
  const now = formatICalDate(new Date());

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Plataforma Agendamentos//BR",
    "METHOD:CANCEL",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatICalDate(dataHoraInicio)}`,
    `DTEND:${formatICalDate(dataFim)}`,
    `SUMMARY:[CANCELADO] ${servicoNome} - ${clienteNome}`,
    "STATUS:CANCELLED",
    "SEQUENCE:1",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Busca integrações de email ativas para um prestador e envia notificação.
 * Na versão atual, gera o .ics — o envio real depende de um provedor SMTP configurado.
 */
export async function sincronizarCalendario(params: {
  prestadorId: string;
  protocolo: string;
  servicoNome: string;
  prestadorNome: string;
  negocioNome: string;
  clienteNome: string;
  clienteTelefone: string;
  dataHoraInicio: Date;
  duracaoMinutos: number;
  endereco?: string;
  tipo: "confirmacao" | "cancelamento";
}): Promise<void> {
  try {
    // Buscar integrações ativas do prestador
    const { data: integracoes } = await supabase
      .from("integracoes_email")
      .select("*")
      .eq("prestador_id", params.prestadorId)
      .eq("status", "ativo");

    if (!integracoes || integracoes.length === 0) return;

    for (const integ of integracoes) {
      // Verificar se deve enviar este tipo de notificação
      if (params.tipo === "confirmacao" && !integ.enviar_confirmacao) continue;
      if (params.tipo === "cancelamento" && !integ.enviar_cancelamento) continue;

      let icsContent: string;
      if (params.tipo === "cancelamento") {
        icsContent = gerarCancelamentoICal({
          protocolo: params.protocolo,
          servicoNome: params.servicoNome,
          clienteNome: params.clienteNome,
          dataHoraInicio: params.dataHoraInicio,
          duracaoMinutos: params.duracaoMinutos,
        });
      } else {
        icsContent = gerarEventoICal({
          protocolo: params.protocolo,
          servicoNome: params.servicoNome,
          prestadorNome: params.prestadorNome,
          negocioNome: params.negocioNome,
          clienteNome: params.clienteNome,
          clienteTelefone: params.clienteTelefone,
          dataHoraInicio: params.dataHoraInicio,
          duracaoMinutos: params.duracaoMinutos,
          endereco: params.endereco,
        });
      }

      // Envio SMTP (quando configurado)
      if (process.env.SMTP_HOST) {
        await enviarEmailComICS({
          para: integ.email_calendario,
          assunto:
            params.tipo === "confirmacao"
              ? `Novo agendamento: ${params.servicoNome} - ${params.clienteNome}`
              : `Cancelamento: ${params.servicoNome} - ${params.clienteNome}`,
          corpo:
            params.tipo === "confirmacao"
              ? `Novo agendamento ${params.protocolo} agendado com ${params.prestadorNome}.`
              : `O agendamento ${params.protocolo} foi cancelado.`,
          icsContent,
          protocolo: params.protocolo,
        });
      }

      // Atualizar último sync
      await supabase
        .from("integracoes_email")
        .update({ ultimo_sync: new Date().toISOString() })
        .eq("id", integ.id);
    }
  } catch (erro) {
    console.error("Erro ao sincronizar calendário:", erro);
  }
}

/**
 * Envia email com anexo .ics via SMTP.
 * Requer: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS no .env
 */
async function enviarEmailComICS(params: {
  para: string;
  assunto: string;
  corpo: string;
  icsContent: string;
  protocolo: string;
}): Promise<void> {
  try {
    // Usar nodemailer se disponível (dependência opcional)
    const nodemailer = await import("nodemailer").catch(() => null);
    if (!nodemailer) {
      console.warn("⚠️ nodemailer não instalado. Email não enviado.");
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: (process.env.SMTP_PORT || "587") === "465",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: params.para,
      subject: params.assunto,
      text: params.corpo,
      icalEvent: {
        method: "REQUEST",
        content: params.icsContent,
      },
    });

    console.log(`📧 Email enviado para ${params.para} (${params.protocolo})`);
  } catch (erro) {
    console.error(`Erro ao enviar email para ${params.para}:`, erro);
  }
}
