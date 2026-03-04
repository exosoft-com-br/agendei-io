import { Router, Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { sanitizar, sanitizarId } from "../utils/sanitizar";

export const profileRouter = Router();

/**
 * GET /api/profile/:userId
 * Retorna o perfil do dono de negócio.
 */
profileRouter.get("/profile/:userId", async (req: Request, res: Response) => {
  try {
    const userId = sanitizarId(req.params.userId);
    if (!userId) {
      res.status(400).json({ erro: "userId inválido." });
      return;
    }

    const { data, error } = await supabase
      .from("profiles_atendimentos")
      .select("*")
      .eq("id", userId)
      .single();

    if (error || !data) {
      res.status(404).json({ erro: "Perfil não encontrado." });
      return;
    }

    res.json({
      id: data.id,
      email: data.email,
      nomeCompleto: data.nome_completo,
      telefone: data.telefone,
      avatarUrl: data.avatar_url,
      role: data.role,
      criadoEm: data.criado_em,
    });
  } catch (erro) {
    console.error("Erro ao buscar perfil:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

/**
 * PUT /api/profile/:userId
 * Atualiza dados do perfil.
 */
profileRouter.put("/profile/:userId", async (req: Request, res: Response) => {
  try {
    const userId = sanitizarId(req.params.userId);
    if (!userId) {
      res.status(400).json({ erro: "userId inválido." });
      return;
    }

    const nomeCompleto = sanitizar(req.body.nomeCompleto || "");
    const telefone = (req.body.telefone || "").replace(/\D/g, "");
    const avatarUrl = sanitizar(req.body.avatarUrl || "");

    const updates: Record<string, any> = {};
    if (nomeCompleto) updates.nome_completo = nomeCompleto;
    if (telefone) updates.telefone = telefone;
    if (avatarUrl) updates.avatar_url = avatarUrl;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("profiles_atendimentos")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ erro: "Erro ao atualizar perfil." });
      return;
    }

    res.json({
      sucesso: true,
      perfil: {
        id: data.id,
        email: data.email,
        nomeCompleto: data.nome_completo,
        telefone: data.telefone,
        avatarUrl: data.avatar_url,
      },
    });
  } catch (erro) {
    console.error("Erro ao atualizar perfil:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});
