#!/bin/bash
# WSL Linux용 npm 의존성 설치 (서버 디렉토리 내)
set -e

TARGET="/mnt/c/Users/user/school-community/server"
cd "$TARGET"

echo "=== npm install --ignore-scripts 시작 ==="
npm install --ignore-scripts 2>&1 | tail -5
echo "=== 설치 완료 ==="
ls node_modules/.package-lock.json 2>/dev/null && echo "node_modules OK" || echo "FAIL"

echo "=== esbuild 설치 (postinstall 스크립트 우회) ==="
npm install esbuild --ignore-scripts 2>&1 | tail -3
ls node_modules/esbuild/package.json 2>/dev/null && echo "esbuild OK" || echo "esbuild FAIL"
