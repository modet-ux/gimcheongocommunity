# Cloudflare 배포 준비

## 권장 구조

현재 앱은 Express, Sharp, Argon2id, PostgreSQL, Redis를 사용하므로 API를 Cloudflare Workers로 바로 옮기는 구조가 아닙니다. 다음 구조가 안전합니다.

- Cloudflare DNS/Proxy: `community.example.com`을 애플리케이션 서버로 프록시
- 애플리케이션 서버: Docker 이미지로 Node/Express 실행
- PostgreSQL: 외부 관리형 PostgreSQL 또는 운영 PostgreSQL
- Redis: 운영 Redis (세션 저장소)
- Cloudflare R2: 게시글·프로필 이미지 저장

프론트와 API를 같은 공개 도메인에서 제공하도록 준비했기 때문에 세션 쿠키와 `/api/*`, `/uploads/*` 상대 경로가 그대로 동작합니다.

## 1. Cloudflare 준비

1. Cloudflare에 도메인을 추가하고 네임서버를 변경합니다.
2. DNS에 애플리케이션 서버의 공인 IP 또는 호스트를 가리키는 `A`/`CNAME` 레코드를 추가합니다.
3. 프록시 상태를 **Proxied(주황색 구름)** 로 설정합니다.
4. SSL/TLS는 `Full (strict)`로 설정하고, 원본 서버에도 유효한 TLS 인증서를 설치합니다.
5. R2 버킷을 만들고 공개 이미지용 커스텀 도메인 또는 R2 공개 URL을 연결합니다.

## 2. 애플리케이션 환경변수

운영 서버에는 `server/.env.example`의 개발 기본값을 그대로 사용하지 말고 다음을 실제 값으로 설정합니다.

```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
SESSION_SECRET=<32자 이상 무작위 값>
CLIENT_ORIGIN=https://community.example.com
REDIS_URL=redis://...
REDIS_SESSION_STORE=true
R2_UPLOAD_ENABLED=true
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=school-community-images
R2_PUBLIC_URL=https://images.example.com
```

`ADMIN_INITIAL_PASSWORD`는 production에서 사용되지 않습니다. 실제 관리자 계정은 배포 전 데이터베이스에서 별도로 준비하고, 운영 비밀번호는 즉시 변경합니다.

## 3. 빌드 및 실행

프로젝트 루트에서 실행합니다.

```bash
docker build -t school-community .
docker run --env-file server/.env -p 3001:3001 school-community
```

헬스체크:

```bash
curl -f http://127.0.0.1:3001/health
```

응답이 `{"status":"ok",...}`인지 확인한 뒤 Cloudflare 프록시 도메인으로 다시 확인합니다.

## 4. 데이터베이스

배포 전에 운영 데이터베이스에 Drizzle migration을 적용합니다. 데이터가 있는 DB에서 `db:push`를 무작정 실행하지 말고, migration 파일과 `information_schema` 조회 결과를 확인합니다.

```bash
cd server
npm ci
npm run db:migrate
```

PostgreSQL·Redis 방화벽은 애플리케이션 서버에서만 접근 가능하도록 제한합니다.

## 5. 운영 전 체크리스트

- [ ] Cloudflare DNS 프록시와 `Full (strict)` 설정
- [ ] 운영 `DATABASE_URL`, `SESSION_SECRET`, Redis, R2 시크릿 등록
- [ ] `R2_UPLOAD_ENABLED=true`와 `R2_PUBLIC_URL` 확인
- [ ] DB migration 적용 및 관리자 계정 로그인 확인
- [ ] `/health`, 로그인, 글 작성, 댓글, 이미지 업로드 확인
- [ ] HTTPS에서 세션 쿠키가 생성되는지 확인
- [ ] Cloudflare 캐시에서 `/api/*`, `/health`를 캐시하지 않도록 설정
- [ ] 운영 로그·DB 백업·R2 수명주기 정책 설정

## 주의

Cloudflare Pages만으로 현재 Express 서버와 PostgreSQL/Redis/Sharp/Argon2id 런타임을 그대로 실행할 수 없습니다. Pages는 정적 프론트 배포에 사용할 수 있지만, 이 저장소의 현재 구조에서는 API를 별도 Node 런타임에 두고 Cloudflare DNS/Proxy를 앞단에 두는 방식이 배포 경로입니다.
