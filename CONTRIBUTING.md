# 🤝 기여 가이드 · Contributing to combackhome

반려동물(강아지/고양이) 사진을 **3D 모델 → 페르소나 → 그 아이처럼 답하는 AI 채팅**으로 이어주는
웹앱 combackhome에 기여해 주셔서 감사합니다. 이 문서는 이슈 작성부터 브랜치·커밋·PR·리뷰·머지까지
**이 리포의 실제 작업 관례**를 한곳에 모은 것입니다.

> 프로젝트 전체 구조·아키텍처·환경변수·함정은 루트 [CLAUDE.md](CLAUDE.md)에, 설계 상세는
> [docs/mvp-design.md](docs/mvp-design.md), 배포는 [deploy/homeserver/deploy.sh](deploy/homeserver/deploy.sh)를
> 참고하세요.

---

## 📑 목차

1. [시작하기 전에](#-시작하기-전에)
2. [기여 흐름](#-기여-흐름)
3. [브랜치 네이밍](#-브랜치-네이밍)
4. [커밋 메시지](#️-커밋-메시지)
5. [로컬 개발·빌드·검증](#-로컬-개발빌드검증)
6. [테스트](#-테스트)
7. [Pull Request 가이드](#-pull-request-가이드)
8. [이슈 작성](#-이슈-작성)
9. [코드 컨벤션](#-코드-컨벤션)
10. [보안·시크릿 주의](#-보안시크릿-주의)

---

## 🚀 시작하기 전에

**pnpm workspace 모노레포**입니다. 개인/MVP 규모이며 **모바일 퍼스트** UI를 지향합니다.

| 영역 | 스택 |
|---|---|
| 프론트 `apps/web` | React 19 + TS + Vite + Tailwind v4 + shadcn/ui + react-router 7 + three/R3F/drei |
| 백엔드 `apps/api` | Express 4 + TS + tsx (빌드 없이 실행) |
| DB | PostgreSQL 16 |
| 배포 | Docker Compose (web / api / db) |
| 3D 생성 | Meshy image-to-3D (meshy-6) |
| 채팅 AI | Claude 헤드리스 (`claude -p`, 구독, Opus 4.8) |

- **패키지 매니저는 `pnpm@9.15.9` 고정**입니다(`package.json`의 `packageManager`). 컨테이너 corepack이
  최신 pnpm을 받으면 공급망 정책(`minimumReleaseAge`)에 걸려 빌드가 실패하므로 버전을 올리지 마세요.
- 유저 1명 : 펫 1마리(고정), 이미지 1장 구조입니다. 데이터 모델·엔드포인트는 루트 CLAUDE.md 6·7장 참고.

---

## 👤 기여 흐름

```
이슈 작성 → 브랜치 생성 → 논리 단위로 커밋 → PR 생성 → 리뷰 → 머지
```

1. **이슈 작성** — 무엇을/왜 할지 이슈로 먼저 남깁니다. 적절한 [이슈 템플릿](#-이슈-작성)을 사용하세요.
2. **브랜치 생성** — `master` 기준으로 [네이밍 규칙](#-브랜치-네이밍)에 맞춰 브랜치를 팝니다.
3. **커밋** — [커밋 메시지 규칙](#️-커밋-메시지)을 지켜 논리적인 단위로 나눕니다.
4. **PR 생성** — 기본 PR 템플릿이 자동으로 채워집니다. [PR 가이드](#-pull-request-가이드) 참고.
5. **리뷰** — 리뷰를 받고 코멘트를 반영합니다.
6. **머지** — 리뷰 확인 후 머지합니다.

---

## 🌿 브랜치 네이밍

`<type>/<짧은-설명-kebab-case>` 형식을 사용합니다. `<type>`은 [커밋 타입](#️-커밋-메시지)과 동일하게 맞춥니다.

```
feat/chat-typing-indicator
fix/meshy-poller-timeout
docs/contributing-guide
refactor/pet-api-ownership-check
```

- 이슈와 연결될 땐 설명에 이슈 번호를 녹이면 추적이 쉽습니다(예: `feat/issue-12-chat-scroll`).
- 길이보다 **다른 개발자가 한눈에 이해**되는 게 우선입니다.

---

## ✍️ 커밋 메시지

**Conventional Commits** 를 따릅니다(최근 로그 스타일 준수).

```
<type>(<scope>): <요약>

<본문 — 무엇을/왜. 선택>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>   # AI 도움을 받았다면
```

### type

| type | 용도 | type | 용도 |
|---|---|---|---|
| `feat` | 새 기능 | `perf` | 성능 개선 |
| `fix` | 버그 수정 | `test` | 테스트 |
| `docs` | 문서 | `chore` | 잡무/설정 |
| `refactor` | 동작 불변 리팩터링 | `ci` | CI/배포 |

### scope (영역)

`web` · `api` · `db` · `docs` · `deploy` 등 변경 위치를 적습니다.

```
feat(api): pet chat via claude headless (subscription, opus 4.8)
feat(web): chat room with shadcn bubble/message components
fix(api): meshy poller timeout handling
```

- **커밋 전 typecheck 통과**를 확인하고, **깨진 상태로 커밋하지 마세요.**
- 관심사별로 잘게 나누고, api / web / docs 성격이 다르면 커밋을 분리해 왔습니다.

---

## 🔧 로컬 개발·빌드·검증

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

> ⚠️ **stale 주의**: 프론트만 고치고 api만 재빌드하면 브라우저에 옛 UI가 남습니다. 코드 변경 후엔
> `docker compose up -d --build`로 **web·api 둘 다** 재빌드하거나 해당 서비스를 명시하세요.

- **shadcn 컴포넌트 추가**: `pnpm dlx shadcn@latest add <name>` (Vite 자동 감지). 기존 button 덮어쓰기
  프롬프트엔 `n`.
- **색상 변경**: `apps/web/src/styles/theme.css`(shadcn 토큰 CSS 변수)만 수정하고 컴포넌트는 건드리지
  않습니다.

---

## ✅ 테스트

- 새 동작에는 가능하면 테스트를 추가합니다. 테스트가 불필요한 변경(문서·설정 등)이면 PR 체크리스트에
  그렇게 표시하세요.
- 최소 게이트는 **양쪽 typecheck 통과 + `docker compose up -d --build` 정상 기동**입니다.
- 외부 연동(Meshy 3D 생성, claude 채팅)은 어댑터(`lib/meshy.ts`의 `ModelProvider`,
  `lib/claude.ts`의 `ChatProvider`) 뒤에 있으니, 관련 변경 시 인터페이스 계약을 유지하세요.

---

## 🔀 Pull Request 가이드

1. PR을 열면 [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md)가 자동으로 채워집니다.
   **무엇을/왜**, 연결 이슈(`Closes #번호`), 리뷰어를 위한 설명, user-facing 변경 여부를 채워 주세요.
2. **타깃 브랜치는 `master`**.
3. 머지 전 **양쪽 typecheck 통과**와 **로컬 컨테이너 동작 확인**을 마쳐 주세요.
4. UI 변경은 **모바일 화면 스크린샷**을 첨부하면 리뷰가 빠릅니다.
5. 리뷰 코멘트를 반영하고, 리뷰어가 확인한 이후에 머지합니다.

---

## 🐞 이슈 작성

목적에 맞는 [이슈 템플릿](.github/ISSUE_TEMPLATE/)을 사용하세요:

`BUG` · `FEATURE` · `CHORE` · `DOCS` · `REFACTOR` · `TEST`

- 버그는 **재현 단계·기대 동작·환경(OS/브라우저/관련 영역)** 을 빠짐없이.
- 기능 요청은 **문제 → 원하는 해결 → 고려한 대안** 순서로.

---

## 📐 코드 컨벤션

- **주변 코드의 관례를 따릅니다** — 주석 밀도·네이밍·idiom을 맞추고, 새 라이브러리 도입 전 기존 의존을
  확인하세요.
- 모든 `/api/pet*` 엔드포인트는 인증 필요 + **본인 펫만** 접근할 수 있게 소유권을 확인합니다.
- DB 스키마 변경은 **원시 SQL 마이그레이션 파일**(`apps/api/src/migrations/NNN_*.sql`) 추가로만 합니다
  (부팅 시 순서대로 자동 적용, `schema_migrations`로 추적).

---

## 🔒 보안·시크릿 주의

- **비밀키/토큰을 코드·커밋에 하드코딩하지 마세요.**
- 다음 파일은 **gitignore 되어 커밋 금지**입니다: `.env`, `ssh.env`.
  (`MESHY_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `JWT_SECRET`, `DATABASE_URL` 등)
- 채팅용 `CLAUDE_CODE_OAUTH_TOKEN`은 `claude setup-token`으로 발급한 구독 토큰이며 **API 과금이 없습니다.**
  계정에 귀속되므로 로컬·홈서버 동일 값을 씁니다.
- 홈서버(nginx) 배포 시 규칙: 새 `listen 80` 블록에는 **고유 `server_name`을 부여하고 `default_server`를
  절대 쓰지 마세요.** (강이봇 메시지 유실 방지 — 루트 CLAUDE.md 10장 참고.)

---

기여해 주셔서 감사합니다! 궁금한 점은 이슈로 남겨 주세요. 🙌
