#!/bin/zsh
set -e
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print "Node.js 22.12 이상을 설치한 뒤 다시 실행하세요: https://nodejs.org/"
  read "?Enter 키를 누르면 종료합니다. "
  exit 1
fi
avatar_port="${PORT:-5173}"
if curl -fsS "http://127.0.0.1:${avatar_port}/api/health" >/dev/null 2>&1; then
  open "http://127.0.0.1:${avatar_port}"
  exit 0
fi
if [ ! -d node_modules ] || [ ! -f dist/index.html ]; then npm run setup; fi
(sleep 3; open "http://127.0.0.1:${avatar_port}") &
npm start
