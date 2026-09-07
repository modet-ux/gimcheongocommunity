#!/bin/bash
set -e
cd /root/school-community-server

# 1. 최신 index.ts 복사
echo "=== 최신 source 복사 ==="
cp /mnt/c/Users/user/school-community/server/src/index.ts ./src/index.ts 2>&1
cp /mnt/c/Users/user/school-community/server/src/lib/csrf.ts ./src/lib/csrf.ts 2>/dev/null || true
echo "소스 복사 완료"

# 2. cookie-parser 확인
echo "=== cookie-parser 확인 ==="
if node -e "require('cookie-parser')" 2>/dev/null; then
    echo "cookie-parser 설치됨"
else
    echo "cookie-parser 설치 중..."
    npm install cookie-parser --save 2>&1 | tail -3
fi

# 3. 기존 서버 종료
echo "=== 기존 서버 종료 ==="
pkill -9 -f "tsx src/index.ts" 2>/dev/null || true
sleep 2
echo "기존 서버 종료 완료"

# 4. 포트 정리 확인
echo "=== 포트 확인 ==="
if cat /proc/net/tcp 2>/dev/null | awk '{print $2}' | grep -qi "0BB9"; then
    echo "포트 3001 여전히 사용 중 - 강제 정리"
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 2
fi

# 5. 새 서버 실행
export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

echo "=== 새 서버 실행 ==="
> /tmp/wsl-server.log
nohup setsid npx tsx src/index.ts >> /tmp/wsl-server.log 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > /tmp/wsl-server.pid
echo "서버 PID: $NEW_PID"

# 6. health 체크 대기
sleep 8

echo "=== /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo "=== 서버 로그 (최근 15줄) ==="
tail -15 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"

echo "=== CSRF 토큰 테스트 ==="
curl -s http://localhost:3001/api/csrf-token 2>&1 || echo "CSRF 토큰 오류"
