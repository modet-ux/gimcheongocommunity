#!/bin/bash
set -e
TD=/tmp/school-community-server
cd "$TD"
echo "작업 디렉토리: $(pwd)"

if [ ! -f package.json ]; then
  echo "package.json 없음 - 소스 복사 필요"
  cp -r /mnt/c/Users/user/school-community/server/src/* "$TD/src/" 2>/dev/null || true
  cp /mnt/c/Users/user/school-community/server/package.json "$TD/"
  cp /mnt/c/Users/user/school-community/server/tsconfig.json "$TD/"
  cp /mnt/c/Users/user/school-community/server/drizzle-kit.config.ts "$TD/"
  cp /mnt/c/Users/user/school-community/server/.env "$TD/"
fi

echo "=== npm install ==="
npm install --ignore-scripts 2>&1 | tail -10
echo "npm install 완료"

ls node_modules/.package-lock.json 2>/dev/null && echo "node_modules 설치됨"

echo "=== esbuild 바이너리 확인 ==="
ESBUILD_VER=$(node -e "const p=require('./package.json'); console.log(p.devDependencies.esbuild ? p.devDependencies.esbuild.replace(/^\^/,'') : '')" 2>/dev/null || echo "")
echo "esbuild 버전: $ESBUILD_VER"

if [ -n "$ESBUILD_VER" ] && [ "$ESBUILD_VER" != "" ]; then
  ARCH=$(uname -m)
  [ "$ARCH" = "x86_64" ] && ARCH="x64" || [ "$ARCH" = "aarch64" ] && ARCH="arm64"
  URL="https://github.com/evanw/esbuild/releases/download/${ESBUILD_VER}/esbuild-linux-${ARCH}-${ESBUILD_VER}.tar.gz"
  echo "다운로드: $URL"
  TMP=$(mktemp -d)
  curl -L --connect-timeout 30 -o "$TMP/esbuild.tar.gz" "$URL" 2>&1 | tail -3
  tar xzf "$TMP/esbuild.tar.gz" -C "$TMP" 2>&1 | tail -2
  cp "$TMP/package/bin/esbuild" "$TD/node_modules/esbuild/bin/esbuild"
  chmod +x "$TD/node_modules/esbuild/bin/esbuild"
  rm -rf "$TMP"
  echo "esbuild 바이너리 설치 완료"
  "$TD/node_modules/esbuild/bin/esbuild" --version 2>&1 || echo "esbuild 버전 확인 실패"
fi

echo "=== 모듈 로드 테스트 ==="
node -e "const pg=require('./node_modules/pg'); console.log('pg OK:', pg.version)" 2>&1 || echo "pg FAIL"
node -e "const csrf=require('./node_modules/csrf-csrf'); console.log('csrf-csrf OK')" 2>&1 || echo "csrf FAIL"
node -e "const esbuild=require('./node_modules/esbuild'); console.log('esbuild OK:', esbuild.version)" 2>&1 || echo "esbuild FAIL"
node -e "const sharp=require('./node_modules/sharp'); console.log('sharp OK')" 2>&1 || echo "sharp FAIL"
node -e "const a=require('./node_modules/@node-rs/argon2'); console.log('@node-rs/argon2 OK')" 2>&1 || echo "argon2 FAIL"
node -e "const express=require('./node_modules/express'); console.log('express OK')" 2>&1 || echo "express FAIL"

echo "=== 환경 구축 완료 ==="
