# Meshy Image-to-3D API 레퍼런스

> 공식 문서 정리: https://docs.meshy.ai/en/api/image-to-3d
> ✅ **본 프로젝트의 이미지 → 3D 변환은 Meshy(image-to-3D)로 확정.**
> 작성일: 2026-07-03 · 출처 스냅샷 기준 (구현 전 changelog 재확인 권장)

---

## 0. 기본 정보

| 항목 | 값 |
|---|---|
| Base URL | `https://api.meshy.ai` |
| 인증 | `Authorization: Bearer <MESHY_API_KEY>` |
| 테스트 키 | `msy_dummy_api_key_for_test_mode_12345678` (크레딧 소모 없이 흐름 검증) |
| 실행 모델 | **비동기** — 생성 요청 시 task-id만 반환, 이후 폴링/웹훅으로 완료 확인 |
| 우리가 쓸 모델 | `ai_model: "meshy-6"` |
| 우리가 받을 포맷 | `target_formats: ["glb"]` (three.js/R3F용) |

⚠️ **API 키는 Pro($10/월) 이상에서만 발급.** 무료 플랜은 웹앱 전용(API 불가).
개발/연동 검증은 위 테스트 더미 키로 무료 진행 → 진짜 결과 필요 시 Pro 키로 교체.

---

## 1. 엔드포인트 요약

| Method | URL | 용도 |
|---|---|---|
| `POST` | `/openapi/v1/image-to-3d` | **생성 태스크 만들기** |
| `GET` | `/openapi/v1/image-to-3d/:id` | 단일 태스크 조회 (상태/결과) |
| `GET` | `/openapi/v1/image-to-3d` | 태스크 목록 (페이지네이션) |
| `GET` | `/openapi/v1/image-to-3d/:id/stream` | SSE 실시간 진행률 |
| `DELETE` | `/openapi/v1/image-to-3d/:id` | 태스크·에셋 영구 삭제 |

---

## 2. 생성 태스크 — `POST /openapi/v1/image-to-3d`

### 2.1 요청 파라미터 (전체)

`image_url` **또는** `input_task_id` 중 하나 필수. (둘 다 주면 `input_task_id` 우선)

| 파라미터 | 타입 | 기본값 | 허용값 | 설명 |
|---|---|---|---|---|
| `image_url` | string | — | public URL 또는 base64 data URI | 입력 이미지 (.jpg/.jpeg/.png) |
| `input_task_id` | string | — | task UUID | 이전 T2I/I2I 태스크 결과를 입력으로 |
| `ai_model` | string | `latest` | `meshy-5`, `meshy-6`, `latest` | **우리는 `meshy-6`** |
| `model_type` | string | `standard` | `standard`, `lowpoly` | 메시 생성 방식 |
| `should_texture` | boolean | `true` | — | 텍스처 생성 여부 (**우리 true**) |
| `enable_pbr` | boolean | `false` | — | PBR 맵(metallic/roughness/normal/emission) — **우리 false** |
| `hd_texture` | boolean | `false` | — | 4K base color (meshy-6+ 전용) |
| `texture_prompt` | string | — | 최대 600자 | 텍스처 텍스트 가이드 |
| `texture_image_url` | string | — | URL/base64 | 텍스처 이미지 가이드 |
| `should_remesh` | boolean | meshy-6: `false` / 그 외 `true` | — | 리메시 단계 활성화 |
| `topology` | string | `triangle` | `quad`, `triangle` | **웹 렌더는 triangle, 리깅하려면 quad** |
| `target_polycount` | integer | `30000` | 100–300,000 | 목표 폴리곤 수 (**웹 아바타 30k 적정**) |
| `decimation_mode` | int | — | 1,2,3,4 | 적응형 데시메이션 (설정 시 polycount 무시) |
| `save_pre_remeshed_model` | boolean | `false` | — | 리메시 전 메시도 저장 |
| `pose_mode` | string | `""` | `""`, `a-pose`, `t-pose` | 캐릭터 포즈 (동물엔 `""` 권장) |
| `image_enhancement` | boolean | `true` | — | 입력 이미지 자동 보정 (meshy-6+) |
| `remove_lighting` | boolean | `true` | — | 텍스처에서 하이라이트/그림자 제거 (meshy-6+) |
| `moderation` | boolean | `false` | — | 유해 콘텐츠 스크리닝 |
| `target_formats` | string[] | 3mf 제외 전체 | `glb`,`obj`,`fbx`,`stl`,`usdz`,`3mf` | **우리는 `["glb"]`만** |
| `auto_size` | boolean | `false` | — | 실물 크기 추정 후 리사이즈 |
| `origin_at` | string | `bottom` | `bottom`, `center` | `auto_size=true`일 때 원점 위치 |
| `alpha_thumbnail` | boolean | `false` | — | 투명 배경 미리보기 |
| `multi_view_thumbnails` | boolean | `false` | — | 4방향 썸네일 |
| `webhook_url` | string | — | HTTPS URL | 완료 시 콜백 (폴링 대안) |
| ~~`symmetry_mode`~~ | string | `auto` | — | ⚠ deprecated, 효과 없음 |
| ~~`is_a_t_pose`~~ | boolean | `false` | — | ⚠ deprecated, `pose_mode` 사용 |

### 2.2 요청 예시 (우리 프로젝트 기본값)

```json
POST /openapi/v1/image-to-3d
Authorization: Bearer msy-...

{
  "image_url": "https://your-r2.com/uploads/dog123.jpg",
  "ai_model": "meshy-6",
  "should_texture": true,
  "enable_pbr": false,
  "topology": "triangle",
  "target_polycount": 30000,
  "target_formats": ["glb"],
  "webhook_url": "https://yourapp.com/webhooks/meshy"
}
```

### 2.3 응답 (task-id만)

```json
{ "result": "018a210d-8ba4-705c-b111-1f1776f7f578" }
```

---

## 3. 태스크 조회 — `GET /openapi/v1/image-to-3d/:id`

### 전체 응답 스키마

```json
{
  "id": "018a210d-8ba4-705c-b111-1f1776f7f578",
  "type": "image-to-3d",
  "model_urls": {
    "glb": "https://assets.meshy.ai/.../model.glb?Expires=***",
    "fbx": "https://assets.meshy.ai/.../model.fbx?Expires=***",
    "obj": "https://assets.meshy.ai/.../model.obj?Expires=***",
    "mtl": "https://assets.meshy.ai/.../model.mtl?Expires=***",
    "usdz": "https://assets.meshy.ai/.../model.usdz?Expires=***",
    "stl": "https://assets.meshy.ai/.../model.stl?Expires=***",
    "pre_remeshed_glb": "https://assets.meshy.ai/.../pre_remeshed_model.glb?Expires=***"
  },
  "thumbnail_url": "https://assets.meshy.ai/.../preview.png?Expires=***",
  "texture_urls": [
    {
      "base_color": "https://assets.meshy.ai/.../texture_0.png?Expires=***",
      "metallic":   "https://assets.meshy.ai/.../texture_0_metallic.png?Expires=***",
      "normal":     "https://assets.meshy.ai/.../texture_0_normal.png?Expires=***",
      "roughness":  "https://assets.meshy.ai/.../texture_0_roughness.png?Expires=***",
      "emission":   "https://assets.meshy.ai/.../texture_0_emission.png?Expires=***"
    }
  ],
  "progress": 100,
  "status": "SUCCEEDED",
  "created_at": 1692771650657,
  "started_at": 1692771667037,
  "finished_at": 1692771669037,
  "expires_at": 1692771679037,
  "preceding_tasks": 0,
  "consumed_credits": 30,
  "task_error": { "message": "" }
}
```

### 주요 필드

| 필드 | 설명 |
|---|---|
| `model_urls.glb` | ⬅ **우리가 받을 것.** 단 URL에 `?Expires=` — 만료됨 |
| `thumbnail_url` | 정면 512×512 미리보기 |
| `texture_urls[]` | 텍스처 맵. base_color 필수, PBR 켜면 나머지 |
| `progress` | 0–100 (%). 진행률 바에 사용 |
| `status` | 상태 enum (아래) |
| `expires_at` | ⚠️ **에셋 만료 시각** — 반드시 내 스토리지로 복사 |
| `preceding_tasks` | 큐 대기 깊이 (PENDING일 때만 의미) |
| `consumed_credits` | 소모 크레딧 (실패 시 0) |
| `task_error.message` | 실패 사유 |

### 상태 enum

`PENDING` → `IN_PROGRESS` → `SUCCEEDED` | `FAILED` | `CANCELED`

---

## 4. 목록 조회 — `GET /openapi/v1/image-to-3d`

쿼리: `page_num`(기본1), `page_size`(기본10, 최대50), `sort_by`(`+created_at`|`-created_at`)

```bash
GET /openapi/v1/image-to-3d?page_size=10&sort_by=-created_at
```

---

## 5. 크레딧 비용

| 항목 | 비용 |
|---|---|
| 기본 image-to-3D 생성 | **30 크레딧** |
| 텍스처 가이드(텍스트/이미지) 추가 | +10 크레딧 |
| **실패한 태스크** | 전액 환불 |

> Pro($10/월) = 1,000 크레딧 ≈ **image-to-3D 약 33회/월**.

---

## 6. ⚠️ 구현 시 반드시 기억할 3가지

1. **에셋은 만료된다** (`expires_at`, `?Expires=` URL). webhook/폴링으로 `SUCCEEDED` 받으면
   **즉시 glb를 다운로드해서 우리 S3/R2로 복사**. 프론트가 Meshy URL 직접 참조 ❌
2. **입력 이미지는 public URL 권장.** 사용자 업로드 → 먼저 우리 스토리지에 올려 URL 확보 → `image_url`로 전달.
3. **완료 확인은 webhook(프로덕션) 또는 폴링/SSE(개발·진행률바).** 요청/응답 안에서 기다리지 말 것(30초~2분 소요).

---

## 7. 최소 연동 코드 (REST 직접 호출, MCP 불필요)

```ts
// 생성
const { result: taskId } = await fetch(
  "https://api.meshy.ai/openapi/v1/image-to-3d",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_url: publicImageUrl,
      ai_model: "meshy-6",
      should_texture: true,
      enable_pbr: false,
      topology: "triangle",
      target_polycount: 30000,
      target_formats: ["glb"],
      webhook_url: `${process.env.APP_URL}/webhooks/meshy`,
    }),
  }
).then((r) => r.json());

// 조회 (폴링 시)
const task = await fetch(
  `https://api.meshy.ai/openapi/v1/image-to-3d/${taskId}`,
  { headers: { Authorization: `Bearer ${process.env.MESHY_API_KEY}` } }
).then((r) => r.json());
// task.status, task.progress, task.model_urls.glb
```

---

## 관련 문서
- 방향성/아키텍처: [3d-modeling-rnd.md](./3d-modeling-rnd.md)
- 3D 기초 개념: [3d-basics-study.md](./3d-basics-study.md)
- 공식 원문: https://docs.meshy.ai/en/api/image-to-3d
