import { Router, type RequestHandler } from "express";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import multer from "multer";
import sharp from "sharp";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { UPLOADS_DIR, MODELS_DIR } from "../lib/media.js";
import { meshyProvider } from "../lib/meshy.js";

export const petRouter = Router();
petRouter.use(requireAuth);

const ah =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

interface PetRow {
  id: string;
  user_id: string;
  name: string;
  species: "dog" | "cat";
}

const createPetSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해주세요").max(20, "이름은 20자 이하"),
  species: z.enum(["dog", "cat"]),
});

async function getPetByUser(userId: string): Promise<PetRow | undefined> {
  const r = await query<PetRow>(
    `SELECT id, user_id, name, species FROM pets WHERE user_id = $1`,
    [userId]
  );
  return r.rows[0];
}

// 펫 생성 (유저당 1마리)
petRouter.post(
  "/",
  ah(async (req, res) => {
    const parsed = createPetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "잘못된 입력" });
      return;
    }
    if (await getPetByUser(req.userId!)) {
      res.status(409).json({ error: "이미 등록한 반려동물이 있습니다" });
      return;
    }
    const { name, species } = parsed.data;
    const r = await query<PetRow>(
      `INSERT INTO pets (user_id, name, species) VALUES ($1, $2, $3)
       RETURNING id, user_id, name, species`,
      [req.userId, name, species]
    );
    res.status(201).json(r.rows[0]);
  })
);

// 내 펫 조회 (없으면 404)
petRouter.get(
  "/",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "등록된 반려동물이 없습니다" });
      return;
    }
    const img = await query(`SELECT 1 FROM pet_images WHERE pet_id = $1`, [pet.id]);
    const persona = await query(`SELECT 1 FROM personas WHERE pet_id = $1`, [pet.id]);
    res.json({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      hasImage: (img.rowCount ?? 0) > 0,
      hasPersona: (persona.rowCount ?? 0) > 0,
    });
  })
);

// 이미지 업로드 (1장)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("jpg 또는 png 이미지만 업로드할 수 있습니다"));
  },
});

petRouter.post(
  "/image",
  upload.single("image"),
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "먼저 반려동물을 등록해주세요" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "이미지를 선택해주세요" });
      return;
    }

    // 장변 1024로 리사이즈 → jpeg
    const fileName = `${pet.id}.jpg`;
    const filePath = join(UPLOADS_DIR, fileName);
    await sharp(req.file.buffer)
      .rotate() // EXIF 방향 보정
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(filePath);

    // 펫당 1장 → upsert
    await query(
      `INSERT INTO pet_images (pet_id, file_path) VALUES ($1, $2)
       ON CONFLICT (pet_id) DO UPDATE SET file_path = EXCLUDED.file_path, created_at = now()`,
      [pet.id, fileName]
    );

    res.status(201).json({ ok: true });
  })
);

// 업로드 이미지 서빙 (본인 펫만)
petRouter.get(
  "/image",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).end();
      return;
    }
    const r = await query<{ file_path: string }>(
      `SELECT file_path FROM pet_images WHERE pet_id = $1`,
      [pet.id]
    );
    const fp = r.rows[0]?.file_path;
    if (!fp) {
      res.status(404).end();
      return;
    }
    const abs = join(UPLOADS_DIR, fp);
    if (!existsSync(abs)) {
      res.status(404).end();
      return;
    }
    res.sendFile(abs);
  })
);

// ── 3D 모델 생성 ──

interface ModelRow {
  status: "IN_PROGRESS" | "DONE" | "FAILED";
  progress: number;
  glb_path: string | null;
}

// 생성 시작 (없거나 실패한 경우에만 새로 시작; DONE/진행중이면 현재 상태 반환)
petRouter.post(
  "/model",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "먼저 반려동물을 등록해주세요" });
      return;
    }
    const imgRow = await query<{ file_path: string }>(
      `SELECT file_path FROM pet_images WHERE pet_id = $1`,
      [pet.id]
    );
    const filePath = imgRow.rows[0]?.file_path;
    if (!filePath) {
      res.status(400).json({ error: "먼저 사진을 업로드해주세요" });
      return;
    }

    const existing = await query<ModelRow>(
      `SELECT status, progress, glb_path FROM pet_models WHERE pet_id = $1`,
      [pet.id]
    );
    const cur = existing.rows[0];
    if (cur && cur.status !== "FAILED") {
      // 이미 진행 중이거나 완료됨 → 재생성하지 않고 현재 상태 반환
      res.json({ status: cur.status, progress: cur.progress });
      return;
    }

    // 이미지 → base64 data URI
    const abs = join(UPLOADS_DIR, filePath);
    const b64 = (await readFile(abs)).toString("base64");
    const dataUri = `data:image/jpeg;base64,${b64}`;

    const taskId = await meshyProvider.createImageTo3d(dataUri);

    await query(
      `INSERT INTO pet_models (pet_id, meshy_task_id, status, progress, error)
       VALUES ($1, $2, 'IN_PROGRESS', 0, NULL)
       ON CONFLICT (pet_id) DO UPDATE
         SET meshy_task_id=EXCLUDED.meshy_task_id, status='IN_PROGRESS',
             progress=0, glb_path=NULL, error=NULL, updated_at=now()`,
      [pet.id, taskId]
    );

    res.status(201).json({ status: "IN_PROGRESS", progress: 0 });
  })
);

// 생성 상태 조회
petRouter.get(
  "/model",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "등록된 반려동물이 없습니다" });
      return;
    }
    const r = await query<ModelRow>(
      `SELECT status, progress, glb_path FROM pet_models WHERE pet_id = $1`,
      [pet.id]
    );
    const m = r.rows[0];
    if (!m) {
      res.status(404).json({ error: "생성된 모델이 없습니다" });
      return;
    }
    res.json({ status: m.status, progress: m.progress, hasGlb: !!m.glb_path });
  })
);

// glb 서빙 (본인 펫만)
petRouter.get(
  "/model/file",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).end();
      return;
    }
    const r = await query<{ glb_path: string | null }>(
      `SELECT glb_path FROM pet_models WHERE pet_id = $1`,
      [pet.id]
    );
    const gp = r.rows[0]?.glb_path;
    if (!gp) {
      res.status(404).end();
      return;
    }
    const abs = join(MODELS_DIR, gp);
    if (!existsSync(abs)) {
      res.status(404).end();
      return;
    }
    res.type("model/gltf-binary").sendFile(abs);
  })
);

// ── 페르소나 ──

const personaSchema = z.object({
  traits: z.string().trim().min(1, "성격을 입력해주세요").max(500, "성격은 500자 이하"),
  memories: z
    .string()
    .trim()
    .min(1, "함께한 추억을 입력해주세요")
    .max(2000, "추억은 2000자 이하"),
  speaking: z.string().trim().max(200, "말투는 200자 이하").optional().default(""),
});

interface PersonaRow {
  traits: string;
  memories: string;
  speaking: string;
}

// 페르소나 조회
petRouter.get(
  "/persona",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "등록된 반려동물이 없습니다" });
      return;
    }
    const r = await query<PersonaRow>(
      `SELECT traits, memories, speaking FROM personas WHERE pet_id = $1`,
      [pet.id]
    );
    if (!r.rows[0]) {
      res.status(404).json({ error: "작성된 페르소나가 없습니다" });
      return;
    }
    res.json(r.rows[0]);
  })
);

// 페르소나 저장(upsert)
petRouter.put(
  "/persona",
  ah(async (req, res) => {
    const pet = await getPetByUser(req.userId!);
    if (!pet) {
      res.status(404).json({ error: "먼저 반려동물을 등록해주세요" });
      return;
    }
    const parsed = personaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "잘못된 입력" });
      return;
    }
    const { traits, memories, speaking } = parsed.data;
    await query(
      `INSERT INTO personas (pet_id, traits, memories, speaking)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pet_id) DO UPDATE
         SET traits=EXCLUDED.traits, memories=EXCLUDED.memories,
             speaking=EXCLUDED.speaking, updated_at=now()`,
      [pet.id, traits, memories, speaking]
    );
    res.json({ traits, memories, speaking });
  })
);

// multer 등에서 던진 에러 처리
petRouter.use(((err, _req, res, _next) => {
  res.status(400).json({ error: err?.message ?? "업로드 오류" });
}) as import("express").ErrorRequestHandler);
