#!/bin/bash
set -e
TD=/tmp/school-community-server
cd "$TD"
echo "작업 디렉토리: $(pwd)"

echo "=== npm install 시작 ==="
npm install --ignore-scripts 2>&1 | tail -15
echo "npm install 완료"

echo "=== esbuild 버전 확인 ==="
ESBUILD_VER=$(node -e "const p=require('./package.json'); console.log(p.devDependencies.esbuild ? p.devDependencies.esbuild.replace(/^\^/,'') : '없음')")
echo "esbuild 버전: $ESBUILD_VER"

if [ "$ESBUILD_VER" != "없음" ] && [ -n "$ESBUILD_VER" ]; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then ARCH="x64"; elif [ "$ARCH" = "aarch64" ]; then ARCH="arm64"; fi
  URL="https://github.com/evanw/esbuild/releases/download/${ESBUILD_VER}/esbuild-linux-${ARCH}-${ESBUILD_VER}.tar.gz"
  echo "URL: $URL"
  TMP=$(mktemp -d)
  cd "$TMP"
  curl -L --connect-timeout 30 -o esbuild.tar.gz "$URL" 2>&1 | tail -3
  tar xzf esbuild.tar.gz 2>&1 | tail -2
  cp -f package/bin/esbuild "$TD/node_modules/esbuild/bin/esbuild"
  chmod +x "$TD/node_modules/esbuild/bin/esbuild"
  cd /
  rm -rf "$TMP"
  echo "esbuild 바이너리 설치 완료"
  "$TD/node_modules/esbuild/bin/esbuild" --version 2>&1
fi

echo "=== 모듈 로드 테스트 ==="
node -e "const pg=require('./node_modules/pg'); console.log('pg OK:', pg.version)" 2>&1
node -e "const csrf=require('./node_modules/csrf-csrf'); console.log('csrf-csrf OK')" 2>&1
node -e "const esbuild=require('./node_modules/esbuild'); console.log('esbuild OK:', esbuild.version)" 2>&1
node -e "const sharp=require('./node_modules/sharp'); console.log('sharp OK')" 2>&1
node -e "const a=require('./node_modules/@node-rs/argon2'); console.log('@node-rs/argon2 OK')" 2>&1
node -e "const express=require('./node_modules/express'); console.log('express OK')" 2>&1

echo "=== WSL 서버 환경 구축 완료 ==="
