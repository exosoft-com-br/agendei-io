/**
 * Script para popular o Firestore Emulator com dados de teste.
 *
 * Uso: node seed.js
 * (Requer que o emulador esteja rodando na porta 8080)
 */

const admin = require("firebase-admin");

// Conectar ao emulador do Firestore
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({ projectId: "curso-fb-51cc3" });
const db = admin.firestore();

async function seed() {
  console.log("🌱 Populando Firestore com dados de teste...\n");

  // ============================================================
  // 1. NICHOS
  // ============================================================
  console.log("📦 Criando nichos...");

  await db.collection("nichos").doc("barbearia").set({
    id: "barbearia",
    nomePublico: "Barbearia do João",
    tipoCliente: "cliente",
    saudacaoInicial: "✂️ Olá! Bem-vindo à Barbearia do João! Vamos agendar seu horário?",
    textoConfirmacao: "✅ Agendamento confirmado! Seu protocolo é {protocolo}. Te esperamos em {dataHora}!",
    termos: { servico: "serviço", prestador: "barbeiro" },
    ativo: true,
  });

  await db.collection("nichos").doc("clinica").set({
    id: "clinica",
    nomePublico: "Clínica Saúde Total",
    tipoCliente: "paciente",
    saudacaoInicial: "🏥 Olá! Bem-vindo à Clínica Saúde Total! Como posso te ajudar hoje?",
    textoConfirmacao: "✅ Consulta confirmada! Protocolo: {protocolo}. Até {dataHora}!",
    termos: { servico: "consulta", prestador: "médico" },
    ativo: true,
  });

  console.log("  ✅ 2 nichos criados (barbearia, clinica)");

  // ============================================================
  // 2. PRESTADORES
  // ============================================================
  console.log("📦 Criando prestadores...");

  await db.collection("prestadores").doc("barbeiro-pedro").set({
    id: "barbeiro-pedro",
    nichoId: "barbearia",
    nome: "Barbeiro Pedro",
    categoria: "Corte Masculino",
    ativo: true,
    horarioAtendimento: {
      inicio: "09:00",
      fim: "19:00",
      diasSemana: [1, 2, 3, 4, 5, 6], // Seg a Sáb
    },
    whatsappNumero: "5511999999001",
  });

  await db.collection("prestadores").doc("barbeiro-lucas").set({
    id: "barbeiro-lucas",
    nichoId: "barbearia",
    nome: "Barbeiro Lucas",
    categoria: "Barba e Cabelo",
    ativo: true,
    horarioAtendimento: {
      inicio: "10:00",
      fim: "20:00",
      diasSemana: [1, 2, 3, 4, 5, 6],
    },
    whatsappNumero: "5511999999002",
  });

  await db.collection("prestadores").doc("dr-joao-silva").set({
    id: "dr-joao-silva",
    nichoId: "clinica",
    nome: "Dr. João Silva",
    categoria: "Clínico Geral",
    ativo: true,
    horarioAtendimento: {
      inicio: "08:00",
      fim: "17:00",
      diasSemana: [1, 2, 3, 4, 5], // Seg a Sex
    },
    whatsappNumero: "5511999998001",
  });

  console.log("  ✅ 3 prestadores criados");

  // ============================================================
  // 3. SERVIÇOS
  // ============================================================
  console.log("📦 Criando serviços...");

  await db.collection("servicos").doc("corte-simples").set({
    id: "corte-simples",
    prestadorId: "barbeiro-pedro",
    nichoId: "barbearia",
    nome: "Corte Simples",
    duracaoMinutos: 30,
    preco: 35.0,
    ativo: true,
  });

  await db.collection("servicos").doc("corte-barba").set({
    id: "corte-barba",
    prestadorId: "barbeiro-pedro",
    nichoId: "barbearia",
    nome: "Corte + Barba",
    duracaoMinutos: 45,
    preco: 55.0,
    ativo: true,
  });

  await db.collection("servicos").doc("barba-completa").set({
    id: "barba-completa",
    prestadorId: "barbeiro-lucas",
    nichoId: "barbearia",
    nome: "Barba Completa",
    duracaoMinutos: 30,
    preco: 30.0,
    ativo: true,
  });

  await db.collection("servicos").doc("consulta-geral").set({
    id: "consulta-geral",
    prestadorId: "dr-joao-silva",
    nichoId: "clinica",
    nome: "Consulta Geral",
    duracaoMinutos: 30,
    preco: 150.0,
    ativo: true,
  });

  console.log("  ✅ 4 serviços criados");

  // ============================================================
  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("   Acesse http://127.0.0.1:4000/firestore para visualizar os dados.\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Erro ao popular Firestore:", err);
  process.exit(1);
});
