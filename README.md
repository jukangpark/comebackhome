# comebackhome 🐾

> **"우리 강아지·고양이를 3D로 만들고, 그 아이의 페르소나로 대화한다."**

반려동물 사진 한 장을 3D 모델로 변환하고, 그 아이의 성격과 추억을 담은 페르소나로 대화하는 웹앱입니다.

---

## ✨ 무엇을 하나요

1. **회원가입 · 로그인** — 아이디 + 비밀번호
2. **반려동물 등록** — 이름 + 종(강아지/고양이), 유저당 1마리
3. **이미지 업로드** — 대표 사진 1장
4. **3D 모델 생성** — Meshy image-to-3D로 사진을 GLB 모델로 변환 (비동기, 진행률 표시)
5. **페르소나 작성** — 성격 + 함께한 추억 + 말투
6. **3D 뷰어** — 완성된 모델을 회전하며 감상 (React Three Fiber)
7. **채팅** — 그 아이의 페르소나로 대화 (Claude가 응답 생성)

---

## 🏗️ 아키텍처

```
브라우저 (React + TS + Rspack)
   │  REST(JSON) + httpOnly 쿠키(JWT)
   ▼
API 서버 (Express + TS)
   ├─ Auth    가입/로그인/세션
   ├─ Pets    펫 CRUD · 이미지 업로드
   ├─ Models  Meshy 3D 생성 요청/상태
   ├─ Persona 페르소나 저장/조회
   ├─ Chat    메시지 저장 + Claude 응답 생성
   └─ Worker  3D 생성 잡 폴링 (pg-boss)
   │
   ├─ PostgreSQL      데이터
   ├─ 파일 볼륨        uploads / models
   ├─ Meshy REST API  이미지→3D (외부)
   └─ Claude 헤드리스  채팅 응답 생성
```

**설계 원칙**
- **판단·대화는 Claude, 실행은 코드** — Meshy 호출·폴링·다운로드는 결정적 Node 코드, Claude는 채팅 응답 생성에만.
- **외부 의존성은 어댑터 뒤로** — `ChatProvider` · `ModelProvider` 인터페이스로 감싸 교체 가능(Claude→API, Meshy→Tripo 등).

---

## 🧰 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Web | React · TypeScript · Rspack · Tailwind CSS · shadcn/ui |
| 3D | three · @react-three/fiber · @react-three/drei |
| API | Express · TypeScript · pg-boss |
| DB | PostgreSQL |
| 3D 생성 | Meshy image-to-3D (meshy-6) |
| 채팅 AI | Claude 헤드리스 (`claude -p`, Opus 4.8) |
| 배포 | Docker Compose |

**UI 원칙:** 모바일 퍼스트 반응형 (스마트폰 세로 레이아웃 기준으로 먼저 제작).

---

## 🚀 시작하기

### 사전 준비
- Docker / Docker Compose
- Node.js + pnpm (로컬 개발 시)
- Meshy API 키
- Claude Code CLI OAuth 토큰 (`claude setup-token`)

### 환경 변수
`.env.example`를 복사해 `.env`를 만들고 값을 채웁니다. **`.env`와 `ssh.env`는 커밋하지 않습니다.**

```bash
cp .env.example .env
```

| 변수 | 설명 |
|---|---|
| `MESHY_API_KEY` | Meshy API 키 |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude 구독 인증 토큰 |
| `JWT_SECRET` | JWT 서명 시크릿 |
| `DATABASE_URL` / `POSTGRES_*` | PostgreSQL 접속 정보 |

### 실행
```bash
docker compose up
```
- Web: http://localhost:5173
- API: http://localhost:4000/api/health

---

## 📁 디렉터리 구조

```
comebackhome/
├─ docker-compose.yml
├─ .env                 # git 제외
├─ ssh.env             # git 제외 (홈서버 접속 정보)
├─ docs/               # 설계 · R&D 문서
├─ apps/
│  ├─ web/             # React + TS + Rspack
│  └─ api/             # Express + TS (+ Claude CLI)
└─ packages/
   └─ shared/          # 공용 타입
```

---

## 🗺️ 구현 로드맵

| Phase | 내용 |
|---|---|
| P0 | 뼈대 & Docker Compose |
| P1 | 인증 (회원가입 / 로그인) |
| P2 | 펫 등록 & 이미지 업로드 |
| P3 | 3D 생성 (Meshy) & 뷰어 |
| P4 | 페르소나 |
| P5 | 채팅 (claude -p) |
| P6 | 마감 & 홈서버 배포 |

자세한 설계는 [docs/mvp-design.md](./docs/mvp-design.md), 실행 체크리스트는 [docs/build-phases.md](./docs/build-phases.md) 참고.

---

## 📄 문서

- [MVP 설계](./docs/mvp-design.md)
- [구현 Phase & 커밋 계획](./docs/build-phases.md)
- [Meshy image-to-3D API](./docs/meshy-image-to-3d-api.md)
- [3D 모델링 R&D](./docs/3d-modeling-rnd.md)
- [3D 기초 스터디](./docs/3d-basics-study.md)
