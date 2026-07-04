# CLAUDE.md — combackhome 프로젝트 가이드

> 반려동물(강아지/고양이) 사진 → **3D 모델** → **페르소나** → 그 아이처럼 답하는 **AI 채팅** 웹앱.
> "다시 만난 우리 아이와 대화해요." · 개인/MVP 규모.
> 이 파일은 새 세션이 프로젝트 전체를 빠르게 파악하기 위한 문서다.

---

## 1. 제품 한눈에

사용자 흐름(단선 온보딩 위저드):
```
회원가입 → 로그인 → 펫 등록(이름·종) → 사진 1장 업로드
   → 3D 생성(Meshy, 진행률) → 페르소나 작성(성격·추억·말투)
   → 홈(3D 뷰어) → 채팅(그 아이처럼 대답)
```
- **유저 1 : 펫 1** (고정). 이미지 1장. **모바일 퍼스트** UI.

---

## 2. 기술 스택

| 영역 | 스택 |
|---|---|
| 모노레포 | **pnpm workspace** (`apps/*`, `packages/*`), **pnpm@9.15.9 고정** |
| 프론트 `apps/web` | React 19 + TS + **Vite** + **Tailwind v4** + **shadcn/ui**(new-york) + react-router 7 + three/R3F/drei |
| 백엔드 `apps/api` | Express 4 + TS + **tsx**(빌드 없이 실행) |
| DB | PostgreSQL 16 |
| 배포 | **Docker Compose** (web/api/db) |
| 3D 생성 | **Meshy** image-to-3D (meshy-6) |
| 채팅 AI | **Claude 헤드리스**(`claude -p`, 구독, Opus 4.8) |

포트: **web 5173**(nginx→80 매핑), api 4000·db 5432(컨테이너 내부, 미공개).

---

## 3. 실행 / 개발

```bash
# 전체 기동 (권장: 코드 바꿨으면 항상 --build)
docker compose up -d --build
# 개별 재빌드
docker compose up -d --build web    # 프론트 바꿨을 때
docker compose up -d --build api    # 백엔드 바꿨을 때
docker compose logs -f api          # 로그
docker compose down                 # 정지

# 타입체크 (커밋 전 필수)
pnpm --filter web typecheck
pnpm --filter api typecheck
```
접속: http://localhost:5173

> ⚠️ **stale 주의**: 프론트만 고치고 api만 재빌드하면 브라우저에 옛 UI가 남는다. 코드 변경 후엔 `docker compose up -d --build`로 **둘 다** 재빌드하거나 해당 서비스를 명시.

---

## 4. 디렉터리 구조

```
combackhome/
├─ docker-compose.yml        # web/api/db + pgdata·media 볼륨
├─ .env                      # 시크릿 (gitignore) — 아래 5장
├─ ssh.env                   # 홈서버 접속정보 (gitignore)
├─ CLAUDE.md                 # 이 파일
├─ docs/                     # 설계·R&D 문서 (아래 8장)
├─ examples/                 # Meshy 3D 수동 테스트 (example.html + *.glb=gitignore)
├─ apps/
│  ├─ web/                   # React+Vite
│  │  ├─ src/pages/          # Login, Register, Onboarding, Home, Persona, Chat
│  │  ├─ src/components/      # PetViewer(R3F), GenerateStep, PersonaForm, CredentialsForm, ui/(shadcn)
│  │  ├─ src/auth/AuthContext.tsx
│  │  ├─ src/lib/{api,pet}.ts # 쿠키 fetch 클라이언트 / 펫·모델·채팅 API
│  │  └─ src/styles/theme.css # 🎨 색상 토큰 전부 여기 (여기서만 색 변경)
│  └─ api/                   # Express
│     ├─ Dockerfile          # node:22-slim + claude CLI(npm) 설치
│     └─ src/
│        ├─ index.ts         # 부팅: ensureMediaDirs → migrate → startModelPoller → listen
│        ├─ db.ts            # pg 풀 + SQL 마이그레이션 러너
│        ├─ migrations/*.sql # 001_users ~ 005_chat_messages (부팅 시 순서 적용)
│        ├─ routes/{auth,pet}.ts
│        ├─ middleware/auth.ts
│        ├─ workers/modelPoller.ts   # Meshy 폴링 → glb 다운로드
│        └─ lib/{auth,validation,media,meshy,claude}.ts
└─ packages/shared/          # (예약, 미사용)
```

---

## 5. 환경 변수 (`.env`, gitignore — 절대 커밋 금지)

```
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / DATABASE_URL
JWT_SECRET
MESHY_KEY=msy_...                  # Meshy API 키 (코드는 MESHY_API_KEY||MESHY_KEY 순으로 읽음)
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...   # 채팅용. `claude setup-token`으로 발급
```
- **`CLAUDE_CODE_OAUTH_TOKEN`**: 이름 정확히 이것. `claude setup-token`(맥/서버에서 실행, 브라우저 승인) → 장수 토큰. 기기 무관(계정 귀속)이라 로컬·홈서버 동일 값 사용.
- `ssh.env`: `homeserver=jukang@100.64.183.104`, `password=...` (홈서버, Tailscale).

---

## 6. 데이터 모델 (Postgres)

- `users` (username UNIQUE, password_hash=bcrypt)
- `pets` (**user_id UNIQUE** → 유저당 1마리, name, species dog|cat)
- `pet_images` (**pet_id UNIQUE** → 1장, file_path)
- `pet_models` (**pet_id UNIQUE**, meshy_task_id, status IN_PROGRESS|DONE|FAILED, progress, glb_path)
- `personas` (**pet_id UNIQUE**, traits 성격, memories 추억, speaking 말투)
- `chat_messages` (pet_id, role user|pet, content, created_at)
- 마이그레이션은 **원시 SQL 파일**, `schema_migrations`로 추적하며 부팅 시 자동 적용.

---

## 7. 핵심 동작 & 외부 연동

### 인증
JWT를 **httpOnly 쿠키**(SameSite lax, 7일). `requireAuth` 미들웨어 → `req.userId`. 모든 `/api/pet*`는 인증 필요 + 본인 펫만.

### 3D 생성 (Meshy)
- 흐름: 업로드 이미지 → **base64 data URI** → `POST /openapi/v1/image-to-3d`(meshy-6, glb, triangle, 30k, pbr off) → taskId 저장(IN_PROGRESS).
- **폴러**(`workers/modelPoller.ts`, 6초, DB 기반): IN_PROGRESS 행을 매 틱 재조회 → Meshy 폴링 → SUCCEEDED면 glb를 **미디어 볼륨(`models/<petId>.glb`)에 다운로드** → DONE. (pg-boss 대신 인터벌 폴러; 재시작 안전, 타임아웃 10분)
- **왜 base64+폴링**: 로컬 맥 Docker에서 Meshy가 localhost를 못 가져오고 webhook도 못 받음 → 이 방식이면 로컬·프로덕션 동일 코드.
- 어댑터: `lib/meshy.ts`의 `ModelProvider` 인터페이스 뒤 → 나중에 Tripo 등 교체 가능.

### 채팅 (Claude 헤드리스)
- `lib/claude.ts`의 `ChatProvider`가 **`claude -p` 서브프로세스** 실행:
  - `--model claude-opus-4-8 --append-system-prompt <페르소나> --output-format json --max-turns 1`
  - 페르소나=시스템프롬프트, **최근 12턴+새 메시지**=prompt, `.result` 파싱.
  - 동시성 세마포어 3, 40s 타임아웃, 실패 시 폴백 문구 저장.
- 인증은 컨테이너 런타임의 `CLAUDE_CODE_OAUTH_TOKEN`(구독). **API 토큰 과금 없음.**
- 어댑터 뒤라 트래픽 커지면 Anthropic API 구현체로 교체 가능.

### 미디어
Docker 볼륨 `media`에 `uploads/`(원본 리사이즈 jpeg) + `models/`(glb). api가 소유자 확인 후 서빙(`/api/pet/image`, `/api/pet/model/file`).

### 주요 API 엔드포인트
`/api/auth/{register,login,logout,me}` · `/api/pet`(GET/POST) · `/api/pet/image`(POST/GET) · `/api/pet/model`(POST/GET) + `/model/file` · `/api/pet/persona`(GET/PUT) · `/api/pet/messages`(GET/POST)

---

## 8. 문서 (`docs/`)

| 파일 | 내용 |
|---|---|
| `mvp-design.md` | 전체 설계(아키텍처·DB·API·배포). **가장 중요** |
| `deploy-homeserver.md` | 홈서버 배포 절차·nginx·트러블슈팅 (⚠️ gitignore, 로컬 전용) |
| `meshy-image-to-3d-api.md` | Meshy API 레퍼런스 |
| `3d-modeling-rnd.md` | 3D 방향성 R&D (Meshy 확정 근거) |
| `3d-basics-study.md` | 3D 기초 개념 학습노트 |

---

## 9. 현재 상태

- **기능 완성**: 로컬 맥 Docker에서 **가입 → 펫 등록 → 3D 생성 → 페르소나 → 실제 대화** 전 구간 동작 확인됨(채팅은 토큰 주입 후 컨테이너 실답변 검증 완료).
- **남은 작업**: 홈서버 배포(프로덕션 compose/env 정리 → 배포 → nginx 리버스 프록시 → 스모크 테스트). 재배포 스크립트 `deploy/homeserver/deploy.sh`, 상세 절차는 로컬 전용 `docs/deploy-homeserver.md`.

---

## 10. 배포 (홈서버)

- 타깃: `jukang@100.64.183.104` (Tailscale). Docker 29 / Compose v5 설치됨. claude 네이티브 + **Max 구독(5x)** 로그인됨.
- 방식: git/rsync로 코드 전송 → `.env`(MESHY_KEY, CLAUDE_CODE_OAUTH_TOKEN, JWT_SECRET 등) 세팅 → `docker compose up -d --build`.
- ⚠️ **nginx 규칙(반드시 준수)**: 홈서버 nginx에 새 `listen 80` 블록 추가 시 **고유 `server_name` 부여, `default_server` 금지.** 강이봇(chatbot)이 `listen 80 default_server`로 Iris 메시지를 받고 있어, 이걸 가로채면 강이봇 메시지가 전량 유실된다. (사용자 글로벌 CLAUDE.md 규칙)

---

## 11. 작업 규칙 / 함정

- **커밋**: 관심사별로 잘게, conventional commits(`feat(api):`, `feat(web):`, `docs:`). 커밋 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. 커밋 전 typecheck 통과 확인. 깨진 상태 커밋 금지.
- **커밋 시점**: 사용자가 요청할 때. 보통 api/web/docs로 나눠 커밋.
- **pnpm 9.15.9 고정 이유**: 컨테이너 corepack이 최신 pnpm을 받으면 `minimumReleaseAge` 공급망 정책에 걸려 빌드 실패 → `package.json`의 `packageManager`로 고정.
- **색상 변경**: `apps/web/src/styles/theme.css`만 수정(shadcn 토큰 CSS 변수). 컴포넌트 안 건드림.
- **shadcn 컴포넌트 추가**: `pnpm dlx shadcn@latest add <name>` (Vite 자동 감지). 기존 button 덮어쓰기 프롬프트엔 `n`.
- **claude 로컬 테스트**: 맥에 claude 설치·인증됨(`~/.local/bin/claude`). ChatProvider 단독 검증은 맥에서 tsx로 실행 가능(맥엔 `timeout` 명령 없음 주의).
- **민감 파일**(`.env`, `ssh.env`)은 커밋·노출 금지. 값 필요 시 파일에서 읽어 사용.
