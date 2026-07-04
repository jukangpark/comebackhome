import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { migrate } from "./db.js";
import { authRouter } from "./routes/auth.js";

const app = express();
const PORT = Number(process.env.API_PORT ?? 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" })); // 이미지 base64 대비 여유
app.use(cookieParser());

// 헬스체크
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "api", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);

// 공통 에러 핸들러 (async 라우트에서 throw 시 500)
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "서버 오류가 발생했습니다" });
  }
);

async function start() {
  await migrate();
  app.listen(PORT, () => {
    console.log(`[api] listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[api] failed to start:", err);
  process.exit(1);
});
