import cron from "node-cron";
import { supabase } from "../supabaseClient";
import { notificarLembreteCliente, notificarLembretePrestador } from "./notificacao";

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

  // Busca instâncias WhatsApp dos negócios em batch
  const nichoIds = [...new Set(agendamentos.map((a) => a.nicho_id))];
  const { data: negocios } = await supabase
    .from("negocios")
    .select("nicho_id, whatsapp_instancia, whatsapp_status")
    .in("nicho_id", nichoIds)
    .eq("ativo", true);

  const instanciaMap: Record<string, string | undefined> = {};
  for (const n of negocios || []) {
    instanciaMap[n.nicho_id] =
      n.whatsapp_status === "conectado" ? (n.whatsapp_instancia ?? undefined) : undefined;
  }

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

    const nicho = (ag.nichos as unknown as { nome_publico: string } | null)?.nome_publico ?? ag.nicho_id;
    const prestador = ag.prestadores as unknown as { nome: string; whatsapp_numero: string | null } | null;
    const servico = (ag.servicos as unknown as { nome: string } | null)?.nome ?? "";
    const instancia = instanciaMap[ag.nicho_id];

    await notificarLembreteCliente({
      telefone: ag.cliente_telefone,
      protocolo: ag.protocolo,
      servico,
      prestador: prestador?.nome ?? "",
      nicho,
      dataFormatada,
      instancia,
    });

    if (prestador?.whatsapp_numero) {
      await notificarLembretePrestador({
        telefonePrestador: prestador.whatsapp_numero,
        clienteNome: ag.cliente_nome,
        servico,
        dataFormatada,
        protocolo: ag.protocolo,
        instancia,
      });
    }

    await supabase
      .from("agendamentos")
      .update({ lembrete_enviado: true })
      .eq("id", ag.id);
  }

  console.log("[lembretes] Concluído.");
}

export function iniciarJobLembretes(): void {
  enviarLembretes().catch((e) => console.error("[lembretes] Erro na execução inicial:", e));

  cron.schedule("*/30 * * * *", () => {
    enviarLembretes().catch((e) => console.error("[lembretes] Erro no cron:", e));
  });

  console.log("⏰ Job de lembretes iniciado (a cada 30 minutos)");
}
