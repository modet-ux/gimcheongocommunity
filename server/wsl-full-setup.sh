#!/bin/bash
set -e
set -o pipefail
export LANG=C.UTF-8
export LC_ALL=C.UTF-8

WORKDIR=/tmp/wsl-server
mkdir -p "$WORKDIR"
cd "$WORKDIR"

echo "=== 소스 복사 ==="
cp -r /mnt/c/Users/user/school-community/server/src "$WORKDIR/" 2>/dev/null || true
cp /mnt/c/Users/user/school-community/server/package.json "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/tsconfig.json "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/drizzle-kit.config.ts "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/.env "$WORKDIR/"
echo "소스 복사 완료"

echo "=== npm install ==="
npm install --ignore-scripts 2>&1 | tail -20
echo "npm install 완료"

echo "=== 주요 모듈 확인 ==="
node -e "const pg=require('./node_modules/pg'); console.log('pg OK:', pg.version)" 2>&1
node -e "const csrf=require('./node_modules/csrf-csrf'); console.log('csrf-csrf OK')" 2>&1
node -e "const express=require('./node_modules/express'); console.log('express OK')" 2>&1
node -e "const a=require('./node_modules/@node-rs/argon2'); console.log('@node-rs/argon2 OK')" 2>&1

echo "=== 서버 실행 ==="
export DATABASE_URL="postgresql://user:***@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"
npx tsx src/index.ts > /tmp/wsl-server.log 2>&1 &
SERVER_PID=$!
echo "서버 PID: $SERVER_PID"

# 서버 준비 대기
sleep 8
echo "=== /health 확인 ==="
curl -s --connect-timeout 5 http://localhost:3001/health 2>&1 || echo "/health 연결 실패"

echo "=== 서버 로그 (최근 20줄) ==="
tail -20 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"
