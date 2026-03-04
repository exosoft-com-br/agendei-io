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

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// SEGURANÇA: Helmet — headers HTTP de proteção
// ============================================================
app.use(helmet());

// ============================================================
// SEGURANÇA: CORS — restringir origens permitidas
// ============================================================
const allowedOrigins = [
  "https://exosoft-com-br.github.io",        // GitHub Pages (produção)
  "http://localhost:3000",                     // Dev local
  "http://localhost:5500",                     // Live Server (VS Code)
  "http://127.0.0.1:5500",
  "http://localhost:8080",
];

// Adicionar origens extras via env (ALLOWED_ORIGINS=url1,url2)
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(",").forEach((o) => allowedOrigins.push(o.trim()));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir requests sem origin (ex: curl, Postman, webhooks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      console.warn(`⚠️  CORS bloqueado: ${origin}`);
      callback(new Error("Não permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // Cache preflight por 24h
  })
);

// ============================================================
// SEGURANÇA: Rate Limiting — proteção contra abuso/DDoS
// ============================================================

// Limiter geral: 100 requests por IP a cada 15 min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

app.use(generalLimiter);

// ============================================================
// SEGURANÇA: Body parser com limite de tamanho
// ============================================================
app.use(express.json({ limit: "10kb" }));

// ============================================================
// SEGURANÇA: Desabilitar header X-Powered-By
// ============================================================
app.disable("x-powered-by");

// ============================================================
// Rotas com limiters específicos
// ============================================================
app.use("/api/booking", bookingLimiter);
app.use("/api/whatsapp", webhookLimiter);

app.use("/api", availabilityRouter);
app.use("/api", bookingRouter);
app.use("/api", nichoConfigRouter);
app.use("/api", webhookRouter);
app.use("/api", profileRouter);
app.use("/api", negocioRouter);
app.use("/api", calendarioRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rota raiz (sem expor detalhes internos em produção)
app.get("/", (_req, res) => {
  res.json({
    nome: "Plataforma de Agendamentos",
    versao: "2.0.0",
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
});

export default app;
