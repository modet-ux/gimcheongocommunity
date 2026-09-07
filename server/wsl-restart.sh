#!/bin/bash
set -e
cd /root/school-community-server

export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

echo "=== 이전 서버 정리 ==="
pkill -f "tsx src/index.ts" 2>/dev/null || true
sleep 2
rm -f /tmp/wsl-server.pid

echo "=== 서버 실행 ==="
nohup setsid npx tsx src/index.ts > /tmp/wsl-server.log 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > /tmp/wsl-server.pid
echo "서버 PID: $NEW_PID"

echo "=== 서버 준비 대기 ==="
sleep 8

echo "=== /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo "=== 서버 로그 (최근 20줄) ==="
tail -20 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"
