# comebackhome 🐾

> **"다시 만난 우리 아이와 대화해요."**

**🌐 배포:** **[comebackhome.jklab.app](https://comebackhome.jklab.app)**

반려동물(강아지·고양이) 사진 한 장을 **3D 모델**로 변환하고, 그 아이의 성격·추억·말투를 담은 **페르소나**로 대화하는 웹앱입니다. 개인/MVP 규모, **모바일 퍼스트**.

---

## ✨ 무엇을 하나요

단선 온보딩 위저드로 진행됩니다:

1. **회원가입 · 로그인** — 아이디 + 비밀번호
2. **반려동물 등록** — 이름 + 종(강아지/고양이). 유저당 **1마리**
3. **이미지 업로드** — 대표 사진 **1장**
4. **3D 모델 생성** — Meshy image-to-3D로 사진을 GLB로 변환 (비동기, 진행률 표시)
5. **페르소나 작성** — 성격 + 함께한 추억 + 말투
6. **홈(3D 뷰어)** — 완성된 모델을 회전하며 감상 (React Three Fiber)
7. **채팅** — 그 아이의 페르소나로 대화 (Claude가 응답 생성)

---

## 🏗️ 아키텍처

```
브라우저 (React 19 + TS + Vite)
   │  REST(JSON) + httpOnly 쿠키(JWT)
   ▼
API 서버 (Express + TS, tsx)
   ├─ Auth     가입/로그인/세션
   ├─ Pets     펫 CRUD · 이미지 업로드
   ├─ Models   Meshy 3D 생성 요청/상태
   ├─ Persona  페르소나 저장/조회
   ├─ Chat     메시지 저장 + Claude 응답 생성
   └─ Poller   3D 생성 상태 폴링 → glb 다운로드 (DB 기반 인터벌 폴러)
   │
   ├─ PostgreSQL 16    데이터
   ├─ 파일 볼륨         uploads / models
   ├─ Meshy REST API   이미지→3D (외부)
   └─ Claude 헤드리스   채팅 응답 생성 (claude -p, 구독)
```

**설계 원칙**
- **판단·대화는 Claude, 실행은 코드** — Meshy 호출·폴링·다운로드는 결정적 Node 코드, Claude는 채팅 응답 생성에만.
- **외부 의존성은 어댑터 뒤로** — `ChatProvider`(채팅)·`ModelProvider`(3D) 인터페이스로 감싸 교체 가능(Claude→Anthropic API, Meshy→Tripo 등).

---

## 🧰 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 모노레포 | pnpm workspace (`apps/*`, `packages/*`), **pnpm@9.15.9 고정** |
| Web | React 19 · TypeScript · **Vite** · Tailwind v4 · shadcn/ui(new-york) · react-router 7 |
| 3D | three · @react-three/fiber · @react-three/drei |
| API | Express 4 · TypeScript · **tsx**(빌드 없이 실행) |
| DB | PostgreSQL 16 |
| 3D 생성 | Meshy image-to-3D (meshy-6) |
| 채팅 AI | Claude 헤드리스 (`claude -p`, 구독, Opus 4.8) |
| 배포 | Docker Compose (web / api / db) |

**UI 원칙:** 모바일 퍼스트 반응형(스마트폰 세로 레이아웃 기준으로 먼저 제작).

---

## 🚀 시작하기

### 사전 준비
- Docker / Docker Compose
- Node.js + pnpm (로컬 개발 시)
- Meshy API 키
- Claude Code CLI OAuth 토큰 (`claude setup-token`)

### 환경 변수
`.env.example`를 복사해 `.env`를 채웁니다. **`.env`와 `ssh.env`는 커밋하지 않습니다.**

```bash
cp .env.example .env
```

| 변수 | 설명 |
|---|---|
| `MESHY_KEY` (또는 `MESHY_API_KEY`) | Meshy API 키 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude 구독 인증 토큰 (`claude setup-token`으로 발급) |
| `JWT_SECRET` | JWT 서명 시크릿 |
| `DATABASE_URL` / `POSTGRES_*` | PostgreSQL 접속 정보 |

### 실행
```bash
docker compose up -d --build      # 코드 변경 후엔 항상 --build
```
- Web: http://localhost:5173
- 개별 재빌드: `docker compose up -d --build web` / `... api`

> ⚠️ 프론트만 고치고 api만 재빌드하면 브라우저에 옛 UI가 남습니다. 변경한 서비스를 명시하거나 둘 다 재빌드하세요.

### 타입체크 (커밋 전 필수)
```bash
pnpm --filter web typecheck
pnpm --filter api typecheck
```

---

## 📁 디렉터리 구조

```
combackhome/
├─ docker-compose.yml            # web/api/db + pgdata·media 볼륨
├─ docker-compose.prod.yml       # 프로덕션 오버레이(홈서버)
├─ .env                          # git 제외 — 시크릿
├─ ssh.env                       # git 제외 — 홈서버 접속 정보
├─ CLAUDE.md                     # 프로젝트 가이드(새 세션용)
├─ .claude/agents/               # 프로젝트 전용 서브에이전트
├─ deploy/homeserver/            # 홈서버 재배포 스크립트
├─ docs/                         # 설계 · R&D · 배포 문서
├─ apps/
│  ├─ web/                       # React 19 + TS + Vite
│  └─ api/                       # Express + TS (+ Claude CLI)
└─ packages/
   └─ shared/                    # (예약, 미사용)
```

---

## 🚢 배포

홈서버(Tailscale)에 Docker Compose로 배포하며, **[comebackhome.jklab.app](https://comebackhome.jklab.app)**로 공개됩니다(cloudflared ingress).

```bash
source ssh.env && SSH_HOST=$homeserver ./deploy/homeserver/deploy.sh
```

재배포 스크립트는 [deploy/homeserver/deploy.sh](./deploy/homeserver/deploy.sh) 참고. (상세 절차 문서는 인프라 정보를 포함해 로컬 전용으로 관리합니다.)

---

## 🤖 서브에이전트

`.claude/agents/`에 이 저장소 작업용 전문 에이전트가 있습니다.

| 에이전트 | 담당 |
|---|---|
| `api-dev` | 백엔드(Express/TS) — 라우트·마이그레이션·Meshy/Claude 어댑터·폴러 |
| `web-dev` | 프론트엔드(React/Vite/shadcn/R3F) — 페이지·컴포넌트·3D 뷰어·스타일 |
| `homeserver-deployer` | 홈서버 배포·재배포·nginx/cloudflared·스모크 테스트 |

---

## 📄 문서

- [MVP 설계](./docs/mvp-design.md) — 아키텍처·DB·API·배포 (가장 중요)
- [Meshy image-to-3D API](./docs/meshy-image-to-3d-api.md)
- [3D 모델링 R&D](./docs/3d-modeling-rnd.md)
- [3D 기초 스터디](./docs/3d-basics-study.md)
