import cron from "node-cron";
import { supabase } from "../supabaseClient";
import { notificarLembreteCliente, notificarLembretePrestador } from "./notificacao";

/**
 * Busca agendamentos que estão entre 23h e 25h a partir de agora,
 * com status "confirmado" e lembrete ainda não enviado,
 * envia WhatsApp para cliente e prestador, e marca lembrete_enviado = true.
 */
async function enviarLembretes(): Promise<void> {
  const agora = new Date();
  const inicio = new Date(agora.getTime() + 23 * 60 * 60 * 1000); // +23h
  const fim = new Date(agora.getTime() + 25 * 60 * 60 * 1000);    // +25h

  const { data: agendamentos, error } = await supabase
    .from("agendamentos")
    .select(`
      id,
      protocolo,
      cliente_nome,
      cliente_telefone,
      data_hora,
      nicho_id,
      prestador_id,
      servico_id,
      nichos (nome_publico),
      prestadores (nome, whatsapp_numero),
      servicos (nome)
    `)
    .eq("status", "confirmado")
    .eq("lembrete_enviado", false)
    .gte("data_hora", inicio.toISOString())
    .lte("data_hora", fim.toISOString());

  if (error) {
    console.error("[lembretes] Erro ao buscar agendamentos:", error);
    return;
  }

  if (!agendamentos || agendamentos.length === 0) return;

  console.log(`[lembretes] Enviando ${agendamentos.length} lembrete(s)...`);

  for (const ag of agendamentos) {
    const dataHoraObj = new Date(ag.data_hora);
    const dataFormatada = dataHoraObj.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const nicho = (ag.nichos as { nome_publico: string } | null)?.nome_publico ?? ag.nicho_id;
    const prestador = ag.prestadores as { nome: string; whatsapp_numero: string | null } | null;
    const servico = (ag.servicos as { nome: string } | null)?.nome ?? ag.servico_id;

    // Lembrete para o cliente
    await notificarLembreteCliente({
      telefone: ag.cliente_telefone,
      protocolo: ag.protocolo,
      servico,
      prestador: prestador?.nome ?? "",
      nicho,
      dataFormatada,
    });

    // Lembrete para o prestador (se tiver WhatsApp cadastrado)
    if (prestador?.whatsapp_numero) {
      await notificarLembretePrestador({
        telefonePrestador: prestador.whatsapp_numero,
        clienteNome: ag.cliente_nome,
        servico,
        dataFormatada,
        protocolo: ag.protocolo,
      });
    }

    // Marcar lembrete como enviado
    await supabase
      .from("agendamentos")
      .update({ lembrete_enviado: true })
      .eq("id", ag.id);
  }

  console.log("[lembretes] Concluído.");
}

/**
 * Inicia o cron job de lembretes.
 * Roda a cada 30 minutos para garantir janela de 2h de tolerância.
 */
export function iniciarJobLembretes(): void {
  // Executa imediatamente ao iniciar (para não esperar 30 min no primeiro deploy)
  enviarLembretes().catch((e) => console.error("[lembretes] Erro na execução inicial:", e));

  // Cron: a cada 30 minutos
  cron.schedule("*/30 * * * *", () => {
    enviarLembretes().catch((e) => console.error("[lembretes] Erro no cron:", e));
  });

  console.log("⏰ Job de lembretes iniciado (a cada 30 minutos)");
}
