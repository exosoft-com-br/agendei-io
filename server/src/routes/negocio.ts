import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { sanitizar, sanitizarId } from "../utils/sanitizar";

export const negocioRouter = Router();

// ============================================================
// Validar cor hex
// ============================================================
function isCorHex(cor: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(cor);
}

/**
 * POST /api/negocios
 * Cadastra um novo negócio para o dono.
 */
negocioRouter.post("/negocios", async (req: Request, res: Response) => {
  try {
    const ownerId = sanitizarId(req.body.ownerId);
    const nichoId = sanitizarId(req.body.nichoId);
    const nomeFantasia = sanitizar(req.body.nomeFantasia || "");
    const descricao = sanitizar(req.body.descricao || "");
    const telefoneComercial = (req.body.telefoneComercial || "").replace(/\D/g, "");
    const endereco = sanitizar(req.body.endereco || "");
    const cidade = sanitizar(req.body.cidade || "");
    const estado = sanitizar(req.body.estado || "SP");
    const cnpjCpf = (req.body.cnpjCpf || "").replace(/\D/g, "");

    if (!ownerId || !nichoId || !nomeFantasia) {
      res.status(400).json({ erro: "Campos obrigatórios: ownerId, nichoId, nomeFantasia" });
      return;
    }

    // Verificar se o nicho existe
    const { data: nicho } = await supabase
      .from("nichos")
      .select("id")
      .eq("id", nichoId)
      .single();

    if (!nicho) {
      // Criar nicho automaticamente se não existir
      const slug = nichoId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      await supabase.from("nichos").insert({
        id: nichoId,
        nome_publico: nomeFantasia,
        tipo_cliente: "cliente",
        saudacao_inicial: `Olá! Bem-vindo(a) ao ${nomeFantasia}! Como posso ajudar?`,
        texto_confirmacao: "Agendamento confirmado! Protocolo: {protocolo}. Data: {dataHora}.",
        owner_id: ownerId,
        slug,
      });
    }

    const { data, error } = await supabase
      .from("negocios")
      .insert({
        owner_id: ownerId,
        nicho_id: nichoId,
        nome_fantasia: nomeFantasia,
        descricao,
        telefone_comercial: telefoneComercial || null,
        endereco: endereco || null,
        cidade: cidade || null,
        estado,
        cnpj_cpf: cnpjCpf || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ erro: "Você já possui um negócio cadastrado neste nicho." });
        return;
      }
      console.error("Erro ao criar negócio:", error);
      res.status(500).json({ erro: "Erro ao criar negócio." });
      return;
    }

    // Criar personalização padrão automaticamente
    await supabase.from("personalizacoes").insert({
      negocio_id: data.id,
    });

    res.status(201).json({
      sucesso: true,
      negocio: {
        id: data.id,
        ownerId: data.owner_id,
        nichoId: data.nicho_id,
        nomeFantasia: data.nome_fantasia,
        descricao: data.descricao,
        telefoneComercial: data.telefone_comercial,
        endereco: data.endereco,
        cidade: data.cidade,
        estado: data.estado,
      },
    });
  } catch (erro) {
    console.error("Erro ao criar negócio:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * GET /api/negocios/:ownerId
 * Lista os negócios de um dono.
 */
negocioRouter.get("/negocios/:ownerId", async (req: Request, res: Response) => {
  try {
    const ownerId = sanitizarId(req.params.ownerId);
    if (!ownerId) {
      res.status(400).json({ erro: "ownerId inválido." });
      return;
    }

    const { data, error } = await supabase
      .from("negocios")
      .select(`
        *,
        personalizacoes (*),
        nichos (nome_publico, saudacao_inicial, termos)
      `)
      .eq("owner_id", ownerId)
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("Erro ao listar negócios:", error);
      res.status(500).json({ erro: "Erro ao listar negócios." });
      return;
    }

    const negocios = (data || []).map((n: any) => ({
      id: n.id,
      nichoId: n.nicho_id,
      nomeFantasia: n.nome_fantasia,
      descricao: n.descricao,
      telefoneComercial: n.telefone_comercial,
      endereco: n.endereco,
      cidade: n.cidade,
      estado: n.estado,
      ativo: n.ativo,
      nicho: n.nichos ? {
        nomePublico: n.nichos.nome_publico,
        saudacaoInicial: n.nichos.saudacao_inicial,
        termos: n.nichos.termos,
      } : null,
      personalizacao: n.personalizacoes ? {
        logoUrl: n.personalizacoes.logo_url,
        corPrimaria: n.personalizacoes.cor_primaria,
        corSecundaria: n.personalizacoes.cor_secundaria,
        corTexto: n.personalizacoes.cor_texto,
        corFundo: n.personalizacoes.cor_fundo,
        corBotao: n.personalizacoes.cor_botao,
        corBotaoTexto: n.personalizacoes.cor_botao_texto,
        fonteTitulo: n.personalizacoes.fonte_titulo,
        fonteCorpo: n.personalizacoes.fonte_corpo,
        bannerUrl: n.personalizacoes.banner_url,
      } : null,
      criadoEm: n.criado_em,
    }));

    res.json({ negocios });
  } catch (erro) {
    console.error("Erro ao listar negócios:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/negocios/:negocioId
 * Atualiza dados do negócio.
 */
negocioRouter.put("/negocios/:negocioId", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.params.negocioId);
    if (!negocioId) {
      res.status(400).json({ erro: "negocioId inválido." });
      return;
    }

    const updates: Record<string, any> = {};

    const fields = [
      { key: "nomeFantasia", column: "nome_fantasia", sanitize: sanitizar },
      { key: "descricao", column: "descricao", sanitize: sanitizar },
      { key: "endereco", column: "endereco", sanitize: sanitizar },
      { key: "cidade", column: "cidade", sanitize: sanitizar },
      { key: "estado", column: "estado", sanitize: sanitizar },
    ];

    for (const f of fields) {
      if (req.body[f.key] !== undefined) {
        updates[f.column] = f.sanitize(req.body[f.key]);
      }
    }

    if (req.body.telefoneComercial !== undefined) {
      updates.telefone_comercial = req.body.telefoneComercial.replace(/\D/g, "");
    }
    if (req.body.cnpjCpf !== undefined) {
      updates.cnpj_cpf = req.body.cnpjCpf.replace(/\D/g, "");
    }
    if (req.body.ativo !== undefined) {
      updates.ativo = Boolean(req.body.ativo);
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("negocios")
      .update(updates)
      .eq("id", negocioId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar negócio:", error);
      res.status(500).json({ erro: "Erro ao atualizar negócio." });
      return;
    }

    res.json({ sucesso: true, negocio: data });
  } catch (erro) {
    console.error("Erro ao atualizar negócio:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/negocios/:negocioId/personalizacao
 * Atualiza cores, logo, fontes do negócio.
 */
negocioRouter.put("/negocios/:negocioId/personalizacao", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.params.negocioId);
    if (!negocioId) {
      res.status(400).json({ erro: "negocioId inválido." });
      return;
    }

    const updates: Record<string, any> = {};

    // Campos de cor (validar hex)
    const corFields = [
      { key: "corPrimaria", column: "cor_primaria" },
      { key: "corSecundaria", column: "cor_secundaria" },
      { key: "corTexto", column: "cor_texto" },
      { key: "corFundo", column: "cor_fundo" },
      { key: "corBotao", column: "cor_botao" },
      { key: "corBotaoTexto", column: "cor_botao_texto" },
    ];

    for (const f of corFields) {
      if (req.body[f.key]) {
        const cor = req.body[f.key].trim();
        if (!isCorHex(cor)) {
          res.status(400).json({ erro: `Cor inválida para ${f.key}. Use formato hex (#RRGGBB).` });
          return;
        }
        updates[f.column] = cor;
      }
    }

    // URLs (sanitizar)
    if (req.body.logoUrl !== undefined) updates.logo_url = sanitizar(req.body.logoUrl);
    if (req.body.faviconUrl !== undefined) updates.favicon_url = sanitizar(req.body.faviconUrl);
    if (req.body.bannerUrl !== undefined) updates.banner_url = sanitizar(req.body.bannerUrl);

    // Fontes (sanitizar)
    if (req.body.fonteTitulo) updates.fonte_titulo = sanitizar(req.body.fonteTitulo);
    if (req.body.fonteCorpo) updates.fonte_corpo = sanitizar(req.body.fonteCorpo);

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    // Upsert: atualizar se existe, criar se não
    const { data: existing } = await supabase
      .from("personalizacoes")
      .select("id")
      .eq("negocio_id", negocioId)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from("personalizacoes")
        .update(updates)
        .eq("negocio_id", negocioId)
        .select()
        .single();
    } else {
      result = await supabase
        .from("personalizacoes")
        .insert({ negocio_id: negocioId, ...updates })
        .select()
        .single();
    }

    if (result.error) {
      console.error("Erro ao atualizar personalização:", result.error);
      res.status(500).json({ erro: "Erro ao atualizar personalização." });
      return;
    }

    const p = result.data;
    res.json({
      sucesso: true,
      personalizacao: {
        logoUrl: p.logo_url,
        faviconUrl: p.favicon_url,
        corPrimaria: p.cor_primaria,
        corSecundaria: p.cor_secundaria,
        corTexto: p.cor_texto,
        corFundo: p.cor_fundo,
        corBotao: p.cor_botao,
        corBotaoTexto: p.cor_botao_texto,
        fonteTitulo: p.fonte_titulo,
        fonteCorpo: p.fonte_corpo,
        bannerUrl: p.banner_url,
      },
    });
  } catch (erro) {
    console.error("Erro ao atualizar personalização:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * GET /api/negocios/:negocioId/personalizacao
 * Retorna as personalizações visuais do negócio (público — usado pelo frontend de agendamento).
 */
negocioRouter.get("/negocios/:negocioId/personalizacao", async (req: Request, res: Response) => {
  try {
    const negocioId = sanitizarId(req.params.negocioId);
    if (!negocioId) {
      res.status(400).json({ erro: "negocioId inválido." });
      return;
    }

    const { data, error } = await supabase
      .from("personalizacoes")
      .select("*")
      .eq("negocio_id", negocioId)
      .single();

    if (error || !data) {
      // Retornar valores padrão se não existe personalização
      res.json({
        corPrimaria: "#667eea",
        corSecundaria: "#764ba2",
        corTexto: "#ffffff",
        corFundo: "#f5f5f5",
        corBotao: "#667eea",
        corBotaoTexto: "#ffffff",
        fonteTitulo: "Segoe UI",
        fonteCorpo: "Segoe UI",
        logoUrl: null,
        bannerUrl: null,
      });
      return;
    }

    res.json({
      logoUrl: data.logo_url,
      faviconUrl: data.favicon_url,
      corPrimaria: data.cor_primaria,
      corSecundaria: data.cor_secundaria,
      corTexto: data.cor_texto,
      corFundo: data.cor_fundo,
      corBotao: data.cor_botao,
      corBotaoTexto: data.cor_botao_texto,
      fonteTitulo: data.fonte_titulo,
      fonteCorpo: data.fonte_corpo,
      bannerUrl: data.banner_url,
    });
  } catch (erro) {
    console.error("Erro ao buscar personalização:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});
