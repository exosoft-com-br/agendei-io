import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";

export const nichoConfigRouter = Router();

/**
 * GET /api/nicho?nichoId=barbearia
 *
 * Retorna configuração completa do nicho + prestadores + serviços.
 */
nichoConfigRouter.get("/nicho", async (req: Request, res: Response) => {
  try {
    const { nichoId } = req.query;

    if (!nichoId) {
      res.status(400).json({ erro: "Parâmetro obrigatório: nichoId" });
      return;
    }

    // 1. Buscar nicho
    const { data: nicho, error: nichoErr } = await supabase
      .from("nichos")
      .select("*")
      .eq("id", nichoId as string)
      .single();

    if (nichoErr || !nicho) {
      res.status(404).json({ erro: "Nicho não encontrado." });
      return;
    }

    // 2. Buscar prestadores do nicho
    const { data: prestadoresRaw } = await supabase
      .from("prestadores")
      .select("*")
      .eq("nicho_id", nichoId as string)
      .eq("ativo", true);

    // 3. Buscar serviços do nicho
    const { data: servicosRaw } = await supabase
      .from("servicos")
      .select("*")
      .eq("nicho_id", nichoId as string)
      .eq("ativo", true);

    // Mapear para formato camelCase (compatível com Typebot)
    const nichoFormatado = {
      id: nicho.id,
      nomePublico: nicho.nome_publico,
      tipoCliente: nicho.tipo_cliente,
      saudacaoInicial: nicho.saudacao_inicial,
      textoConfirmacao: nicho.texto_confirmacao,
      termos: nicho.termos,
      ativo: nicho.ativo,
    };

    const prestadores = (prestadoresRaw || []).map((p: any) => ({
      id: p.id,
      nichoId: p.nicho_id,
      nome: p.nome,
      categoria: p.categoria,
      horarioAtendimento: {
        inicio: p.horario_inicio,
        fim: p.horario_fim,
        diasSemana: p.dias_semana,
      },
      ativo: p.ativo,
    }));

    const servicos = (servicosRaw || []).map((s: any) => ({
      id: s.id,
      nichoId: s.nicho_id,
      prestadorId: s.prestador_id,
      nome: s.nome,
      duracaoMinutos: s.duracao_minutos,
      preco: s.preco ? Number(s.preco) : null,
      ativo: s.ativo,
    }));

    res.json({ nicho: nichoFormatado, prestadores, servicos });
  } catch (erro) {
    console.error("Erro ao buscar config do nicho:", erro);
    res.status(500).json({ erro: "Erro interno ao buscar configuração do nicho." });
  }
});
