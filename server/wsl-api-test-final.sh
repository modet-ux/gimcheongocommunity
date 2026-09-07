#!/bin/bash
set -e
cd /root/school-community-server

echo "=== 1. CSRF 토큰 발급 ==="
CSRF_RESPONSE=$(curl -s http://localhost:3001/api/csrf-token)
echo "CSRF 응답: $CSRF_RESPONSE"

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | sed 's/.*"csrfToken":"//;s/".*$//')
echo "토큰: ${CSRF_TOKEN:0:30}..."

echo ""
echo "=== 2. CSRF 쿠키 발급 ==="
curl -s -c /tmp/wsl-cookies.txt http://localhost:3001/api/csrf-token > /tmp/csrf-cookie-response.json 2>/dev/null
echo "쿠키 응답: $(cat /tmp/csrf-cookie-response.json 2>/dev/null || echo "응답 없음")"

echo ""
echo "=== 3. 쿠키 파일 확인 ==="
echo "--- 전체 쿠키 파일 ---"
cat /tmp/wsl-cookies.txt 2>/dev/null | grep -v "^#" | grep -v "^$" || echo "쿠키 없음"

echo ""
echo "=== 4. 쿠키 + CSRF 헤더 포함 회원가입 ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/users/register \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{"email":"kim@s.kimcheon.hs.kr","password":"kim1234","nickname":"김학생"}' 2>&1

echo ""
echo "=== 5. 로그인 (쿠키 + CSRF 헤더) ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/users/login \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{"email":"kim@s.kimcheon.hs.kr","password":"kim1234"}' 2>&1

echo ""
echo "=== 6. 게시글 작성 (쿠키 + CSRF 헤더) ==="
curl -s -b /tmp/wsl-cookies.txt -X POST http://localhost:3001/api/posts \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF_TOKEN" \
  -d '{"title":"안녕하세요","content":"김천고 커뮤니티 테스트 게시글입니다.","tags":["공지"]}' 2>&1

echo ""
echo "=== 7. 게시글 목록 ==="
curl -s http://localhost:3001/api/posts 2>&1 | python3 -c "import json,sys; d=json.load(sys.stdin); print('총 게시글:', len(d.get('posts',[])))" 2>/dev/null || echo "게시글 목록 조회 실패"

echo ""
echo "=== 8. 서버 로그 (최근 20줄) ==="
tail -20 /tmp/wsl-server.log 2>/dev/null || echo "로그 없음"
