import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "../db.js";
import { MODELS_DIR } from "../lib/media.js";
import { meshyProvider, type ModelProvider } from "../lib/meshy.js";

const POLL_INTERVAL_MS = 6000;
// 생성이 이 시간을 넘기면 실패 처리 (무한 대기 방지)
const MAX_AGE_MS = 10 * 60 * 1000;

interface PendingRow {
  id: string;
  pet_id: string;
  meshy_task_id: string;
  age_ms: number;
}

async function downloadGlb(url: string, petId: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`glb 다운로드 실패 (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const fileName = `${petId}.glb`;
  await writeFile(join(MODELS_DIR, fileName), buf);
  return fileName;
}

async function pollOnce(provider: ModelProvider): Promise<void> {
  const { rows } = await query<PendingRow>(
    `SELECT id, pet_id, meshy_task_id,
            EXTRACT(EPOCH FROM (now() - created_at)) * 1000 AS age_ms
       FROM pet_models
      WHERE status = 'IN_PROGRESS' AND meshy_task_id IS NOT NULL`
  );

  for (const row of rows) {
    try {
      const task = await provider.getTask(row.meshy_task_id);

      if (task.status === "SUCCEEDED" && task.glbUrl) {
        const glbPath = await downloadGlb(task.glbUrl, row.pet_id);
        await query(
          `UPDATE pet_models
              SET status='DONE', progress=100, glb_path=$1, updated_at=now()
            WHERE id=$2`,
          [glbPath, row.id]
        );
        console.log(`[model] DONE pet=${row.pet_id}`);
      } else if (task.status === "FAILED" || task.status === "CANCELED") {
        await query(
          `UPDATE pet_models SET status='FAILED', error=$1, updated_at=now() WHERE id=$2`,
          [task.error ?? task.status, row.id]
        );
        console.log(`[model] FAILED pet=${row.pet_id}: ${task.error ?? task.status}`);
      } else if (Number(row.age_ms) > MAX_AGE_MS) {
        await query(
          `UPDATE pet_models SET status='FAILED', error='시간 초과', updated_at=now() WHERE id=$1`,
          [row.id]
        );
        console.log(`[model] TIMEOUT pet=${row.pet_id}`);
      } else {
        await query(
          `UPDATE pet_models SET progress=$1, updated_at=now() WHERE id=$2`,
          [task.progress, row.id]
        );
      }
    } catch (err) {
      // 개별 모델 오류는 로그만 남기고 다음 틱에 재시도
      console.error(`[model] poll error pet=${row.pet_id}:`, err);
    }
  }
}

let running = false;

export function startModelPoller(provider: ModelProvider = meshyProvider): void {
  setInterval(async () => {
    if (running) return; // 이전 틱이 아직 돌면 스킵
    running = true;
    try {
      await pollOnce(provider);
    } catch (err) {
      console.error("[model] poller tick error:", err);
    } finally {
      running = false;
    }
  }, POLL_INTERVAL_MS);
  console.log(`[model] poller started (every ${POLL_INTERVAL_MS}ms)`);
}
