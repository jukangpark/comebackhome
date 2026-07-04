# 구현 Phase & 커밋 계획 (실행용 체크리스트)

> [mvp-design.md](./mvp-design.md) 기반 실제 구현 진행표.
> 각 Phase = 목표 · 작업(체크박스) · 커밋 지점 · 완료 기준 · ❓물어볼 것.
> 작업하며 체크(`[x]`) 갱신. 애매하면 ❓ 지점에서 사용자에게 질문.
> 커밋 컨벤션: `type(scope): summary` (feat/fix/chore/docs/refactor). 각 커밋은 빌드·기동 가능한 상태 유지.

---

## 진행 현황 요약

| Phase | 이름 | 상태 |
|---|---|---|
| P0 | 뼈대 & Docker Compose | ⬜ 대기 |
| P1 | 인증(회원가입/로그인) | ⬜ 대기 |
| P2 | 펫 등록 & 이미지 업로드 | ⬜ 대기 |
| P3 | 3D 생성(Meshy) & 뷰어 | ⬜ 대기 |
| P4 | 페르소나 | ⬜ 대기 |
| P5 | 채팅(claude -p) | ⬜ 대기 |
| P6 | 마감 & 홈서버 배포 | ⬜ 대기 |

상태 표기: ⬜ 대기 / 🟡 진행 / ✅ 완료

---

## P0 — 뼈대 & Docker Compose

**목표:** `docker compose up` 하면 web/api/db 3개 컨테이너가 뜨고 헬스체크 통과.

**확정:** 패키지 매니저 **pnpm** (pnpm workspace) · 빌드 툴 **Vite** · 포트 **web:5173 / api:4000** · UI **shadcn/ui + Tailwind**

### 작업
- [ ] `git init` + `.gitignore`(node_modules, .env, dist, media 등)
- [ ] pnpm workspace 모노레포 구조 (`pnpm-workspace.yaml`, `apps/web`, `apps/api`, `packages/shared`)
- [ ] `apps/api`: Express + TS 최소 서버 + `GET /api/health` → `{ok:true}` (포트 4000)
- [ ] `apps/web`: **React + TS + Vite** 최소 앱 (Hello 화면) + dev 서버(포트 5173)
- [ ] `apps/web`: **Tailwind + shadcn/ui `init`**(Vite 자동 감지 → components.json·별칭 자동 세팅)
- [ ] shadcn 기본 컴포넌트 1개 설치 검증(예: `button`) → 렌더 확인
- [ ] `apps/api/Dockerfile` (Node 베이스, 추후 Claude CLI 추가 예정 주석)
- [ ] `apps/web` 빌드 → nginx 정적 서빙 Dockerfile
- [ ] `docker-compose.yml`: web / api / db(postgres:16) + `pgdata`·`media` 볼륨
- [ ] `.env.example` 작성(실제 `.env`는 git 제외)
- [ ] api ↔ db 연결 확인(간단 쿼리 `SELECT 1`)

### 커밋 지점
1. `chore: init pnpm monorepo structure and gitignore`
2. `feat(api): express + ts skeleton with health endpoint`
3. `feat(web): react + ts + vite skeleton`
4. `feat(web): tailwind + shadcn/ui setup`
5. `chore(docker): compose with web, api, postgres`

### 완료 기준
- `docker compose up` → 3 컨테이너 healthy
- 브라우저 `localhost:5173`에서 web 로드(shadcn button 렌더), `localhost:4000/api/health` 200

### ❓ 물어볼 것
- (해결됨) pnpm / web:5173·api:4000 / shadcn — 확정
- shadcn base color 테마(neutral/zinc/slate 등)? 기본 `zinc` 제안

---

## P1 — 인증 (회원가입 / 로그인)

**목표:** 아이디+비밀번호로 가입·로그인, JWT 쿠키로 보호 라우트 접근.

### 작업
- [ ] DB 마이그레이션: `users` 테이블 (마이그레이션 도구 선택 — 아래 ❓)
- [ ] `POST /api/auth/register` (username 유니크, bcrypt 해시)
- [ ] `POST /api/auth/login` → httpOnly+SameSite 쿠키에 JWT
- [ ] `POST /api/auth/logout`, `GET /api/auth/me`
- [ ] 인증 미들웨어(`requireAuth`) → `req.userId`
- [ ] web: `/register`, `/login` 페이지(모바일 퍼스트) + api 연동
- [ ] web: 로그인 상태 전역 관리 + 보호 라우트 리다이렉트

### 커밋 지점
1. `feat(api): users table + auth register/login/logout`
2. `feat(api): jwt cookie auth middleware`
3. `feat(web): login and register pages`
4. `feat(web): auth state and protected routes`

### 완료 기준
- 가입 → 로그인 → `/api/auth/me` 200 → 로그아웃 플로우 동작(로컬)
- 비로그인 상태로 보호 페이지 접근 시 `/login` 리다이렉트

### ❓ 물어볼 것
- 마이그레이션 도구: 원시 SQL 파일 / node-pg-migrate / Prisma / Drizzle? (경량 원하면 node-pg-migrate 또는 Drizzle 제안)
- 비밀번호 규칙(최소 길이 등)? 기본 8자 이상 제안
- username 형식 제약(영문/숫자)? 

---

## P2 — 펫 등록 & 이미지 업로드

**목표:** 유저당 1마리 펫 생성 + 대표 이미지 1장 업로드·저장.

### 작업
- [ ] DB: `pets`(user_id UNIQUE), `pet_images` 마이그레이션
- [ ] `POST /api/pet` (name, species) — 이미 있으면 409
- [ ] `GET /api/pet` — 내 펫(+모델/페르소나 상태 요약)
- [ ] `POST /api/pet/image` (multipart, 1장) → 리사이즈(장변 1024) → `media/uploads` 저장
- [ ] web: `/onboarding` 위저드 1단계(이름·종) + 2단계(이미지 업로드/미리보기)
- [ ] 가입 직후 펫 없으면 `/onboarding` 유도 로직

### 커밋 지점
1. `feat(api): pets + pet_images tables and pet CRUD`
2. `feat(api): single image upload with resize`
3. `feat(web): onboarding wizard - pet info and image upload`

### 완료 기준
- 펫 1마리 생성, 이미지 1장 업로드 후 미리보기 확인(로컬)
- 2마리째 생성 시도 차단

### ❓ 물어볼 것
- 이미지 리사이즈 라이브러리: sharp 사용 OK? (권장)
- 허용 확장자/최대 용량 제한값? 기본 jpg/png, 10MB 제안

---

## P3 — 3D 생성 (Meshy) & 뷰어

**목표:** 업로드 이미지로 Meshy 3D 생성(base64+폴링) → glb 저장 → R3F 뷰어 렌더.

### 작업
- [ ] DB: `pet_models` 마이그레이션
- [ ] `ModelProvider` 어댑터 인터페이스 + Meshy 구현체
- [ ] `POST /api/pet/model` — 이미지 base64 → Meshy 생성 요청 → task 저장(IN_PROGRESS)
- [ ] pg-boss 워커: 5~10초 폴링 → SUCCEEDED 시 glb 다운로드 → `media/models` 저장 → DONE
- [ ] `GET /api/pet/model` — 상태/진행률/glb 경로
- [ ] `GET /files/models/:file` — 소유 확인 후 정적 서빙
- [ ] web: `ModelProgress`(폴링 UI) + `PetViewer`(R3F glb 뷰어)
- [ ] onboarding 3단계로 통합(생성 대기 → 완성 뷰어)

### 커밋 지점
1. `feat(api): pet_models table + meshy model provider`
2. `feat(api): async 3d generation worker with polling`
3. `feat(api): glb static serving with ownership check`
4. `feat(web): model progress and r3f viewer`

### 완료 기준
- 실제 강아지/고양이 사진 → glb 생성 → 뷰어에서 회전 확인(로컬, 실제 Meshy 키 필요)
- 생성 실패 시 상태·에러 표시

### ❓ 물어볼 것
- **Meshy API 키 필요** (이 시점에 주입) — `.env`에 `MESHY_API_KEY`
- 생성 파라미터 확정: meshy-6 / triangle / 30k / glb / pbr off (설계 기본값 그대로 OK?)
- 폴링 실패/타임아웃 상한(예: 5분 초과 시 FAILED)?

---

## P4 — 페르소나

**목표:** 펫 성격 + 추억 + 말투 입력·저장.

### 작업
- [ ] DB: `personas` 마이그레이션(pet_id UNIQUE)
- [ ] `PUT /api/pet/persona`, `GET`(펫 조회에 포함)
- [ ] web: `PersonaForm`(성격/추억/말투) — onboarding 마지막 단계
- [ ] 입력 검증(길이 제한 등)

### 커밋 지점
1. `feat(api): personas table and persona endpoints`
2. `feat(web): persona form in onboarding`

### 완료 기준
- 페르소나 저장·수정 후 재조회 확인
- onboarding 전체 플로우 완주(생성→업로드→3D→페르소나→펫 홈)

### ❓ 물어볼 것
- 페르소나 입력 형태: 자유 서술 vs 항목 분리(성격 태그+추억 텍스트)? 설계는 traits/memories/speaking 분리 — 이대로 OK?
- 각 필드 글자 수 상한?

---

## P5 — 채팅 (claude -p)

**목표:** 페르소나 기반으로 그 아이처럼 답하는 채팅.

### 작업
- [ ] DB: `chat_messages` 마이그레이션
- [ ] `ChatProvider` 어댑터 + claude 헤드리스 구현체
- [ ] 프롬프트 조립(system=페르소나, 최근 12턴, 이번 메시지)
- [ ] `POST /api/pet/messages` — user 저장 → claude -p 호출 → pet 답변 저장·반환
- [ ] `GET /api/pet/messages` — 이력
- [ ] 동시 실행 세마포어 + 타임아웃/폴백
- [ ] **Docker api 이미지에 Claude CLI 설치 + `CLAUDE_CODE_OAUTH_TOKEN` 주입**
- [ ] web: **shadcn 2026-06 chat 컴포넌트 설치**
      `pnpm dlx shadcn@latest add message-scroller message bubble attachment marker`
- [ ] web: `ChatRoom` — `MessageScroller`+`Message`+`Bubble`로 구성, 하단 고정 입력창 + 전송 로딩(`shimmer`)

### 커밋 지점
1. `feat(api): chat_messages table + claude headless chat provider`
2. `feat(api): chat endpoint with persona prompt assembly`
3. `chore(docker): install claude cli in api image`
4. `feat(web): chat room with shadcn chat components`

### 완료 기준
- 로컬에서 페르소나 반영된 답변 수신(Docker 안 claude 인증 포함)
- 대화 이력 유지·표시

### ❓ 물어볼 것
- **`claude setup-token`으로 OAuth 토큰 발급 필요** (이 시점)
- 답변 톤/길이 가이드(짧고 귀엽게 등) 세부 지침?
- 컨텍스트 길이 12턴 확정?

---

## P6 — 마감 & 홈서버 배포

**목표:** 에러 처리·정리 후 홈서버에 배포.

### 작업
- [ ] 전역 에러 처리·소유권 검증 재점검
- [ ] 로컬 E2E 한 바퀴(가입→온보딩→채팅)
- [ ] 프로덕션 compose/env 정리
- [ ] 홈서버 배포(git/rsync → `.env` → `docker compose up -d`)
- [ ] nginx 리버스 프록시 — **고유 `server_name`, `default_server` 금지**(CLAUDE.md 규칙, 강이봇 보호)
- [ ] 배포 후 스모크 테스트

### 커밋 지점
1. `fix: error handling and ownership checks pass`
2. `chore(deploy): production compose and nginx config`
3. `docs: deployment notes`

### 완료 기준
- 홈서버에서 외부(또는 Tailscale) 접속으로 전체 플로우 동작
- 강이봇 등 기존 서비스 정상(default_server 유지 확인)

### ❓ 물어볼 것
- 접속 도메인/경로(예: `pet.<something>` 또는 경로 프리픽스)?
- HTTPS 방식(기존 인증서/리버스 프록시 구성)?

---

## 공통 규칙
- 각 커밋 전 로컬 기동/빌드 확인. 깨진 상태로 커밋 금지.
- `.env`, 토큰, 키는 절대 커밋 금지.
- 새 애매함 발견 시 → 해당 Phase ❓에 추가하고 사용자에게 질문 후 진행.
- 커밋 메시지 끝에 Claude Co-Authored-By 트레일러 포함(요청 시).
