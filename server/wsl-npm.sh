#!/bin/bash
set -e
set -o pipefail
export LANG=C.UTF-8

WORKDIR=/root/school-community-server
mkdir -p "$WORKDIR" && echo "mkdir 성공: $WORKDIR" || { echo "mkdir 실패"; exit 1; }
cd "$WORKDIR" && echo "cd 성공: $(pwd)"

echo "=== 소스 복사 ==="
cp -r /mnt/c/Users/user/school-community/server/src "$WORKDIR/" 2>/dev/null || true
cp /mnt/c/Users/user/school-community/server/package.json "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/tsconfig.json "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/drizzle-kit.config.ts "$WORKDIR/"
cp /mnt/c/Users/user/school-community/server/.env "$WORKDIR/"
echo "소스 복사 완료"

echo "=== npm install ==="
npm install --ignore-scripts 2>&1 | tail -15
echo "npm install 완료"

echo "=== 모듈 확인 ==="
node -e "const pg=require('./node_modules/pg'); console.log('pg OK:', pg.version)" 2>&1
node -e "const csrf=require('./node_modules/csrf-csrf'); console.log('csrf-csrf OK')" 2>&1
node -e "const express=require('./node_modules/express'); console.log('express OK')" 2>&1
node -e "const a=require('./node_modules/@node-rs/argon2'); console.log('@node-rs/argon2 OK')" 2>&1
echo "=== 모듈 확인 완료 ==="
