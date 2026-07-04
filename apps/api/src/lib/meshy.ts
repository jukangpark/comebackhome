// Meshy image-to-3D 어댑터.
// 나중에 다른 공급자(Tripo 등)로 교체 가능하도록 인터페이스 뒤에 둠.

export type ModelStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface ModelTaskResult {
  status: ModelStatus;
  progress: number;
  glbUrl?: string;
  error?: string;
}

export interface ModelProvider {
  createImageTo3d(imageDataUri: string): Promise<string>; // taskId
  getTask(taskId: string): Promise<ModelTaskResult>;
}

const MESHY_BASE = "https://api.meshy.ai/openapi/v1";

function getKey(): string {
  // 빈 문자열도 미설정으로 취급 → MESHY_KEY 로 폴백
  const key = process.env.MESHY_API_KEY || process.env.MESHY_KEY;
  if (!key) throw new Error("MESHY_API_KEY(또는 MESHY_KEY)가 설정되지 않았습니다");
  return key;
}

export const meshyProvider: ModelProvider = {
  async createImageTo3d(imageDataUri: string): Promise<string> {
    const res = await fetch(`${MESHY_BASE}/image-to-3d`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_url: imageDataUri,
        ai_model: "meshy-6",
        should_texture: true,
        enable_pbr: false,
        topology: "triangle",
        target_polycount: 30000,
        target_formats: ["glb"],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Meshy 생성 요청 실패 (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { result: string };
    return data.result;
  },

  async getTask(taskId: string): Promise<ModelTaskResult> {
    const res = await fetch(`${MESHY_BASE}/image-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${getKey()}` },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Meshy 상태 조회 실패 (${res.status}): ${text}`);
    }
    const data = (await res.json()) as {
      status: ModelStatus;
      progress?: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    return {
      status: data.status,
      progress: data.progress ?? 0,
      glbUrl: data.model_urls?.glb,
      error: data.task_error?.message,
    };
  },
};
