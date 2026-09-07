#!/bin/bash
# WSL 내부에서 학교 커뮤니티 서버 실행
set -e

cd /mnt/c/Users/user/school-community/server

export NODE_PATH=/tmp/school-server/node_modules
export DATABASE_URL="postgresql://user:password@localhost:5432/school_community"
export SESSION_SECRET="school-community-dev-secret-2024"
export REDIS_URL=""
export NODE_ENV="development"
export PORT="3001"

echo "=== 환경변수 확인 ==="
echo "DATABASE_URL: $DATABASE_URL"
echo "SESSION_SECRET: ${SESSION_SECRET:0:10}..."

echo "=== tsx 실행 ==="
npx tsx src/index.ts 2>&1