import { Router, type RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { credentialsSchema } from "../lib/validation.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
} from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

// async 핸들러의 에러를 Express 에러 핸들러로 전달
const ah =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
}

// 회원가입
authRouter.post("/register", ah(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "잘못된 입력" });
    return;
  }
  const { username, password } = parsed.data;

  const exists = await query(`SELECT 1 FROM users WHERE username = $1`, [username]);
  if ((exists.rowCount ?? 0) > 0) {
    res.status(409).json({ error: "이미 사용 중인 아이디입니다" });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query<UserRow>(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     RETURNING id, username, password_hash`,
    [username, hash]
  );
  const user = result.rows[0]!;

  const token = signToken({ userId: user.id, username: user.username });
  setAuthCookie(res, token);
  res.status(201).json({ id: user.id, username: user.username });
}));

// 로그인
authRouter.post("/login", ah(async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "아이디 또는 비밀번호를 확인해주세요" });
    return;
  }
  const { username, password } = parsed.data;

  const result = await query<UserRow>(
    `SELECT id, username, password_hash FROM users WHERE username = $1`,
    [username]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username });
  setAuthCookie(res, token);
  res.json({ id: user.id, username: user.username });
}));

// 로그아웃
authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// 현재 사용자
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ id: req.userId, username: req.username });
});
