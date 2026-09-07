#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. WSL 서버 프로세스 완전 종료 ==="
for pid in $(ps aux 2>/dev/null | grep "[t]sx" | grep -v grep | awk '{print $2}'); do
    kill -9 "$pid" 2>/dev/null && echo "PID $pid kill 성공"
done
sleep 2

echo "=== 2. 포트 3001 정리 ==="
if cat /proc/net/tcp 2>/dev/null | awk '{print $2}' | grep -qi "0BB9"; then
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 1
fi

echo "=== 3. 최신 소스 확인 ==="
echo "csrf.ts getSessionIdentifier: $(grep -c 'getSessionIdentifier' /root/school-community-server/src/lib/csrf.ts 2>/dev/null || echo 0)"
echo "errors.ts EBADCSRFTOKEN: $(grep -c 'EBADCSRFTOKEN' /root/school-community-server/src/lib/errors.ts 2>/dev/null || echo 0)"

echo "=== 4. 새 서버 실행 ==="
export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

> /tmp/wsl-server.log
nohup setsid npx tsx src/index.ts >> /tmp/wsl-server.log 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > /tmp/wsl-server.pid
echo "서버 PID: $NEW_PID"

sleep 10

echo "=== 5. /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo "=== 6. CSRF 토큰 + 세션 쿠키 확인 ==="
curl -v -s -c /tmp/wsl-session-cookies.txt http://localhost:3001/api/csrf-token 2>&1 | grep -E "Set-Cookie|HTTP/|csrfToken"

echo ""
echo "=== 7. 저장된 쿠키 확인 ==="
cat /tmp/wsl-session-cookies.txt 2>/dev/null | grep -E "csrf_token|school-session" || echo "세션 쿠키 없음"

echo ""
echo "=== 8. 서버 로그 (CSRF 관련) ==="
tail -25 /tmp/wsl-server.log 2>/dev/null | grep -E "\[CSRF\]|EBADCSRFTOKEN|ForbiddenError|Error:|서버 내부 오류|관리자" || echo "CSRF 로그 없음"
