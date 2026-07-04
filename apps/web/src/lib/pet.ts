import { api } from "@/lib/api";

export type Species = "dog" | "cat";

export interface Pet {
  id: string;
  name: string;
  species: Species;
  hasImage: boolean;
}

export const petApi = {
  get: () => api.get<Pet>("/pet"),
  create: (name: string, species: Species) =>
    api.post<Pet>("/pet", { name, species }),

  // 이미지 업로드는 multipart 라 fetch 직접 사용
  uploadImage: async (file: File): Promise<void> => {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/pet/image", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "이미지 업로드에 실패했어요");
    }
  },
};

// 업로드된 이미지 URL (캐시 무효화용 쿼리 붙여 사용)
export const petImageUrl = () => `/api/pet/image`;

// ── 3D 모델 ──
export type ModelStatus = "IN_PROGRESS" | "DONE" | "FAILED";

export interface ModelState {
  status: ModelStatus;
  progress: number;
  hasGlb: boolean;
}

export const modelApi = {
  start: () => api.post<ModelState>("/pet/model"),
  status: () => api.get<ModelState>("/pet/model"),
};

export const petGlbUrl = () => `/api/pet/model/file`;
