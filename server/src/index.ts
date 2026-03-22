import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

// Carregar variáveis de ambiente ANTES de qualquer import que use process.env
dotenv.config();

import { availabilityRouter } from "./routes/availability";
import { bookingRouter } from "./routes/booking";
import { nichoConfigRouter } from "./routes/nichoConfig";
import { webhookRouter } from "./routes/webhook";
import { profileRouter } from "./routes/profile";
import { negocioRouter } from "./routes/negocio";
import { calendarioRouter } from "./routes/calendario";
import { authRouter } from "./routes/auth";

import { servicoRouter } from "./routes/servico";
import { googleRouter } from "./routes/google";
import { whatsappNegocioRouter } from "./routes/whatsappNegocio";
import { pagamentoRouter } from "./routes/pagamento";
import { disponibilidadesRouter } from "./routes/disponibilidades";
import { baileysManager } from "./utils/baileysManager";
import { iniciarJobLembretes } from "./utils/lembretes";

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SEGURANÇA: CORS — restringir origens permitidas
// ============================================================
const isDev = process.env.NODE_ENV !== "production";

const allowedOrigins: string[] = [
  "https://agendei.io",                        // Domínio principal
  "https://www.agendei.io",                    // www
  "https://app.agendei.io.exosoft.com.br",    // CNAME legado
];

// Dev local — apenas em ambiente de desenvolvimento
if (isDev) {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
  );
}

// Adicionar origens extras via env (ALLOWED_ORIGINS=url1,url2)
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(",").forEach((o) => allowedOrigins.push(o.trim()));
}

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight por 24h
  })
);

// ============================================================
// SEGURANÇA: Helmet — headers HTTP de proteção
// ============================================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ============================================================
// SEGURANÇA: Rate Limiting — proteção contra abuso/DDoS
// ============================================================

// Limiter geral: 500 requests por IP a cada 15 min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas requisições. Tente novamente em alguns minutos." },
});

// Limiter para booking: 10 agendamentos por IP a cada 15 min
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Limite de agendamentos atingido. Tente novamente em alguns minutos." },
});

// Limiter para webhook: 200 requests por IP a cada 1 min
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Rate limit excedido." },
});

// Limiter para auth: 30 tentativas por IP a cada 5 min
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: "Muitas tentativas de login. Tente em 5 minutos." },
});

// Trust proxy (Render/CloudFlare) para identificar IP real de cada usuário
app.set('trust proxy', 1);

app.use(generalLimiter);

// ============================================================
// SEGURANÇA: Body parser com limite de tamanho
// ============================================================
app.use(express.json({ limit: "64kb" })); // 64kb para suportar certificados PEM no config PIX

// ============================================================
// SEGURANÇA: Desabilitar header X-Powered-By
// ============================================================
app.disable("x-powered-by");

// ============================================================
// Rotas com limiters específicos
// ============================================================
app.use("/api/booking", bookingLimiter);
app.use("/api/whatsapp", webhookLimiter);
app.use("/api/auth", authLimiter);

app.use("/api", authRouter);
app.use("/api", availabilityRouter);
app.use("/api", bookingRouter);
app.use("/api", nichoConfigRouter);
app.use("/api", webhookRouter);
app.use("/api", profileRouter);
app.use("/api", negocioRouter);
app.use("/api", calendarioRouter);
app.use("/api", servicoRouter);

// Rotas Google Calendar
app.use("/api/google", googleRouter);
app.use("/api", whatsappNegocioRouter);
app.use("/api", pagamentoRouter);
app.use("/api", disponibilidadesRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rota raiz (sem expor detalhes internos em produção)
app.get("/", (_req, res) => {
  res.json({
    nome: "Plataforma de Agendamentos",
    versao: "2.1.0",
    status: "online",
  });
});

// ============================================================
// SEGURANÇA: Tratar rotas não encontradas
// ============================================================
app.use((_req, res) => {
  res.status(404).json({ erro: "Endpoint não encontrado." });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔒 CORS restrito a: ${allowedOrigins.join(", ")}`);
  iniciarJobLembretes();
  // Restaura sessões WhatsApp que estavam conectadas antes do restart
  baileysManager.reconectarSessoesPersistidas().catch(console.error);
});

export default app;
