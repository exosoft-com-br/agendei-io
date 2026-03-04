import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function seed() {
  console.log("🌱 Inserindo dados de teste no Supabase...\n");

  // 1. Inserir nichos
  const { error: e1 } = await supabase.from("nichos").upsert([
    {
      id: "barbearia",
      nome_publico: "Barbearia do João",
      tipo_cliente: "cliente",
      saudacao_inicial:
        "✂️ Olá! Bem-vindo à Barbearia do João! Vou te ajudar a agendar seu horário. Como posso te chamar?",
      texto_confirmacao:
        "Agendamento confirmado! Seu protocolo é {protocolo}. Te esperamos em {dataHora}!",
      termos: { servico: "serviço", prestador: "barbeiro" },
      ativo: true,
    },
    {
      id: "clinica",
      nome_publico: "Clínica Saúde Total",
      tipo_cliente: "paciente",
      saudacao_inicial:
        "🏥 Olá! Bem-vindo à Clínica Saúde Total. Vou te ajudar a agendar sua consulta. Qual seu nome?",
      texto_confirmacao:
        "Consulta agendada! Protocolo: {protocolo}. Data: {dataHora}. Chegue 15 min antes.",
      termos: { servico: "consulta", prestador: "médico" },
      ativo: true,
    },
  ]);

  if (e1) {
    console.error("❌ Erro ao inserir nichos:", e1.message);
    return;
  }
  console.log("✅ Nichos inseridos");

  // 2. Inserir prestadores
  const { error: e2 } = await supabase.from("prestadores").upsert([
    {
      id: "barbeiro-pedro",
      nicho_id: "barbearia",
      nome: "Barbeiro Pedro",
      categoria: "Corte Masculino",
      horario_inicio: "09:00",
      horario_fim: "19:00",
      dias_semana: [1, 2, 3, 4, 5, 6],
      ativo: true,
    },
    {
      id: "dra-maria",
      nicho_id: "clinica",
      nome: "Dra. Maria Santos",
      categoria: "Clínico Geral",
      horario_inicio: "08:00",
      horario_fim: "17:00",
      dias_semana: [1, 2, 3, 4, 5],
      ativo: true,
    },
  ]);

  if (e2) {
    console.error("❌ Erro ao inserir prestadores:", e2.message);
    return;
  }
  console.log("✅ Prestadores inseridos");

  // 3. Inserir serviços
  const { error: e3 } = await supabase.from("servicos").upsert([
    {
      id: "corte-simples",
      nicho_id: "barbearia",
      prestador_id: "barbeiro-pedro",
      nome: "Corte Simples",
      duracao_minutos: 30,
      preco: 35.0,
      ativo: true,
    },
    {
      id: "corte-barba",
      nicho_id: "barbearia",
      prestador_id: "barbeiro-pedro",
      nome: "Corte + Barba",
      duracao_minutos: 45,
      preco: 55.0,
      ativo: true,
    },
    {
      id: "consulta-geral",
      nicho_id: "clinica",
      prestador_id: "dra-maria",
      nome: "Consulta Geral",
      duracao_minutos: 30,
      preco: 150.0,
      ativo: true,
    },
  ]);

  if (e3) {
    console.error("❌ Erro ao inserir serviços:", e3.message);
    return;
  }
  console.log("✅ Serviços inseridos");

  console.log("\n🎉 Seed concluído com sucesso!");
}

seed().catch(console.error);
