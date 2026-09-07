#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. WSLサーバプロセス完全kill ==="
killall -9 node npm 2>/dev/null || true
pkill -9 -f tsx 2>/dev/null || true
sleep 2
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

echo "=== 2. 最新コードをWSLにコピー ==="
cp /mnt/c/Users/user/school-community/server/src/lib/csrf.ts ./src/lib/csrf.ts
cp /mnt/c/Users/user/school-community/server/src/lib/errors.ts ./src/lib/errors.ts
cp /mnt/c/Users/user/school-community/server/src/index.ts ./src/index.ts
echo "コピー完了"

echo "=== 3. WSLサーバソース確認 ==="
echo "csrf decodeURIComponent: $(grep -c decodeURIComponent /root/school-community-server/src/lib/csrf.ts 2>/dev/null || echo 0)"
echo "errors EBADCSRFTOKEN: $(grep -c EBADCSRFTOKEN /root/school-community-server/src/lib/errors.ts 2>/dev/null || echo 0)"
echo "index saveUninitialized: $(grep -c 'saveUninitialized: true' /root/school-community-server/src/index.ts 2>/dev/null || echo 0)"

echo "=== 4. 再起動 ==="
export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

> /tmp/wsl-server.log
nohup setsid npx tsx src/index.ts >> /tmp/wsl-server.log 2>&1 &
PID=$!
echo "$PID" > /tmp/wsl-server.pid

sleep 12

echo "=== 5. /health ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "health失敗"

echo ""
echo "=== 6. CSRFトークン発行＋セッションクッキー ==="
curl -v -s -c /tmp/wsl-csrf-cookies.txt http://localhost:3001/api/csrf-token 2>&1 | grep -E "Set-Cookie|HTTP/|csrfToken|school-session"

echo ""
echo "=== 7. 保存クッキー確認 ==="
cat /tmp/wsl-csrf-cookies.txt 2>/dev/null | grep -E "csrf_token|school-session" || echo "クッキーなし"

echo ""
echo "=== 8. POST登録テスト (curl, cookie+token) ==="
CSRF=$(cat /tmp/wsl-csrf-cookies.txt 2>/dev/null | grep "csrf_token" | cut -f7 | cut -d'|' -f1)
echo "CSRFトークン: ${CSRF:0:30}..."
if [ -n "$CSRF" ]; then
    curl -s -b /tmp/wsl-csrf-cookies.txt -X POST http://localhost:3001/api/users/register \
      -H "Content-Type: application/json" \
      -H "x-csrf-token: $CSRF" \
      -d "{\"email\":\"csrf-final3@s.kimcheon.hs.kr\",\"password\":\"test1234\",\"nickname\":\"デコードテスト\"}" 2>&1
else
    echo "CSRFトークン抽出失敗"
fi

echo ""
echo "=== 9. サーバログ (CSRF関連) ==="
tail -30 /tmp/wsl-server.log 2>/dev/null | grep -E "\[CSRF\]|EBADCSRFTOKEN|ForbiddenError|Error:|POST /api/users|decodeURIComponent|school-session|csrf_token|x-csrf-token" || echo "CSRFログなし"
