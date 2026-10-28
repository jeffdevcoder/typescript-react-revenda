import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const secret = () => process.env.JWT_SECRET || "dev-secret";

export const signToken = (userId: number) =>
  jwt.sign({ sub: userId }, secret(), { expiresIn: "7d" });

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, secret()) as unknown as { sub: number };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida. Entre novamente." });
  }
}
