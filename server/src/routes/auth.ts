import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { supabase } from "../supabaseClient";
import { sanitizar } from "../utils/sanitizar";
import { gerarToken, autenticar, apenasAdmin, AuthPayload } from "../middleware/auth";

// ── Mailer ───────────────────────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || "smtp.gmail.com",
  port:   Number(process.env.SMTP_PORT) || 465,
  secure: (process.env.SMTP_SECURE ?? "true") === "true",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

async function enviarEmailResetSenha(email: string, nome: string, token: string) {
  const link = `${process.env.APP_URL || "https://agendei.io"}/docs/resetar-senha.html?token=${token}`;
  await mailer.sendMail({
    from: `"agendei.io" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: "Redefinição de senha — agendei.io",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#00A8C6">agendei.io</h2>
        <p>Olá, <strong>${nome}</strong>.</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#00A8C6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
            Redefinir senha
          </a>
        </p>
        <p style="font-size:13px;color:#888">O link expira em <strong>1 hora</strong>. Se não solicitou, ignore este e-mail.</p>
      </div>`,
  });
}

export const authRouter = Router();

// ============================================================
// Helpers
// ============================================================
async function criarOuAtualizarUsuarioOAuth(
  email: string,
  nome: string,
  provedor: "google" | "facebook",
  provedorId: string,
  avatarUrl?: string
): Promise<{ usuario: any; isNew: boolean }> {
  // Verificar se já existe por provedor+id
  const { data: existente } = await supabase
    .from("usuarios")
    .select("*")
    .eq("provedor", provedor)
    .eq("provedor_id", provedorId)
    .single();

  if (existente) {
    await supabase
      .from("usuarios")
      .update({ nome, avatar_url: avatarUrl || existente.avatar_url })
      .eq("id", existente.id);
    return { usuario: { ...existente, nome, avatar_url: avatarUrl }, isNew: false };
  }

  // Verificar se existe pelo email
  const { data: porEmail } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .single();

  if (porEmail) {
    await supabase
      .from("usuarios")
      .update({ provedor, provedor_id: provedorId, avatar_url: avatarUrl || porEmail.avatar_url })
      .eq("id", porEmail.id);
    return { usuario: { ...porEmail, provedor, provedor_id: provedorId }, isNew: false };
  }

  // Primeiro usuário = admin automático
  const { data: admins } = await supabase
    .from("usuarios")
    .select("id")
    .eq("role", "admin")
    .limit(1);

  const isFirstUser = !admins || admins.length === 0;
  const role = isFirstUser ? "admin" : "usuario";

  const { data, error } = await supabase
    .from("usuarios")
    .insert({
      email,
      senha_hash: "",
      nome,
      role,
      owner_id: null,
      provedor,
      provedor_id: provedorId,
      avatar_url: avatarUrl,
    })
    .select("*")
    .single();

  if (error) throw error;

  if (role === "admin") {
    await supabase.from("usuarios").update({ owner_id: data.id }).eq("id", data.id);
    data.owner_id = data.id;
  }

  return { usuario: data, isNew: true };
}

function gerarResposta(user: any) {
  const ownerId = user.role === "admin" ? user.id : (user.owner_id || user.id);
  const negocioId = user.negocio_id || undefined;
  const token = gerarToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    ownerId,
    negocioId,
  });
  return {
    sucesso: true,
    token,
    usuario: {
      id: user.id,
      email: user.email,
      nome: user.nome,
      role: user.role,
      ownerId,
      negocioId: negocioId || null,
      avatarUrl: user.avatar_url || null,
      provedor: user.provedor || "email",
      whatsappAtivo: user.whatsapp_ativo ?? true,
      permPrestadores: user.perm_prestadores ?? false,
      permServicos: user.perm_servicos ?? false,
      permAgenda: user.perm_agenda ?? false,
    },
  };
}

// ============================================================
// POST /api/auth/register (email + senha)
// ============================================================
authRouter.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const senha = req.body.senha || "";
    const nome = sanitizar(req.body.nome || "");
    const role = req.body.role || "usuario";

    if (!email || !senha || !nome) {
      res.status(400).json({ erro: "Email, senha e nome são obrigatórios." });
      return;
    }
    if (senha.length < 8) {
      res.status(400).json({ erro: "Senha deve ter pelo menos 8 caracteres." });
      return;
    }
    if (!["admin", "usuario"].includes(role)) {
      res.status(400).json({ erro: "Role deve ser 'admin' ou 'usuario'." });
      return;
    }

    const { data: admins } = await supabase
      .from("usuarios")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    const isFirstUser = !admins || admins.length === 0;

    if (!isFirstUser) {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ erro: "Apenas administradores podem criar novos usuários." });
        return;
      }
      const jwtLib = await import("jsonwebtoken");
      const secret = process.env.JWT_SECRET!;
      try {
        const decoded = jwtLib.default.verify(header.split(" ")[1], secret) as AuthPayload;
        if (decoded.role !== "admin") {
          res.status(403).json({ erro: "Apenas administradores podem criar novos usuários." });
          return;
        }
      } catch {
        res.status(401).json({ erro: "Token inválido." });
        return;
      }
    }

    const { data: existente } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (existente) {
      res.status(409).json({ erro: "Email já cadastrado." });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);
    const finalRole = isFirstUser ? "admin" : role;

    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        email,
        senha_hash: senhaHash,
        nome,
        role: finalRole,
        owner_id: null,
        provedor: "email",
      })
      .select("id, email, nome, role, criado_em")
      .single();

    if (error) {
      console.error("Erro ao registrar:", error);
      res.status(500).json({ erro: "Erro ao cadastrar usuário.", detalhes: error.message });
      return;
    }

    if (finalRole === "admin") {
      await supabase.from("usuarios").update({ owner_id: data.id }).eq("id", data.id);
    }

    res.status(201).json({
      sucesso: true,
      usuario: data,
      mensagem: isFirstUser
        ? "Conta admin criada com sucesso! Você é o primeiro administrador."
        : `Usuário ${finalRole} criado com sucesso.`,
    });
  } catch (erro: any) {
    console.error("Erro no registro:", erro);
    res.status(500).json({ erro: "Erro interno.", detalhes: erro.message });
  }
});

// ============================================================
// POST /api/auth/login (email + senha)
// ============================================================
authRouter.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const senha = req.body.senha || "";

    if (!email || !senha) {
      res.status(400).json({ erro: "Email e senha são obrigatórios." });
      return;
    }

    const { data: user, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !user) {
      res.status(401).json({ erro: "Email ou senha incorretos." });
      return;
    }

    if (!user.ativo) {
      res.status(403).json({ erro: "Conta desativada. Contate o administrador." });
      return;
    }

    if (!user.senha_hash) {
      res.status(400).json({
        erro: `Esta conta foi criada via ${user.provedor}. Use o botão "${user.provedor}" para entrar.`,
      });
      return;
    }

    const senhaOk = await bcrypt.compare(senha, user.senha_hash);
    if (!senhaOk) {
      res.status(401).json({ erro: "Email ou senha incorretos." });
      return;
    }

    res.json(gerarResposta(user));
  } catch (erro: any) {
    console.error("Erro no login:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// POST /api/auth/google — Login/Registro via Google
// ============================================================
authRouter.post("/auth/google", async (req: Request, res: Response) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      res.status(400).json({ erro: "Token do Google não fornecido." });
      return;
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) {
      res.status(503).json({ erro: "Login com Google não configurado no servidor." });
      return;
    }

    const { OAuth2Client } = await import("google-auth-library");
    const client = new OAuth2Client(GOOGLE_CLIENT_ID);
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch {
      res.status(401).json({ erro: "Token do Google inválido." });
      return;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(401).json({ erro: "Token do Google não contém email." });
      return;
    }

    const { usuario } = await criarOuAtualizarUsuarioOAuth(
      payload.email,
      payload.name || payload.email.split("@")[0],
      "google",
      payload.sub,
      payload.picture
    );

    if (!usuario.ativo) {
      res.status(403).json({ erro: "Conta desativada." });
      return;
    }

    res.json(gerarResposta(usuario));
  } catch (erro: any) {
    console.error("Erro Google OAuth:", erro);
    res.status(500).json({ erro: "Erro ao autenticar com Google.", detalhes: erro.message });
  }
});

// ============================================================
// POST /api/auth/facebook — Login/Registro via Facebook
// ============================================================
authRouter.post("/auth/facebook", async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) {
      res.status(400).json({ erro: "Token do Facebook não fornecido." });
      return;
    }

    const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
    const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      res.status(503).json({ erro: "Login com Facebook não configurado no servidor." });
      return;
    }

    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${FACEBOOK_APP_ID}|${FACEBOOK_APP_SECRET}`;
    const debugRes = await fetch(debugUrl);
    const debugData = await debugRes.json() as any;

    if (!debugData.data || !debugData.data.is_valid) {
      res.status(401).json({ erro: "Token do Facebook inválido." });
      return;
    }

    const profileUrl = `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${accessToken}`;
    const profileRes = await fetch(profileUrl);
    const profile = await profileRes.json() as any;

    if (!profile.email) {
      res.status(400).json({ erro: "O Facebook não retornou o email. Verifique as permissões." });
      return;
    }

    const { usuario } = await criarOuAtualizarUsuarioOAuth(
      profile.email,
      profile.name || profile.email.split("@")[0],
      "facebook",
      profile.id,
      profile.picture?.data?.url || null
    );

    if (!usuario.ativo) {
      res.status(403).json({ erro: "Conta desativada." });
      return;
    }

    res.json(gerarResposta(usuario));
  } catch (erro: any) {
    console.error("Erro Facebook OAuth:", erro);
    res.status(500).json({ erro: "Erro ao autenticar com Facebook.", detalhes: erro.message });
  }
});

// ============================================================
// GET /api/auth/me
// ============================================================
authRouter.get("/auth/me", autenticar, async (req: Request, res: Response) => {
  try {
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, email, nome, role, ativo, provedor, avatar_url, owner_id, negocio_id, whatsapp_ativo, perm_prestadores, perm_servicos, perm_agenda")
      .eq("id", req.auth!.userId)
      .single();

    if (!user) {
      res.status(404).json({ erro: "Usuário não encontrado." });
      return;
    }

    res.json({
      usuario: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        role: user.role,
        ownerId: user.role === "admin" ? user.id : (user.owner_id || user.id),
        negocioId: user.negocio_id || null,
        avatarUrl: user.avatar_url,
        provedor: user.provedor,
        whatsappAtivo: user.whatsapp_ativo,
        permPrestadores: user.perm_prestadores,
        permServicos: user.perm_servicos,
        permAgenda: user.perm_agenda,
      },
    });
  } catch {
    res.json({
      usuario: {
        userId: req.auth!.userId,
        email: req.auth!.email,
        role: req.auth!.role,
        ownerId: req.auth!.ownerId,
      },
    });
  }
});

// ============================================================
// GET /api/auth/usuarios — Admin lista seus usuários
// ============================================================
authRouter.get("/auth/usuarios", autenticar, apenasAdmin, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email, nome, role, ativo, criado_em, provedor, avatar_url, negocio_id")
      .or(`id.eq.${req.auth!.userId},owner_id.eq.${req.auth!.userId}`)
      .order("criado_em", { ascending: false });

    if (error) {
      res.status(500).json({ erro: "Erro ao listar usuários." });
      return;
    }

    res.json({ usuarios: data || [] });
  } catch (erro) {
    console.error("Erro ao listar usuários:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// POST /api/auth/usuarios — Admin cria usuário vinculado (opcionalmente a um negócio)
// ============================================================
authRouter.post("/auth/usuarios", autenticar, apenasAdmin, async (req: Request, res: Response) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const senha = req.body.senha || "";
    const nome = sanitizar(req.body.nome || "");
    const negocioId = req.body.negocioId || null;
    const whatsappAtivo = req.body.whatsappAtivo !== false; // default true
    const permPrestadores = !!req.body.permPrestadores;
    const permServicos = !!req.body.permServicos;
    const permAgenda = !!req.body.permAgenda;

    if (!email || !senha || !nome) {
      res.status(400).json({ erro: "Email, senha e nome são obrigatórios." });
      return;
    }
    if (senha.length < 8) {
      res.status(400).json({ erro: "Senha mínima: 8 caracteres." });
      return;
    }

    const { data: existente } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .single();

    if (existente) {
      res.status(409).json({ erro: "Email já cadastrado." });
      return;
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const { data, error } = await supabase
      .from("usuarios")
      .insert({
        email,
        senha_hash: senhaHash,
        nome,
        role: "usuario",
        owner_id: req.auth!.userId,
        negocio_id: negocioId,
        provedor: "email",
        whatsapp_ativo: whatsappAtivo,
        perm_prestadores: permPrestadores,
        perm_servicos: permServicos,
        perm_agenda: permAgenda,
      })
      .select("id, email, nome, role, criado_em, negocio_id, whatsapp_ativo, perm_prestadores, perm_servicos, perm_agenda")
      .single();

    if (error) {
      res.status(500).json({ erro: "Erro ao criar usuário." });
      return;
    }

    res.status(201).json({ sucesso: true, usuario: data });
  } catch (erro) {
    console.error("Erro ao criar usuário:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// GET /api/auth/usuarios/negocio/:negocioId — Lista usuários de um negócio
// ============================================================
authRouter.get("/auth/usuarios/negocio/:negocioId", autenticar, apenasAdmin, async (req: Request, res: Response) => {
  try {
    const negocioId = req.params.negocioId;
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email, nome, role, ativo, criado_em, negocio_id, whatsapp_ativo, perm_prestadores, perm_servicos, perm_agenda")
      .eq("negocio_id", negocioId)
      .order("criado_em", { ascending: false });

    if (error) {
      res.status(500).json({ erro: "Erro ao listar usuários do negócio." });
      return;
    }

    res.json({ usuarios: data || [] });
  } catch (erro) {
    console.error("Erro ao listar usuários do negócio:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// PUT /api/auth/usuarios/:id — Admin edita usuário
// ============================================================
authRouter.put("/auth/usuarios/:id", autenticar, apenasAdmin, async (req: Request, res: Response) => {
  try {
    const usuarioId = req.params.id;
    const nome = req.body.nome ? sanitizar(req.body.nome) : undefined;
    const email = req.body.email ? (req.body.email as string).trim().toLowerCase() : undefined;
    const senha = req.body.senha || undefined;
    const whatsappAtivo = req.body.whatsappAtivo;
    const permPrestadores = req.body.permPrestadores;
    const permServicos = req.body.permServicos;
    const permAgenda = req.body.permAgenda;

    const updates: Record<string, any> = {};
    if (nome !== undefined) updates.nome = nome;
    if (email !== undefined) updates.email = email;
    if (senha !== undefined) {
      if (senha.length < 6) { res.status(400).json({ erro: "Senha mínima: 6 caracteres." }); return; }
      updates.senha_hash = await bcrypt.hash(senha, 12);
    }
    if (whatsappAtivo !== undefined) updates.whatsapp_ativo = !!whatsappAtivo;
    if (permPrestadores !== undefined) updates.perm_prestadores = !!permPrestadores;
    if (permServicos !== undefined) updates.perm_servicos = !!permServicos;
    if (permAgenda !== undefined) updates.perm_agenda = !!permAgenda;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ erro: "Nenhum campo para atualizar." });
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .update(updates)
      .eq("id", usuarioId)
      .eq("owner_id", req.auth!.userId)
      .select("id, email, nome, role, ativo, criado_em, negocio_id, whatsapp_ativo, perm_prestadores, perm_servicos, perm_agenda")
      .single();

    if (error || !data) {
      res.status(500).json({ erro: "Erro ao atualizar usuário." });
      return;
    }

    res.json({ sucesso: true, usuario: data });
  } catch (erro) {
    console.error("Erro ao editar usuário:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// DELETE /api/auth/usuarios/:id — Admin remove usuário
// ============================================================
authRouter.delete("/auth/usuarios/:id", autenticar, apenasAdmin, async (req: Request, res: Response) => {
  try {
    const usuarioId = req.params.id;
    if (usuarioId === req.auth!.userId) {
      res.status(400).json({ erro: "Não é possível remover sua própria conta." });
      return;
    }

    const { error } = await supabase
      .from("usuarios")
      .delete()
      .eq("id", usuarioId)
      .eq("owner_id", req.auth!.userId); // garante que só pode remover seus próprios usuários

    if (error) {
      res.status(500).json({ erro: "Erro ao remover usuário." });
      return;
    }

    res.json({ sucesso: true });
  } catch (erro) {
    console.error("Erro ao remover usuário:", erro);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// GET /api/auth/oauth-config — quais provedores estão ativos
// ============================================================
authRouter.get("/auth/oauth-config", async (_req: Request, res: Response) => {
  res.json({
    google: !!process.env.GOOGLE_CLIENT_ID,
    facebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    facebookAppId: process.env.FACEBOOK_APP_ID || null,
  });
});

// ============================================================
// POST /api/auth/esqueci-senha
// Gera token e envia e-mail para redefinição de senha
// ============================================================
authRouter.post("/auth/esqueci-senha", async (req: Request, res: Response) => {
  // Sempre retorna 200 para não expor se e-mail existe
  const resposta = { sucesso: true, mensagem: "Se este e-mail estiver cadastrado, você receberá um link em breve." };
  try {
    const email = ((req.body.email as string) || "").trim().toLowerCase();
    if (!email) { res.json(resposta); return; }

    const { data: user } = await supabase
      .from("usuarios")
      .select("id, nome, email")
      .eq("email", email)
      .single();

    if (!user) { res.json(resposta); return; }

    // Gera token seguro
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiraEm  = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    // Remove tokens anteriores do mesmo usuário
    await supabase.from("password_reset_tokens").delete().eq("user_id", user.id);

    await supabase.from("password_reset_tokens").insert({
      user_id:   user.id,
      token_hash: tokenHash,
      expira_em:  expiraEm,
    });

    if (process.env.SMTP_USER) {
      await enviarEmailResetSenha(user.email, user.nome || "Usuário", rawToken).catch(e =>
        console.error("[auth] Erro ao enviar e-mail de reset:", e?.message)
      );
    } else {
      console.warn("[auth] SMTP não configurado — token de reset gerado mas e-mail não enviado.");
    }

    res.json(resposta);
  } catch (e) {
    console.error("[auth] Erro em esqueci-senha:", e);
    res.json(resposta);
  }
});

// ============================================================
// POST /api/auth/resetar-senha
// Valida token e atualiza senha
// ============================================================
authRouter.post("/auth/resetar-senha", async (req: Request, res: Response) => {
  try {
    const rawToken = (req.body.token as string) || "";
    const novaSenha = (req.body.senha as string) || "";

    if (!rawToken || novaSenha.length < 8) {
      res.status(400).json({ erro: "Token inválido ou senha muito curta (mínimo 8 caracteres)." });
      return;
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const { data: tokenRow } = await supabase
      .from("password_reset_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .single();

    if (!tokenRow) {
      res.status(400).json({ erro: "Token inválido ou expirado." });
      return;
    }

    const senhaHash = await bcrypt.hash(novaSenha, 12);

    await supabase.from("usuarios").update({ senha_hash: senhaHash }).eq("id", tokenRow.user_id);
    await supabase.from("password_reset_tokens").update({ usado: true }).eq("id", tokenRow.id);

    res.json({ sucesso: true, mensagem: "Senha redefinida com sucesso." });
  } catch (e) {
    console.error("[auth] Erro em resetar-senha:", e);
    res.status(500).json({ erro: "Erro interno." });
  }
});

// ============================================================
// POST /api/auth/refresh
// Renova token JWT por mais 24h se o atual ainda for válido
// ============================================================
authRouter.post("/auth/refresh", autenticar, async (req: Request, res: Response) => {
  try {
    const { data: user } = await supabase
      .from("usuarios")
      .select("id, email, nome, role, owner_id, negocio_id, whatsapp_ativo, perm_prestadores, perm_servicos, perm_agenda, avatar_url, provedor, ativo")
      .eq("id", req.auth!.userId)
      .single();

    if (!user || user.ativo === false) {
      res.status(401).json({ erro: "Usuário inativo ou não encontrado." });
      return;
    }

    res.json(gerarResposta(user));
  } catch (e) {
    console.error("[auth] Erro ao renovar token:", e);
    res.status(500).json({ erro: "Erro interno." });
  }
});
