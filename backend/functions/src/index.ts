/**
 * Plataforma de Agendamentos via WhatsApp
 *
 * Entry point — exporta todas as Cloud Functions.
 * Cada function é definida em seu próprio arquivo para melhor organização.
 */

import * as admin from "firebase-admin";

// Inicializar Firebase Admin SDK (apenas uma vez)
admin.initializeApp();

// ============================================================
// Exportar Cloud Functions
// ============================================================

// Consulta de horários disponíveis
export { getAvailableSlots } from "./availability";

// Criação e cancelamento de agendamentos
export { createBooking, cancelBooking } from "./booking";

// Configuração do nicho
export { getNichoConfig } from "./nichoConfig";

// Webhook do WhatsApp
export { whatsappWebhook } from "./whatsappWebhook";
