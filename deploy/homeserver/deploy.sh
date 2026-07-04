#!/usr/bin/env bash
# 홈서버 코드 재배포 스크립트 — 자세한 설계는 docs/deploy-homeserver.md
#
# 사용:
#   source ssh.env && SSH_HOST=$homeserver ./deploy/homeserver/deploy.sh
#
# 최초 1회(수동): 서버에 ~/comebackhome/.env 배치 + 호스트 nginx 블록 + cloudflared ingress + Cloudflare DNS.
# 이 스크립트는 그 이후 "코드 변경 → 재빌드/재기동" 전용이다. (media/pgdata 볼륨은 보존됨)
set -euo pipefail

: "${SSH_HOST:?SSH_HOST 필요 — source ssh.env 후 SSH_HOST=\$homeserver}"
: "${password:?ssh.env 의 password 필요 — source ssh.env}"

REMOTE_DIR="comebackhome"          # 서버 홈 기준 ~/comebackhome
PROJECT="comebackhome"             # docker compose -p
PORT=4007                          # 호스트 노출 포트(127.0.0.1)
PW="$password"

# 리포 루트로 이동(스크립트 위치 기준)
cd "$(dirname "$0")/../.."

run() { sshpass -p "$PW" ssh -o StrictHostKeyChecking=no "$SSH_HOST" "$@"; }

echo "▶ 원격 디렉터리 준비"
run "mkdir -p ~/$REMOTE_DIR"

echo "▶ .env 존재 확인(시크릿은 서버에만 둔다)"
if ! run "test -f ~/$REMOTE_DIR/.env"; then
  echo "✗ 서버에 ~/$REMOTE_DIR/.env 없음."
  echo "  먼저: sshpass -p \"\$password\" scp .env \"\$SSH_HOST\":~/$REMOTE_DIR/.env"
  exit 1
fi

echo "▶ 소스 동기화(rsync)"
sshpass -p "$PW" rsync -az --delete \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude media --exclude '*.log' --exclude .env \
  --exclude docker-compose.override.yml --exclude ssh.env \
  ./ "$SSH_HOST":"$REMOTE_DIR"/

echo "▶ 빌드 & 기동"
run "cd ~/$REMOTE_DIR && docker compose -p $PROJECT -f docker-compose.yml -f docker-compose.prod.yml up -d --build"

echo "▶ 헬스체크(컨테이너 → 호스트 :$PORT)"
code="$(run "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/ || true")"
echo "  HTTP $code"
[ "$code" = "200" ] || { echo "✗ web 응답 비정상($code). 로그: docker compose -p $PROJECT logs --tail=100 web api"; exit 1; }

echo "✓ 배포 완료 → https://comebackhome.jklab.app"