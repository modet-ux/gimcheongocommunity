#!/bin/bash
# WSL 서버 백그라운드 실행 (프로세스 유지)
set -e
cd /root/school-community-server

export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

# nohup으로 프로세스 분리 실행
nohup npx tsx src/index.ts > /tmp/wsl-server.log 2>&1 &
SERVER_PID=$!
echo "서버 PID: $SERVER_PID"

# 프로세스 확인
sleep 2
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "서버 실행 중 (PID: $SERVER_PID)"
else
    echo "서버 실행 실패"
    cat /tmp/wsl-server.log 2>/dev/null | tail -20
    exit 1
fi

# health 체크 대기
sleep 5
echo "=== /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"
