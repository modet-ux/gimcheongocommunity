#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. CSRF 토큰 발급 ==="
RESPONSE=$(curl -s http://localhost:3001/api/csrf-token)
echo "응답: $RESPONSE"

CSRF=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['csrfToken'])" 2>/dev/null || echo "$RESPONSE" | sed 's/.*"csrfToken":"//;s/".*$//')
echo "토큰: ${CSRF:0:30}..."

echo ""
echo "=== 2. CSRF 쿠키 발급 (cookie.txt 저장) ==="
curl -s -c /tmp/wsl-cookies.txt http://localhost:3001/api/csrf-token > /tmp/csrf2.json
echo "응답: $(cat /tmp/csrf2.json)"
echo "--- 쿠키 파일 (csrf_token) ---"
grep "csrf_token" /tmp/wsl-cookies.txt 2>/dev/null || echo "csrf_token 쿠키 없음"

echo ""
echo "=== 3. 회원가입 (CSRF 토큰 + 쿠키) ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"kim@s.kimcheon.hs.kr","password":"kim1234","nickname":"김학생"}' 2>&1

echo ""
echo "=== 4. 로그인 (CSRF 토큰 + 쿠키) ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/users/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d '{"email":"kim@s.kimcheon.hs.kr","password":"kim1234"}' 2>&1

echo ""
echo "=== 5. 게시글 작성 (CSRF 토큰 + 쿠키) ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -d '{"title":"안녕하세요","content":"김천고 커뮤니티 테스트 게시글입니다.","tags":["공지"]}' 2>&1

echo ""
echo "=== 6. 게시글 목록 ==="
curl -s http://localhost:3001/api/posts 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('총 게시글:', d.get('posts',[]).__len__())" 2>/dev/null || echo "게시글 목록 조회 실패"

echo ""
echo "=== 7. 서버 로그 (최근 15줄) ==="
tail -15 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"
