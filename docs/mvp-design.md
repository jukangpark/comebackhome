# 반려동물 3D 채팅 웹앱 — MVP 설계 문서

> "우리 강아지/고양이를 3D로 만들고, 그 아이의 페르소나로 대화한다."
> 작성일: 2026-07-04 · 상태: 설계 확정 대기 (구현 전 최종 리뷰용)

---

## 0. 확정된 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|---|---|
| 채팅 AI | **Claude 헤드리스(`claude -p`) + 구독 요금제 + Opus 4.8** (API 키 아님, 토큰 과금 X) |
| 이미지→3D | **Meshy image-to-3D (meshy-6)**, 이미 결제됨. 키는 추후 주입 |
| 인증 | **아이디 + 비밀번호**만 (소셜 로그인 없음) |
| 배포 | **Docker Compose** → 로컬 Mac에서 먼저 기동·테스트 → 홈서버(`jukang@100.64.183.104`) 배포 |
| Meshy 연동 방식 | **base64 이미지 전송 + 폴링** (로컬/프로덕션 모두 동작, public URL·webhook 불필요) |
| 스택 | React + TS + Rspack (web) / Express + TS (api) / PostgreSQL (db) |
| **펫 수** | **유저당 1마리 고정** (1:1) |
| **이미지 업로드** | **1장만** (대표 이미지) |
| **UI** | **모바일 퍼스트 반응형** — 스마트폰 레이아웃 기준으로 먼저 제작 |

관련 문서: [meshy-image-to-3d-api.md](./meshy-image-to-3d-api.md) · [3d-modeling-rnd.md](./3d-modeling-rnd.md) · [3d-basics-study.md](./3d-basics-study.md)

---

## 1. MVP 스코프

### 포함 (MVP)
1. 아이디/비밀번호 **회원가입·로그인**
2. 반려동물 **이름 + 종(강아지/고양이) 등록** (유저당 1마리)
3. **이미지 업로드** (딱 1장, 대표 이미지)
4. **Meshy로 3D 모델 생성** (비동기, 진행률 표시)
5. **페르소나 작성** (성격 + 함께한 추억/에피소드)
6. 생성된 **3D 모델 뷰어** (R3F, 회전 가능)
7. 페르소나 기반 **채팅** (Claude 헤드리스가 그 아이처럼 답변)

### 제외 (MVP 이후)
- 동물 리깅/애니메이션 (정적 모델 + 카메라 회전으로 대체)
- 소셜 로그인, 비밀번호 찾기(이메일), 결제
- 다중 이미지 기반 정교화, 모델 재생성 UI
- 실시간 스트리밍 채팅(타이핑 효과) — MVP는 요청/응답
- 음성, 공유 기능

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│  브라우저 (React + TS + Rspack)                                    │
│  - 회원가입/로그인 · 펫 등록 · 이미지 업로드                        │
│  - 3D 뷰어(R3F) · 페르소나 폼 · 채팅 UI                             │
└───────────────┬─────────────────────────────────────────────────┘
                │  REST (JSON) + httpOnly 쿠키(JWT)
                ▼
┌─────────────────────────────────────────────────────────────────┐
│  API 서버 (Express + TS)                                          │
│  ├─ Auth   : 가입/로그인/세션                                      │
│  ├─ Pets   : 펫 CRUD, 이미지 업로드                                │
│  ├─ Models : Meshy 생성 요청/상태 조회                             │
│  ├─ Persona: 페르소나 저장/조회                                    │
│  ├─ Chat   : 메시지 저장 + claude -p 호출로 답변 생성              │
│  └─ Worker : 3D 생성 잡 폴링 (pg-boss)                            │
└───┬───────────────┬───────────────────┬────────────────┬─────────┘
    │               │                   │                │
    ▼               ▼                   ▼                ▼
┌────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│Postgres│   │ 파일 볼륨      │   │ Meshy REST   │   │ claude -p     │
│(데이터) │   │ uploads/models│   │ API (외부)   │   │ (구독/Opus4.8)│
└────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

**핵심 설계 원칙 (기존 R&D 계승):**
- **"판단·대화는 Claude, 실행은 코드"** — Meshy 호출·폴링·다운로드는 결정적 Node 코드. Claude는 채팅 답변 생성에만.
- **외부 의존성은 어댑터 뒤로** — `ChatProvider`, `ModelProvider` 인터페이스로 감싸 교체 가능하게(Claude→API, Meshy→Tripo 등).

---

## 3. 핵심 플로우

### 3.1 사용자 여정 (전체)
```
회원가입 → 로그인 → [펫 생성] 이름·종 입력
   → 이미지 업로드 → "3D 생성 중..."(폴링, 30초~2분)
   → 3D 모델 완성 뷰어 → 페르소나 작성(성격 + 추억)
   → 채팅방 입장 → 그 아이와 대화
```

### 3.2 3D 생성 플로우 (base64 + 폴링)
```
[프론트] 이미지 업로드 ──▶ [API] 파일 볼륨 저장
                              │  이미지를 base64 data URI로 변환
                              │  POST Meshy image-to-3d
                              │    { image_url: "data:image/png;base64,...",
                              │      ai_model:"meshy-6", target_formats:["glb"] }
                              │◀── { result: taskId }
                              │  pet_models INSERT (status=IN_PROGRESS, taskId)
                              │  pg-boss 잡 등록
[프론트] 상태 폴링(2~3초) ◀──┤
                              ▼
                        [Worker] 5~10초마다 GET meshy/:taskId
                              │  status=SUCCEEDED?
                              │    → model_urls.glb 다운로드 → 볼륨 저장
                              │    → pet_models UPDATE (status=DONE, glb_path)
                              ▼
[프론트] status=DONE 감지 ──▶ R3F로 /files/models/xxx.glb 렌더
```
> **왜 base64인가:** 로컬 Mac Docker에서 테스트할 때 Meshy가 `localhost`를 못 가져온다. base64로 이미지를 요청 본문에 직접 실으면 **public URL이 필요 없다.** 로컬·프로덕션 동일 코드.
> **왜 폴링인가:** 같은 이유로 로컬엔 인바운드 webhook을 받을 수 없다. 폴링이면 어디서든 동작. (프로덕션에서 webhook으로 최적화는 이후 선택)

### 3.3 채팅 플로우 (Claude 헤드리스)
```
[프론트] 사용자 메시지 전송 ──▶ [API /chat]
                                  │  1. chat_messages INSERT (role=user)
                                  │  2. 프롬프트 조립:
                                  │     - system: 페르소나(성격+추억+말투)
                                  │     - 최근 대화 N턴(컨텍스트)
                                  │     - 이번 사용자 메시지
                                  │  3. spawn: claude -p
                                  │       --model claude-opus-4-8
                                  │       --append-system-prompt <persona>
                                  │       --output-format json
                                  │       --max-turns 1  (툴 사용 금지, 순수 답변)
                                  │  4. stdout JSON 파싱 → 답변 텍스트
                                  │  5. chat_messages INSERT (role=pet)
[프론트] 답변 표시 ◀──────────────┤  6. 답변 반환
```

---

## 4. Claude 헤드리스 채팅 상세 설계

이 프로젝트에서 **가장 비정형적인 부분**이라 따로 정리.

### 4.1 왜 API가 아니라 `claude -p`인가
- 사용자가 **Claude 구독 요금제**를 이미 쓰고 있어 **토큰 과금 없이** 채팅을 돌릴 수 있음.
- 트레이드오프(반드시 인지):
  - **레이턴시**: 프로세스 spawn 오버헤드로 메시지당 수 초. (API 직접 호출보다 느림)
  - **동시성**: 구독은 동시 실행/사용량 한도가 있어 대량 트래픽엔 부적합. **MVP·개인용엔 충분.**
  - **완화책**: `ChatProvider` 인터페이스로 추상화 → 트래픽 커지면 Anthropic API 구현체로 무중단 교체.

### 4.2 프롬프트 조립 규칙
- **system(append-system-prompt)**: "너는 '{이름}'이라는 {종}이다. 성격: {traits}. 주인과의 추억: {memories}. 항상 그 아이의 말투와 관점으로, 짧고 사랑스럽게 답한다. 사람이 아닌 반려동물임을 유지한다." + 안전 가이드(폭력/민감주제 회피).
- **history**: 최근 N턴(예: 12메시지)만 프롬프트에 포함(비용/길이 관리). 그 이전은 요약 or 생략.
- **user**: 이번 입력.

### 4.3 호출 방식
```ts
const proc = spawn("claude", [
  "-p", userTurnBlock,                 // 최근 히스토리 + 이번 메시지
  "--model", "claude-opus-4-8",
  "--append-system-prompt", personaSystemPrompt,
  "--output-format", "json",
  "--max-turns", "1",
  "--allowedTools", "",                // 툴 전면 금지(순수 텍스트 생성)
], { env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN } });
// stdout 수집 → JSON.parse → .result(최종 답변 텍스트)
```
- **타임아웃/재시도**: 20~30초 타임아웃, 실패 시 1회 재시도 후 "지금 낮잠 자나봐요 💤" 폴백.
- **동시 실행 상한**: 간단한 세마포어로 동시 claude 프로세스 수 제한(예: 2~3).

### 4.4 ⚠️ Docker 안에서 claude 인증 (배포 핵심 이슈)
- 컨테이너 이미지에 **Claude Code CLI 설치** 필요.
- 구독 인증은 **OAuth 토큰**으로: 로컬 Mac에서 `claude setup-token` 실행 → 발급된 토큰을 **`CLAUDE_CODE_OAUTH_TOKEN` 환경변수**로 컨테이너에 주입.
- 이 토큰을 `.env`(git 제외)로 관리, compose에서 api 서비스에 전달.
- → **미결 항목**: 토큰 만료 주기/갱신 방법은 구현 단계에서 검증 필요(아래 9장).

---

## 5. 데이터 모델 (PostgreSQL)

```sql
-- 사용자
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text UNIQUE NOT NULL,
  password_hash text NOT NULL,          -- bcrypt
  created_at    timestamptz DEFAULT now()
);

-- 반려동물 (유저당 1마리 → user_id UNIQUE)
CREATE TABLE pets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  species    text NOT NULL CHECK (species IN ('dog','cat')),
  created_at timestamptz DEFAULT now()
);

-- 업로드 이미지
CREATE TABLE pet_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id     uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  file_path  text NOT NULL,             -- 볼륨 내 경로
  is_primary boolean DEFAULT false,     -- 3D 변환에 쓴 대표 이미지
  created_at timestamptz DEFAULT now()
);

-- 3D 모델 생성 잡/결과
CREATE TABLE pet_models (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id         uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  meshy_task_id  text UNIQUE,
  status         text NOT NULL DEFAULT 'IN_PROGRESS',  -- IN_PROGRESS|DONE|FAILED
  progress       int  DEFAULT 0,
  glb_path       text,                  -- 다운로드 저장 경로
  thumbnail_path text,
  error          text,
  created_at     timestamptz DEFAULT now()
);

-- 페르소나 (펫 1:1)
CREATE TABLE personas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id      uuid UNIQUE NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  traits      text,                     -- 성격(자유서술 또는 태그)
  memories    text,                     -- 함께한 일/추억
  speaking    text,                     -- 말투(선택)
  updated_at  timestamptz DEFAULT now()
);

-- 채팅 메시지
CREATE TABLE chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id     uuid NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','pet')),
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_chat_pet_time ON chat_messages(pet_id, created_at);
```
> **유저 1 : 펫 1** (user_id UNIQUE). 펫 1마리 = 이미지 1 + 모델 1 + 페르소나 1 + 채팅 N.
> pet_images는 1행만 존재(1장 제약) — is_primary는 사실상 항상 true.

---

## 6. API 엔드포인트 (REST)

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| POST | `/api/auth/register` | 회원가입(username, password) | — |
| POST | `/api/auth/login` | 로그인 → httpOnly 쿠키 | — |
| POST | `/api/auth/logout` | 로그아웃 | ✅ |
| GET | `/api/auth/me` | 현재 사용자 | ✅ |
| GET | `/api/pets` | 내 펫 목록 | ✅ |
| POST | `/api/pets` | 펫 생성(name, species) | ✅ |
| GET | `/api/pets/:id` | 펫 상세(모델·페르소나 포함) | ✅ |
| POST | `/api/pets/:id/images` | 이미지 업로드(multipart) | ✅ |
| POST | `/api/pets/:id/model` | 3D 생성 시작(대표 이미지로) | ✅ |
| GET | `/api/pets/:id/model` | 3D 생성 상태/결과 폴링 | ✅ |
| PUT | `/api/pets/:id/persona` | 페르소나 저장 | ✅ |
| GET | `/api/pets/:id/messages` | 채팅 이력 | ✅ |
| POST | `/api/pets/:id/messages` | 메시지 전송 → 펫 답변 | ✅ |
| GET | `/files/models/:file` | glb 정적 서빙 | ✅(소유 확인) |

- **인증 방식**: 로그인 시 JWT를 **httpOnly + SameSite 쿠키**로. 미들웨어로 검증. bcrypt로 비번 해시.
- **소유권 체크**: 모든 `/pets/:id` 라우트에서 `pet.user_id === req.userId` 검증.
- **단일 펫 단순화(권장)**: 유저당 1마리라 `:id` 없이 `/api/pet`, `/api/pet/model`, `/api/pet/persona`, `/api/pet/messages`로 두고 서버가 `req.userId`의 펫을 자동 특정해도 됨. (위 표의 `:id`형과 택1 — 구현 시 단수형 채택 권장)
- **가입 직후**: 펫 없음 → 프론트가 `/onboarding`으로 유도. 이미 있으면 재생성 대신 조회.

---

## 7. 프론트엔드 구조 (React + TS + Rspack)

### 📱 UI 원칙: 모바일 퍼스트 반응형
- **모든 화면을 스마트폰 세로 레이아웃(약 375~430px 폭) 기준으로 먼저 제작.**
- 데스크톱은 이후 확장: 중앙 정렬 + `max-width`(예: 480px)로 모바일 뷰를 가운데 배치하거나, 미디어 쿼리로 넓은 화면 대응.
- 터치 타깃 최소 44px, 하단 고정 입력창(채팅), 세로 스크롤 중심.
- 단위: `rem`/`%`/`vw`, `max-width:100%` 이미지. 가로 스크롤 금지.
- **유저당 1마리**라 화면 흐름이 단선형(위저드) → 온보딩처럼 순차 진행.

### 라우팅(페이지) — 단일 펫 전제
```
/login       로그인
/register    회원가입
/            홈: 펫 없으면 온보딩으로, 있으면 펫 홈으로 리다이렉트
/onboarding  펫 생성(이름·종) → 이미지 1장 업로드 → 3D 생성 진행(폴링) → 페르소나 작성
             (한 흐름의 스텝 위저드로 구성; 단계별 컴포넌트 전환)
/pet         펫 홈: 3D 뷰어 + 채팅 진입 버튼
/chat        채팅방
```
> `:id`가 URL에 필요 없음 — 로그인 유저의 유일한 펫을 서버가 `req.userId`로 특정.
> API도 `/api/pet`(단수)로 단순화 가능(아래 6장 라우트를 단수형으로 매핑).

### 핵심 컴포넌트
- `OnboardingWizard` — 생성→업로드→생성대기→페르소나를 스텝으로 묶은 단선 플로우.
- `PetViewer` — R3F `<Canvas>` + `useGLTF` + `<OrbitControls>`. glb 로드/회전. 모바일에서 화면 상단 절반 차지.
- `ModelProgress` — 폴링 상태(스피너 + %), 귀여운 대기 문구.
- `PersonaForm` — 성격/추억/말투 입력.
- `ChatRoom` — 메시지 리스트(스크롤) + **하단 고정 입력창**, 전송 중 로딩.

### UI 라이브러리: shadcn/ui + Tailwind (확정)
- **shadcn/ui** 사용. 컴포넌트를 레포로 복사해오는 방식(종속성 아님) + **Tailwind CSS** 필수.
- ⚠️ **Rspack은 shadcn CLI가 자동 감지 못 함** → `components.json` + 경로 별칭(`@/components` 등)을 **수동 설정**. (P0에서 처리)
- **채팅 UI는 2026-06 chat 컴포넌트 사용** (사용자 지정):
  | 컴포넌트 | 역할 |
  |---|---|
  | `MessageScroller` | 스크롤 동작(앵커/스트리밍/이력 복원/점프) |
  | `Message` | 아바타·정렬·헤더·본문·푸터 행 배치 |
  | `Bubble` | 말풍선 표면(변형·정렬·리액션·링크·접기) |
  | `Attachment` | 파일/이미지 첨부 표시(업로드 상태 등) |
  | `Marker` | 상태/시스템 노트·날짜 구분선(스트리밍 상태) |
  - 설치: `pnpm dlx shadcn@latest add message-scroller message bubble attachment marker`
  - 유틸: `scroll-fade`(가장자리 페이드), `shimmer`(라이브 상태 반짝임)
  - 참고: https://ui.shadcn.com/docs/changelog/2026-06-chat-components

### 상태/통신
- 데이터 패칭: TanStack Query(폴링 편함) 권장 — 3D 상태·채팅에 유용.
- 폼: 가벼운 로컬 state 또는 react-hook-form.
- 3D: `three`, `@react-three/fiber`, `@react-three/drei`.
- 스타일: **모바일 퍼스트 + Tailwind**. 컨테이너 `max-width`(480px)로 데스크톱 중앙 정렬.

---

## 8. Docker & 배포

### 8.1 구성 (docker-compose)
```
services:
  web    : React 빌드 정적 파일 서빙(nginx) — 프론트
  api    : Express + Claude CLI 포함 이미지 — 백엔드
  db     : postgres:16 — 데이터
volumes:
  pgdata      : DB 영속화
  media       : uploads/ + models/ (이미지·glb)
```
- **api 이미지**: Node + **Claude Code CLI 설치** + `CLAUDE_CODE_OAUTH_TOKEN` 주입.
- **환경변수(.env, git 제외)**: `MESHY_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `JWT_SECRET`, `POSTGRES_*`, `DATABASE_URL`.
- **미디어 저장**: 로컬 볼륨(`media`)에 `uploads/`, `models/`. api가 정적 서빙.

### 8.2 로컬 → 홈서버 흐름
```
[로컬 Mac] docker compose up  → localhost에서 전체 기능 테스트
   ↓ 검증 완료
[홈서버] Tailscale로 접속(jukang@100.64.183.104)
   → 코드 전송(git 또는 rsync) → .env 세팅 → docker compose up -d
   → nginx 리버스 프록시 뒤에 배치
```
> ⚠️ **CLAUDE.md 규칙 준수**: 홈서버 nginx에 새 `listen 80` 블록 추가 시 반드시 고유 `server_name` 부여, `default_server` 절대 금지(강이봇 라우팅 보호). 이 앱은 별도 `server_name`(예: `pet.local` 또는 경로 프리픽스)으로 노출.

---

## 9. 미결 항목 / 리스크 (구현 중 검증)

| # | 항목 | 왜 중요 | 대응 |
|---|---|---|---|
| 1 | **CLAUDE_CODE_OAUTH_TOKEN 만료** | 만료되면 채팅 전면 중단 | `claude setup-token` 갱신 주기 확인, 만료 알림/헬스체크 |
| 2 | claude -p **동시성/속도** | 다중 사용자 채팅 시 병목 | 세마포어 제한 + 필요 시 API 어댑터 전환 |
| 3 | Meshy **base64 이미지 크기 한도** | 큰 원본 업로드 시 실패 가능 | 업로드 시 리사이즈(예: 장변 1024px)·압축 |
| 4 | **동물 리깅 불가** | 정적 모델뿐 | MVP는 정적+회전으로 확정, 애니는 별도 R&D |
| 5 | Meshy 에셋 **만료(expires_at)** | glb URL 곧 죽음 | SUCCEEDED 즉시 볼륨으로 다운로드(설계 반영됨) |
| 6 | 채팅 **페르소나 주입 안전성** | 프롬프트 인젝션/이탈 | system 고정 지침 + 사용자 입력 분리 |

---

## 10. 구현 단계 (제안)

- **P0 — 뼈대**: 모노레포 + Docker Compose(web/api/db) 기동, 헬스체크. (`docker compose up`으로 3개 뜨는 것 확인)
- **P1 — 인증**: 회원가입/로그인/세션, 보호 라우트.
- **P2 — 펫 & 업로드**: 펫 생성, 이미지 업로드(리사이즈), 볼륨 저장.
- **P3 — 3D 생성**: Meshy 연동(base64+폴링) + pg-boss 워커 + 진행률 UI + R3F 뷰어.
- **P4 — 페르소나**: 폼 + 저장.
- **P5 — 채팅**: claude -p 연동(Docker 인증 포함) + 채팅 UI + 이력.
- **P6 — 마감**: 소유권/에러 처리, 로컬 E2E 점검 → 홈서버 배포.

> 각 P마다 "로컬 Docker에서 동작 확인"을 완료 기준으로.

---

## 11. 제안 디렉터리 구조
```
combackhome/
├─ docker-compose.yml
├─ .env                      # git 제외 (MESHY_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, JWT_SECRET...)
├─ ssh.env                   # 기존
├─ docs/                     # 설계·R&D 문서
├─ apps/
│  ├─ web/                   # React + TS + Rspack
│  │  ├─ rspack.config.ts
│  │  └─ src/{pages,components,api,three}/
│  └─ api/                   # Express + TS
│     ├─ Dockerfile          # Node + Claude CLI
│     └─ src/{routes,services,workers,db,middleware}/
│        ├─ services/chatProvider.ts   # claude -p 어댑터
│        └─ services/modelProvider.ts  # Meshy 어댑터
└─ packages/
   └─ shared/                # 공용 타입(선택)
```

---

## 부록: 확정/대기 상태
- ✅ 유저당 펫 **1마리 고정** (확정)
- ✅ 이미지 업로드 **1장만** (확정)
- ✅ UI **모바일 퍼스트 반응형** (확정)
- ⏳ 채팅 히스토리 컨텍스트 길이(최근 몇 턴 주입)? — **기본 12턴**으로 진행, 이후 조정
