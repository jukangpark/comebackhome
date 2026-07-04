# 이미지 → 3D 모델링 파이프라인 R&D / 방향성 결정

> 반려동물(강아지/고양이) 사진 → 3D 모델 → 페르소나 기반 AI 채팅 웹앱
> 기술 스택: React + TS + Rspack + Express + PostgreSQL
> 작성일: 2026-07-03

---

## ✅ 확정 사항 (결정됨)

- **이미지 → 3D 변환 엔진: Meshy (image-to-3D, `ai_model: meshy-6`) 로 확정.**
- 연동 방식: **REST API 직접 호출** (MCP 서버는 로컬 실험용에만, 프로덕션 미사용).
- 출력 포맷: **GLB** 단일. three.js/R3F로 렌더.
- API 키: Pro($10/월) 필요. 개발/검증은 **테스트 더미 키**로 무료 진행.
- 상세 API 스펙: **[meshy-image-to-3d-api.md](./meshy-image-to-3d-api.md)** 참조.
- Tripo/Rodin/오픈소스는 **품질 비교 후보 / 벤더 교체 대비용**으로만 유지 (아래 표).

---

## ⚠️ 대전제: `claude -p`는 3D 메시를 "생성"하지 못한다

R&D의 출발점이자 가장 중요한 사실.

Claude(headless 포함)는 **이미지 → 3D 지오메트리 변환 모델이 아니다.**
사진에서 실제 mesh(`.glb`/`.obj`)를 뽑아내는 건 전용 image-to-3D 모델
(Meshy 6, Tripo v3, Hunyuan3D, TRELLIS 등)의 몫이다.
Claude에게 "이 강아지 사진으로 3D 모델 만들어줘" 한다고 폴리곤이 나오지 않는다.

그래서 질문을 이렇게 재정의한다:

> ❌ "claude -p로 3D 모델링을 만들려면"
> ✅ "claude -p를 **3D 생성 파이프라인의 오케스트레이터/판단 레이어**로 쓰려면"

### Claude(`claude -p`)가 잘하는 것 = 판단 레이어

- 여러 장 중 **3D 변환에 제일 좋은 사진 선택** (정면 / 조명 / 폐색 여부)
- **종·품종 판별**, 배경 제거 필요 여부 판단
- 3D API 호출 → 폴링 → 결과 mesh **품질 검증** ("강아지 형태 맞아? 다리 4개?")
- 실패 시 **파라미터 바꿔 재시도** 같은 messy한 의사결정
- 결과 메타데이터를 Postgres에 기록

실제 mesh 생성은 **전용 API가 담당**. 이 역할 분담이 핵심.

---



## 추천 아키텍처

3D 생성은 30초~2분 걸리는 **비동기 작업**이라 HTTP 요청/응답 사이클에 못 넣는다.
잡 큐가 필수.

```
[React + R3F]  ──업로드──▶  [Express API]
                                │  jobId 즉시 반환
                                ▼
                        [Job Queue]  ← pg-boss (PostgreSQL 그대로 사용, Redis 불필요)
                                │
                                ▼
                        [Worker 프로세스]
                                │  spawn('claude', ['-p', ...])
                                ▼
                    ┌───── claude -p (headless agent) ─────┐
                    │ 1. 이미지 분석(Claude vision)         │
                    │    → best shot 선택 / 종 판별 / QC    │
                    │ 2. 배경제거 툴 호출(선택)             │
                    │ 3. MCP 툴로 Meshy/Tripo API 호출      │
                    │ 4. 폴링 → .glb 다운로드                │
                    │ 5. 결과 검증 → 불량이면 재시도        │
                    │ 6. structured JSON 반환               │
                    └──────────────────────────────────────┘
                                │
                    .glb → S3/R2,  메타 → Postgres
                                │
                        SSE/폴링으로 프론트에 완료 통지
```

**pg-boss 추천 이유:** 이미 PostgreSQL을 쓰므로 Redis 없이 큐를 그 위에 올릴 수 있다.
MVP 인프라 컴포넌트 하나 감소.

---



## `claude -p` 헤드리스 호출 구조

핵심은 **MCP 툴로 3D API를 감싸고, structured output으로 결과를 강제**하는 것.
Claude가 자유롭게 curl 치게 두지 않는다.

```bash
claude -p "$(cat prompt.txt)" \
  --output-format json \
  --mcp-config ./mcp.json \
  --allowedTools "Read,mcp__meshy__image_to_3d,mcp__meshy__get_task" \
  --permission-mode acceptEdits \
  --max-turns 15
```

- `--output-format json` (진행률 스트리밍 필요 시 `stream-json`) → 워커가 stdout 파싱
- `--mcp-config` → **Meshy 공식 MCP 서버**(`@meshy-ai/meshy-mcp-server`) 사용. 직접 래핑 불필요.
  단, MCP는 **로컬 실험용**만 — 프로덕션은 REST 직접 호출(별도 서버 안 띄움).
- `--allowedTools` **화이트리스트만** → 헤드리스는 프롬프트 없이 자동 승인되므로 툴 제한이 안전장치
- 마지막에 `{ "status", "glbUrl", "species", "confidence", "retries" }` 같은
**고정 스키마**로 반환하게 프롬프트에 명시



### Node 워커 쪽

```ts
const proc = spawn('claude', ['-p', prompt, '--output-format', 'json', ...]);
// stdout 수집 → JSON.parse → result.result 안의 최종 구조화 결과 추출
```

---



## 🔑 핵심 결정: "판단은 Claude, 실행은 코드"

**"3D 생성 파이프라인 전체를 claude -p로 감쌀 것인가?" → 부분적으로만.**


| 레이어               | 담당                | 이유                         |
| ----------------- | ----------------- | -------------------------- |
| 사진 선택·품질검증·재시도 판단 | **claude -p** ✅   | 애매한 판단은 LLM이 강함            |
| 실제 API 호출·폴링·다운로드 | **평범한 Node 코드** ✅ | 결정적(deterministic), 싸고 안정적 |
| mesh 생성           | **전용 3D API** ✅   | Claude 불가능                 |


전부 claude -p 안에 넣으면 **비용↑, 레이턴시↑, 비결정성↑**.
"판단은 Claude, 실행은 코드"로 나누는 게 MVP에 훨씬 낫다.

> 극단적으로는 MVP 1차엔 Claude를 빼고 **순수 Node로 API만 호출**해도 동작한다.
> Claude는 "여러 사진 중 best 고르기"처럼 부가가치가 명확한 지점에만 투입.

---



## 3D API 선택 (2026 기준) — ✅ **Meshy 확정**

강아지/고양이 아바타용. **Meshy로 확정**했고, 나머지는 품질 비교/교체 대비 후보로만 유지:


| API                     | 특징                                                      | 가격                      | 상태 / 비고            |
| ----------------------- | ------------------------------------------------------- | ----------------------- | ------------------ |
| **Meshy 6** ✅ **확정**    | 이미지→3D REST API 가장 성숙. GLB/FBX/USDZ, ~1분. **공식 MCP·SDK** | Pro $10/월 (1,000 크레딧)   | **채택.** 스펙 → [meshy-image-to-3d-api.md](./meshy-image-to-3d-api.md) |
| **Tripo v3**            | 속도(v2.5 25~30초) + 스타일 옵션. 종량제                           | $0.01/크레딧 + 가입 2,000 무료 | 비교 후보 (품질 벤치용)      |
| **Rodin Gen-2**         | 품질 최상급(10B 파라미터)                                        | 프리미엄                    | 퀄 업그레이드 예비         |
| **Hunyuan3D / TRELLIS** | 오픈소스, 셀프호스팅                                             | GPU 비용                  | 물량 커져 API 비용 부담될 때 |




### ⚠️ 채팅 아바타 관련 주의점

정적 mesh만으로는 밋밋하다. 표정/움직임을 원하면:

- 처음부터 **리깅 지원 Meshy**로 가거나
- MVP는 **"회전하는 정적 3D 모델"** 로 시작하고 애니메이션은 2차로 미루는 게 현실적

---



## 단계별 로드맵 (제안)

- **Phase 0 (검증):** 순수 Node → Meshy image-to-3D API 호출 → `.glb` 하나 받아서 R3F로 렌더링. Claude 없이 파이프라인 성립 확인.
- **Phase 1 (비동기화):** pg-boss 잡 큐 + 워커. 업로드 → jobId → 폴링/SSE 완료 통지.
- **Phase 2 (Claude 투입):** 여러 사진 업로드 시 best shot 선택 + 종 판별 + QC를 `claude -p` 판단 레이어로 추가.
- **Phase 3 (품질/애니):** 리깅, 재시도 자동화, 필요 시 Rodin/셀프호스팅으로 품질 업그레이드.

---



## 미결정 / 추가 R&D 필요 항목

- [ ] 애니메이션 범위: 정적 회전 vs 리깅+표정 (MVP 스코프 결정 필요)
- [ ] `.glb` 스토리지: S3 vs Cloudflare R2 (비용/egress)
- [ ] Claude 투입 여부의 실제 ROI — Phase 0에서 순수 Node 품질이 충분하면 Claude 생략 검토
- [ ] 3D API 벤더 락인 대비: 어댑터 인터페이스로 Meshy/Tripo 교체 가능하게 설계

---



## 참고 자료

- **[Meshy Image-to-3D API 공식 문서](https://docs.meshy.ai/en/api/image-to-3d)** ⬅ 채택 API
- [Meshy 공식 MCP 서버 (GitHub)](https://github.com/meshy-dev/meshy-mcp-server)
- [Best 3D Model Generation APIs in 2026 — 3DAI Studio](https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026)
- [3D AI Pricing & Credits Comparison 2026 — Sloyd](https://www.sloyd.ai/blog/3d-ai-price-comparison)
- [TRELLIS vs Meshy vs Tripo vs Hitem3D](https://trellis2.app/blog/best-ai-3d-model-generator)
- 프로젝트 내 문서: [meshy-image-to-3d-api.md](./meshy-image-to-3d-api.md) · [3d-basics-study.md](./3d-basics-study.md)

