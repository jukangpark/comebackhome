# shadcn/ui Chat Components (2026-06)

> 출처: https://ui.shadcn.com/docs/changelog/2026-06-chat-components
> 관련 컴포넌트 문서: https://ui.shadcn.com/docs/components/message-scroller

shadcn/ui가 2026년 6월에 **채팅 UI 구축용 컴포넌트 세트**를 새로 추가했다. 스크롤 동작·메시지 레이아웃·말풍선·첨부·시스템 마커를 각각 분리된 primitive로 제공하며, **콘텐츠 렌더링 / AI 상태 / 전송(transport) / 영속화(persistence)와 디커플링**되어 있는 게 핵심이다. 즉 상태 관리는 우리가 하고, 이 컴포넌트들은 "보여주기"와 "스크롤"만 책임진다.

---

## 설치

전부 한 번에:

```bash
pnpm dlx shadcn@latest add message-scroller message bubble attachment marker
```

개별 설치:

```bash
pnpm dlx shadcn@latest add message-scroller
```

유틸(`scroll-fade`, `shimmer`)은 `shadcn/tailwind.css`에 포함되어 함께 들어온다.

---

## 컴포넌트 개요

| 컴포넌트 | 역할 |
|---|---|
| **MessageScroller** | 대화 스크롤 컨테이너. 앵커링·스트리밍·히스토리 prepend·jump-to-message·가시성 추적 처리 |
| **Message** | 대화 행(row) 레이아웃. 아바타 위치, 정렬, header/content/footer, 그룹 메시지 |
| **Bubble** | 메시지 표면(말풍선). variant, 정렬, 리액션, 링크/버튼 임베드, 접힘(collapsible) 영역 |
| **Attachment** | 메시지 내 파일/이미지. 미디어·메타데이터 렌더, 업로드 상태, 액션 버튼, 카드 뷰 트리거 |
| **Marker** | 상태·시스템 메시지. 상태 업데이트, 시스템 노트, 구분선(날짜/스트리밍/툴 활동) |

---

## 1. MessageScroller (핵심)

채팅 UI에서 "쉽게 틀리는 부분"을 대신 처리해준다:
- 턴(turn) 앵커링
- 스트리밍 응답 따라가기(follow-output)
- 저장된 스레드 복원
- 이전 히스토리 prepend 시 스크롤 위치 보존
- 특정 메시지로 점프
- 스크롤 컨트롤 버튼
- 가시성(visibility) 추적

### 구성 (sub-components)

| Part | 설명 |
|---|---|
| `MessageScrollerProvider` | Headless 루트. 스크롤 상태·오토스크롤·앵커링·스크롤 커맨드·가시성 추적 관리 |
| `MessageScroller` | 스타일링된 프레임. viewport / content / controls 레이아웃 |
| `MessageScrollerViewport` | 실제 스크롤 요소. native scroll 이벤트 수신, 오래된 메시지 prepend 시 보이는 행 유지 |
| `MessageScrollerContent` | 트랜스크립트 컨테이너. live-region 기본값(스크린리더 안내) 포함 |
| `MessageScrollerItem` | 행 경계. 측정·앵커링·위치 보존·가시성 추적·네비게이션 활성화 |
| `MessageScrollerButton` | 시작/끝으로 이동하는 스크롤 컨트롤. 스크롤 방향 없으면 비활성 |

### 주요 Props

**MessageScrollerProvider**
- `autoScroll` — 라이브 엣지에서 출력 따라가기(follow-output) 활성화
- `defaultScrollPosition` — 최초 스크롤 위치: `"start"` | `"end"` | `"last-anchor"`
- `scrollPreviousItemPeek` — 새로 앵커된 행 위로 이전 아이템을 몇 px 남겨둘지

**MessageScrollerItem**
- `messageId` — 행의 안정적 식별자
- `scrollAnchor` (boolean) — 이 행을 턴 경계로 표시

### Hooks

- **useMessageScroller** → `scrollToMessage(id)`, `scrollToEnd()`, `scrollToStart()` (외부 컨트롤용)
- **useMessageScrollerVisibility** → `currentAnchorId`, `visibleMessageIds`
- **useMessageScrollerScrollable** → `start`, `end` (스크롤 가능 방향 boolean)

---

## 2. Message

대화 행의 구조적 레이아웃 담당.
- 아바타 위치(좌/우)
- 정렬(alignment)
- header / content / footer 섹션
- 그룹 메시지(연속 메시지 묶음) 지원

## 3. Bubble

메시지 표면 렌더링.
- variant(스타일 변형)
- 정렬
- 리액션
- 임베드된 링크·버튼
- 접힘(collapsible) 콘텐츠 영역

## 4. Attachment

메시지 내 파일/이미지.
- 미디어·메타데이터 렌더링
- 업로드 상태 인디케이터
- 액션 버튼
- 전체 카드 뷰 트리거 (개별 클릭 액션과 분리 유지)

## 5. Marker

상태·시스템 메시지.
- 상태 업데이트 / 시스템 노트
- bordered row
- 라벨 붙은 구분선: 스트리밍 상태, 툴 활동, 날짜 구분

---

## 유틸리티

### `scroll-fade`
스크롤 컨테이너의 가장자리에 스크롤 인식 페이드를 추가. 오버레이 없이 "위/아래에 콘텐츠 더 있음"을 시각적으로 힌트.

```jsx
export function ScrollFadeDemo() {
  return (
    <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border">
      {/* scroll-fade 적용 컨테이너 */}
    </div>
  )
}
```

### `shimmer`
"live status" 텍스트용 시머 효과. "Thinking…", "Generating response…" 같은 진행 표시에 사용.

```jsx
export function ShimmerDemo() {
  return (
    <p className="shimmer text-sm text-muted-foreground">
      Thinking…
    </p>
  )
}
```

---

## AI SDK 연동

`@ai-sdk/react`의 **`useChat`** 훅과 함께 쓰도록 설계됨.

```jsx
"use client"

import { useChat } from "@ai-sdk/react"
// useChat의 messages를 MessageScrollerItem 행으로 스트리밍
// Provider가 앵커링 + follow-output을 토큰 도착마다 관리
```

동작 방식: `useChat`이 뱉는 messages를 `MessageScrollerItem` 행으로 뿌리면, `MessageScrollerProvider`가 스트리밍 토큰이 도착할 때마다 스크롤 앵커링과 follow-output을 알아서 처리한다.

---

## `@shadcn/react` (headless 패키지)

새로 나온 **unstyled headless 컴포넌트 패키지**. 스타일 없이 동작 로직만 제공.
- 초기 릴리스: `@shadcn/react/message-scroller` (순수 스크롤 동작 로직)
- **Radix / Base UI** 프레임워크 지원
- 완전 커스텀 디자인을 원할 때 스타일링된 `message-scroller` 대신 사용

---

## 우리 프로젝트에 쓸 때 체크포인트

1. **상태는 우리 몫** — 이 컴포넌트들은 렌더/스크롤만 담당. 메시지 상태·전송·저장은 별도(`useChat` 또는 자체 store).
2. **핵심은 MessageScroller** — 나머지(Message/Bubble/Attachment/Marker)는 사실상 스타일 프리미티브라 자체 디자인으로 대체 가능하지만, 스크롤 앵커링 로직은 직접 구현하면 버그 나기 쉬움 → MessageScroller는 그대로 쓰는 걸 추천.
3. **커스텀 디자인이 강하면** styled 버전 대신 `@shadcn/react` headless 버전 고려.
4. `defaultScrollPosition="last-anchor"` + `autoScroll`이 일반적인 채팅 UX 조합.
