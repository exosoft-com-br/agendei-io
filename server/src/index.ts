import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Carregar variáveis de ambiente ANTES de qualquer import que use process.env
dotenv.config();

import { availabilityRouter } from "./routes/availability";
import { bookingRouter } from "./routes/booking";
import { nichoConfigRouter } from "./routes/nichoConfig";
import { webhookRouter } from "./routes/webhook";

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use("/api", availabilityRouter);
app.use("/api", bookingRouter);
app.use("/api", nichoConfigRouter);
app.use("/api", webhookRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Rota raiz
app.get("/", (_req, res) => {
  res.json({
    nome: "Plataforma de Agendamentos via WhatsApp",
    versao: "1.0.0",
    endpoints: [
      "GET  /api/nicho?nichoId=barbearia",
      "GET  /api/availability?prestadorId=...&servicoId=...&data=YYYY-MM-DD",
      "POST /api/booking",
      "POST /api/booking/cancel",
      "POST /api/whatsapp/webhook",
      "GET  /health",
    ],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`📋 Endpoints disponíveis em http://localhost:${PORT}/`);
});

export default app;
