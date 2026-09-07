#!/bin/bash
set -e
cd /root/school-community-server

export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

echo "=== 이전 서버 완전 종료 ==="
pkill -9 -f tsx 2>/dev/null || true
sleep 3

# 포트 확인 및 정리
if cat /proc/net/tcp 2>/dev/null | awk '{print $2}' | grep -qi "0BB9"; then
    echo "포트 3001 사용 중 - 강제 정리"
    fuser -k 3001/tcp 2>/dev/null || true
    sleep 3
fi

echo "=== 새 서버 실행 (정확한 작업 디렉토리) ==="
pwd
ls -la src/index.ts 2>/dev/null && echo "index.ts 존재함" || { echo "index.ts 없음!"; exit 1; }

> /tmp/wsl-server.log
nohup setsid npx tsx src/index.ts >> /tmp/wsl-server.log 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > /tmp/wsl-server.pid
echo "서버 PID: $NEW_PID"

sleep 10

echo "=== /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo "=== CSRF 토큰 테스트 ==="
curl -s http://localhost:3001/api/csrf-token 2>&1

echo "=== 서버 로그 (최근 20줄) ==="
tail -20 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"
