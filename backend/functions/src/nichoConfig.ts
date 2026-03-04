import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { Nicho } from "./models/Nicho";
import { Prestador } from "./models/Prestador";
import { Servico } from "./models/Servico";

// Referência ao Firestore
const db = admin.firestore();

/**
 * Cloud Function: getNichoConfig
 *
 * Retorna a configuração completa de um nicho, incluindo
 * prestadores e serviços vinculados.
 *
 * Endpoint: GET /getNichoConfig
 * Query params:
 *   - nichoId (obrigatório): ID do nicho (ex: "barbearia", "clinica")
 *
 * Retorno:
 *   { nicho: Nicho, prestadores: Prestador[], servicos: Servico[] }
 */
export const getNichoConfig = onRequest(
  { cors: true, region: "southamerica-east1" },
  async (req, res) => {
    try {
      // Apenas GET é permitido
      if (req.method !== "GET") {
        res.status(405).json({ erro: "Método não permitido. Use GET." });
        return;
      }

      const { nichoId } = req.query;

      // Validar parâmetro obrigatório
      if (!nichoId) {
        res.status(400).json({
          erro: "Parâmetro obrigatório: nichoId",
        });
        return;
      }

      // Buscar dados do nicho
      const nichoDoc = await db
        .collection("nichos")
        .doc(nichoId as string)
        .get();

      if (!nichoDoc.exists) {
        res.status(404).json({ erro: "Nicho não encontrado." });
        return;
      }

      const nicho = { id: nichoDoc.id, ...nichoDoc.data() } as Nicho;

      // Verificar se está ativo
      if (!nicho.ativo) {
        res.status(400).json({ erro: "Este nicho não está ativo no momento." });
        return;
      }

      // Buscar prestadores e serviços do nicho em paralelo
      const [prestadoresSnapshot, servicosSnapshot] = await Promise.all([
        db.collection("prestadores")
          .where("nichoId", "==", nichoId)
          .where("ativo", "==", true)
          .get(),
        db.collection("servicos")
          .where("nichoId", "==", nichoId)
          .where("ativo", "==", true)
          .get(),
      ]);

      // Mapear prestadores
      const prestadores: Prestador[] = [];
      prestadoresSnapshot.forEach((doc) => {
        prestadores.push({ id: doc.id, ...doc.data() } as Prestador);
      });

      // Mapear serviços
      const servicos: Servico[] = [];
      servicosSnapshot.forEach((doc) => {
        servicos.push({ id: doc.id, ...doc.data() } as Servico);
      });

      // Retornar configuração completa do nicho
      res.status(200).json({
        nicho,
        prestadores,
        servicos,
      });
    } catch (erro) {
      console.error("Erro ao buscar configuração do nicho:", erro);
      res.status(500).json({
        erro: "Erro interno ao buscar configuração do nicho.",
      });
    }
  }
);
