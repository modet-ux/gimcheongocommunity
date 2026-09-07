#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. WSL 서버 프로세스 완전 종료 ==="
killall -9 node npm 2>/dev/null || true
sleep 2

echo "=== 2. 포트 3001 정리 ==="
fuser -k 3001/tcp 2>/dev/null || true
sleep 2

echo "=== 3. 최신 소스 WSL에 복사 ==="
cp /mnt/c/Users/user/school-community/server/src/index.ts ./src/index.ts 2>&1
cp /mnt/c/Users/user/school-community/server/src/lib/csrf.ts ./src/lib/csrf.ts 2>&1
cp /mnt/c/Users/user/school-community/server/src/lib/errors.ts ./src/lib/errors.ts 2>&1
echo "소스 복사 완료"

echo "=== 4. 변경 확인 ==="
echo "saveUninitialized: $(grep -c 'saveUninitialized: true' /root/school-community-server/src/index.ts 2>/dev/null || echo 0)"
echo "csrf getSessionIdentifier: $(grep -c 'getSessionIdentifier' /root/school-community-server/src/lib/csrf.ts 2>/dev/null || echo 0)"
echo "errors EBADCSRFTOKEN: $(grep -c 'EBADCSRFTOKEN' /root/school-community-server/src/lib/errors.ts 2>/dev/null || echo 0)"

echo "=== 5. 새 서버 실행 ==="
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

sleep 12

echo "=== 6. /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo ""
echo "=== 7. CSRF 토큰 발급 + 세션 쿠키 ==="
curl -v -s -c /tmp/wsl-final-cookies.txt http://localhost:3001/api/csrf-token 2>&1 | grep -E "Set-Cookie|HTTP/|csrfToken|school-session"

echo ""
echo "=== 8. 저장된 최종 쿠키 ==="
cat /tmp/wsl-final-cookies.txt 2>/dev/null | grep -E "csrf_token|school-session" || echo "세션 쿠키 없음"

echo ""
echo "=== 9. 서버 로그 (CSRF 관련) ==="
tail -20 /tmp/wsl-server.log 2>/dev/null | grep -E "\[CSRF\]|EBADCSRFTOKEN|ForbiddenError|Error:|EADDRINUSE|saveUninitialized|서버 시작" || echo "CSRF 로그 없음"

echo ""
echo "=== 10. 레지스터 테스트 (쿠키 + 토큰) ==="
CSRF=$(cat /tmp/wsl-final-cookies.txt 2>/dev/null | grep "csrf_token" | awk -F'\t' '{print $NF}' | cut -d'|' -f1)
if [ -n "$CSRF" ]; then
    echo "CSRF 토큰: ${CSRF:0:30}..."
    curl -s -b /tmp/wsl-final-cookies.txt -X POST http://localhost:3001/api/users/register \
      -H "Content-Type: application/json" \
      -H "x-csrf-token: $CSRF" \
      -d '{"email":"finaltest@s.kimcheon.hs.kr","password":"test1234","nickname":"최종테스트"}' 2>&1
else
    echo "CSRF 토큰 추출 실패"
fi
