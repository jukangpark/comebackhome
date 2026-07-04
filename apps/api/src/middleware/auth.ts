import type { Request, Response, NextFunction } from "express";
import { AUTH_COOKIE, verifyToken } from "../lib/auth.js";

// Express Request 에 userId/username 을 붙이기 위한 확장
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
    }
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.[AUTH_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "로그인이 필요합니다" });
    return;
  }
  req.userId = payload.userId;
  req.username = payload.username;
  next();
}
