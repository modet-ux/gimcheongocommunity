#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. WSL 서버 완전 종료 ==="
for pid in $(ps aux 2>/dev/null | grep "[t]sx" | grep -v grep | awk '{print $2}'); do
    kill -9 "$pid" 2>/dev/null && echo "PID $pid kill 성공"
done
sleep 2
fuser -k 3001/tcp 2>/dev/null || true
sleep 1

echo "=== 2. 최신 코드 확인 ==="
echo "saveUninitialized: $(grep -c 'saveUninitialized: true' /root/school-community-server/src/index.ts 2>/dev/null || echo 0)"
echo "getSessionIdentifier: $(grep -c 'getSessionIdentifier' /root/school-community-server/src/lib/csrf.ts 2>/dev/null || echo 0)"
echo "EBADCSRFTOKEN in errors: $(grep -c 'EBADCSRFTOKEN' /root/school-community-server/src/lib/errors.ts 2>/dev/null || echo 0)"

echo "=== 3. 새 서버 실행 ==="
export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

> /tmp/wsl-server.log
nohup setsid npx tsx src/index.ts >> /tmp/wsl-server.log 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > /tmp/wsl-server.pid
echo "서버 PID: $SERVER_PID"

sleep 10

echo "=== 4. /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo ""
echo "=== 5. CSRF 토큰 발급 + 세션 쿠키 ==="
curl -v -s -c /tmp/wsl-csrf-final-cookies.txt http://localhost:3001/api/csrf-token 2>&1 | grep -E "Set-Cookie|HTTP/|csrfToken|school-session"

echo ""
echo "=== 6. 저장된 쿠키 ==="
cat /tmp/wsl-csrf-final-cookies.txt 2>/dev/null | grep -E "csrf_token|school-session" || echo "세션 쿠키 없음"

echo ""
echo "=== 7. POST 회원가입 테스트 ==="
CSRF_TOKEN=$(cat /tmp/wsl-csrf-final-cookies.txt 2>/dev/null | grep "csrf_token" | awk -F'\t' '{print $NF}' | sed 's/|.*$//')
echo "CSRF 토큰: ${CSRF_TOKEN:0:30}..."
if [ -n "$CSRF_TOKEN" ]; then
    curl -s -b /tmp/wsl-csrf-final-cookies.txt -X POST http://localhost:3001/api/users/register \
      -H "Content-Type: application/json" \
      -H "x-csrf-token: $CSRF_TOKEN" \
      -d '{"email":"csrf-final@s.kimcheon.hs.kr","password":"test1234","nickname":"최종테스트"}' 2>&1
else
    echo "CSRF 토큰 추출 실패"
fi

echo ""
echo "=== 8. POST 로그인 테스트 ==="
curl -s -b /tmp/wsl-csrf-final-cookies.txt -X POST http://localhost:3001/api/users/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{"email":"csrf-final@s.kimcheon.hs.kr","password":"test1234"}' 2>&1

echo ""
echo "=== 9. 서버 로그 (CSRF 관련) ==="
tail -30 /tmp/wsl-server.log 2>/dev/null | grep -E "\[CSRF\]|EBADCSRFTOKEN|ForbiddenError|Error:|POST /api/users|register|session id|csrf_token|x-csrf-token" || echo "CSRF 로그 없음"
