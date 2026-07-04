# syntax=docker/dockerfile:1
# 빌드 컨텍스트는 레포 루트 (pnpm workspace 전체)
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# 채팅용 Claude Code CLI (헤드리스). 인증은 런타임에 CLAUDE_CODE_OAUTH_TOKEN 주입.
RUN npm i -g @anthropic-ai/claude-code && claude --version

WORKDIR /app

# 워크스페이스 매니페스트만 먼저 복사 → 의존성 캐시
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --filter api...

# 소스 복사
COPY apps/api ./apps/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "start"]
