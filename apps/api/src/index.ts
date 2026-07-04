import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.API_PORT ?? 4000);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" })); // 이미지 base64 대비 여유

// 헬스체크
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "api", time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
