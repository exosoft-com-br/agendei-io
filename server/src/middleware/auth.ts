import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET não definido. Configure a variável de ambiente.");
  process.exit(1);
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: "admin" | "usuario";
  ownerId: string; // admin: próprio id; usuario: id do admin dono
  negocioId?: string; // usuário vinculado a um negócio específico
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Gera um JWT com payload do usuário.
 */
export function gerarToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: "24h" });
}

/**
 * Middleware: exige autenticação (qualquer role).
 */
export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ erro: "Token não fornecido." });
    return;
  }

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET!) as AuthPayload;
    req.auth = decoded;
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

/**
 * Middleware: exige role admin.
 */
export function apenasAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ erro: "Não autenticado." });
    return;
  }
  if (req.auth.role !== "admin") {
    res.status(403).json({ erro: "Acesso restrito a administradores." });
    return;
  }
  next();
}
