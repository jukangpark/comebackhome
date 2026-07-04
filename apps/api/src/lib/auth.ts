import jwt from "jsonwebtoken";
import type { Response } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret";
const COOKIE_NAME = "token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

export interface TokenPayload {
  userId: string;
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export const AUTH_COOKIE = COOKIE_NAME;
