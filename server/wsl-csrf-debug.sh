#!/bin/bash
set -e

echo "=== 1. CSRF 토큰 발급 (verbose) ==="
curl -v -c /tmp/wsl-csrf-cookies.txt http://localhost:3001/api/csrf-token 2>&1 | grep -E "Set-Cookie|Cookie|HTTP/|csrfToken|< |^>"

echo ""
echo "=== 저장된 쿠키 파일 ==="
cat /tmp/wsl-csrf-cookies.txt 2>/dev/null | grep "csrf_token" || echo "csrf_token 쿠키 없음"

echo ""
echo "=== CSRF 토큰 값 ==="
TOKEN=$(cat /tmp/wsl-csrf-cookies.txt 2>/dev/null | grep "csrf_token" | awk -F'\t' '{print $NF}' | cut -d'|' -f1)
echo "토큰: $TOKEN"

echo ""
echo "=== POST 회원가입 (cookie + header 전송 확인, verbose) ==="
curl -v -b /tmp/wsl-csrf-cookies.txt -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $TOKEN" \
  -d '{"email":"testdebug@s.kimcheon.hs.kr","password":"test1234","nickname":"디버깅"}' 2>&1 | grep -E ">|<|Cookie|HTTP/|EBADCSRFTOKEN|csrf_token"

echo ""
echo "=== 서버 로그 (CSRF 관련) ==="
tail -30 /tmp/wsl-server.log 2>/dev/null | grep -E "\[CSRF\]|EBADCSRFTOKEN|ForbiddenError" || echo "CSRF 로그 없음"
