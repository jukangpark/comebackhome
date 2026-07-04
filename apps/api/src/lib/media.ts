import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";

// 미디어 루트: 컨테이너에선 볼륨(/app/apps/api/media)로 마운트됨
export const MEDIA_ROOT =
  process.env.MEDIA_DIR ?? resolve(process.cwd(), "media");

export const UPLOADS_DIR = join(MEDIA_ROOT, "uploads");
export const MODELS_DIR = join(MEDIA_ROOT, "models");

export async function ensureMediaDirs(): Promise<void> {
  await mkdir(UPLOADS_DIR, { recursive: true });
  await mkdir(MODELS_DIR, { recursive: true });
}
