# 김천고등학교 교내 커뮤니티 웹앱

React + TypeScript 프론트엔드와 Node.js + Express + TypeScript 백엔드로 구성된 학교 커뮤니티 웹애플리케이션입니다. PostgreSQL(Drizzle ORM), 세션 기반 인증, Argon2id 비밀번호 해싱, CSRF/Rate Limit 보호, Cloudflare R2 이미지 저장(로컬 fallback)을 사용합니다.

---

## 1. 프로젝트 실행 방법

### 사전 요구사항

- Node.js ≥ 20 (서버), Node.js ≥ 18 (WSL 실행 시 v18도 가능)
- PostgreSQL 서버 (WSL 또는 로컬)
- `.env` 파일에 환경변수 설정 (아래 2절 참조)

### 백엔드 실행

```bash
cd server
npm install
npm run dev
```

위 명령은 `tsx watch src/index.ts`를 실행하여 개발 모드에서 TypeScript 소스를 직접 실행합니다.  
프로덕션 빌드는 `npm run build` (tsc) 후 `npm start` (node dist/index.js)로 수행합니다.

기본 포트: **3001**

### 프론트엔드 실행

```bash
cd client
npm install
npm run dev
```

기본 포트: **5173**  
Vite 개발 서버가 실행되며, `/api`와 `/uploads` 요청은 백엔드(`localhost:3001`)로 프록시됩니다.

### 통합 확인

- 백엔드: http://localhost:3001/health
- 프론트엔드: http://localhost:5173

---

## 2. 필요한 환경변수

서버 루트(또는 `server/`)의 `.env` 파일에 아래 변수를 설정합니다.  
`.env`는 커밋하지 않으며, `.env.example`을 복사해 사용할 수 있습니다.

| 변수 | 설명 | 예시 | 필수 |
|------|------|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 | `postgresql://user:password@localhost:5432/school_community` | ✅ |
| `SESSION_SECRET` | 세션 암호화 비밀키 (랜덤 문자열, 충분히 길게) | `school-community-dev-secret-2024` | ✅ (운영 필수) |
| `REDIS_URL` | Redis 연결 URL (세션을 Redis에 저장하고자 할 때). 미설정 시 인메모리 세션 사용 | `redis://localhost:6379` | 선택 |
| `R2_ENDPOINT` | Cloudflare R2 endpoint | `https://<account>.r2.cloudflarestorage.com` | 이미지 R2 사용 시 |
| `R2_ACCESS_KEY_ID` | R2 접근 키 ID | - | 이미지 R2 사용 시 |
| `R2_SECRET_ACCESS_KEY` | R2 비밀 접근 키 | - | 이미지 R2 사용 시 |
| `R2_BUCKET_NAME` | R2 버킷 이름 | - | 이미지 R2 사용 시 |
| `CLIENT_ORIGIN` | 프론트엔드 Origin (CORS 허용) | `http://localhost:5173` | 선택 (기본값: `http://localhost:5173`) |
| `PORT` | 서버 포트 | `3001` | 선택 (기본값: `3001`) |
| `NODE_ENV` | 환경 모드 (`development` / `production`) | `development` | 선택 |
| `ADMIN_INITIAL_PASSWORD` | 개발 환경에서 최초 실행 시 자동 생성될 관리자 계정 비밀번호 | `admin1234!` | 개발 환경 선택 (미설정 시 자동 생성 안 함) |
| `ADMIN_EMAIL` | 관리자 계정 이메일 | `admin@school.kr` | 선택 (기본값: `admin@school.kr`) |

> ⚠️ `.env` 파일은 절대 Git에 커밋하지 마세요. `.env.example`만 커밋합니다.

---

## 3. 데이터베이스 생성 및 마이그레이션 방법

### PostgreSQL 준비

- 본 프로젝트는 WSL(Ubuntu) PostgreSQL 기준으로 구성되어 있습니다.
- ` listen_addresses = '*' ` 및 신뢰(trust) 기반 `pg_hba.conf` 설정을 권장합니다 (로컬 개발 환경).
- 데이터베이스 `school_community`를 생성합니다.

```sql
CREATE DATABASE school_community;
```

### 스키마 적용 (Drizzle 사용 시)

서버 디렉토리에서:

```bash
cd server
npx drizzle-kit push
```

위 명령은 `drizzle-kit.config.ts`에 정의된 스키마를 DB에 직접 반영합니다.

> 현재 프로젝트의 `drizzle-kit.config.ts`는 아래와 같이 dotenv를 로드한 후 구성됩니다.
> ```ts
> import { config } from "dotenv";
> config({ path: "./.env" });
> 
> import { defineConfig } from "drizzle-kit";
> export default defineConfig({
>   dialect: "postgresql",
>   schema: "./src/db/schema.ts",
>   out: "./db/migrations",
> });
> ```

### 수동 SQL 적용 (필요 시)

`server/db-setup.sql` 파일에 테이블 생성 SQL이 포함되어 있습니다.  
PostgreSQL 클라이언트로 직접 실행할 수 있습니다.

```bash
psql -U postgres -d school_community -f db-setup.sql
```

포함된 주요 테이블: `users`, `sessions`, `posts`, `comments`, `post_images`, `likes`, `reports`, `admin_logs`

---

## 4. 관리자 계정 생성 방법

### 개발 환경 자동 생성

`NODE_ENV !== "production"`이고 `ADMIN_INITIAL_PASSWORD`가 설정되어 있으면, 서버 시작 시 관리자 계정이 없으면 자동 생성됩니다.

- 이메일: `ADMIN_EMAIL` (기본 `admin@school.kr`)
- 비밀번호: `ADMIN_INITIAL_PASSWORD`
- 역할: `ADMIN`

### 수동 생성 (운영/필요시)

데이터베이스에 직접 INSERT하거나, 회원 가입 API를 통해 일반 계정을 만든 뒤 관리자 권한 부여 로직을 추가할 수 있습니다.  
현재 구현상 관리자 권한은 서버 측 `requireAdmin` 미들웨어로 보호됩니다.

---

## 5. 로컬 개발 방법

### 권장 워크플로우

1. 백엔드와 프론트엔드를 각각 별도 터미널에서 실행합니다.
2. 백엔드: `cd server && npm run dev`
3. 프론트엔드: `cd client && npm run dev`
4. 브라우저에서 `http://localhost:5173` 접속

### 프론트엔드 프록시

`client/vite.config.ts`의 proxy 설정이 `/api`와 `/uploads`를 백엔드로 전달합니다.  
WSL 등 원격 백엔드를 사용하는 경우 target을 해당 호스트 IP로 변경해야 합니다 (예: `http://192.168.x.x:3001`).

### TypeScript 타입 체크

```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```

### 환경변수 로컬 오버라이딩

`tsx` 실행 시 `.env` 자동 로딩이 불안정할 경우, 명령어에 직접 환경변수를 주입할 수 있습니다.

```bash
DATABASE_URL="postgresql://..." SESSION_SECRET="..." REDIS_URL="" npx tsx src/index.ts
```

---

## 6. 배포 방법

### 일반적인 배포 흐름

1. 환경변수를 운영 환경에 맞게 설정 (SESSION_SECRET, DATABASE_URL, R2_*, ADMIN_* 등)
2. `NODE_ENV=production`으로 설정
3. 프로덕션 빌드: `cd server && npm run build`
4. 빌드 결과(`dist/`)를 Node.js 프로세스로 실행: `node dist/index.js`
5. 필요시 역프록시(Nginx 등)로 프론트엔드 빌드 결과물 서빙 + 백엔드 프록시 구성
6. 이미지 저장소: Cloudflare R2 설정 및 환경변수 입력 (로컬 fallback은 운영에서 비활성화 권장)

### 보안 고려사항

- `SESSION_SECRET`은 길고 랜덤한 값으로 설정
- `NODE_ENV=production`일 때 쿠키 `secure` 플래그 활성화
- 관리자 초기 비밀번호는 운영 환경에서 자동 생성되지 않도록 `ADMIN_INITIAL_PASSWORD`를 설정하지 않음
- R2 사용 시 업로드 스키마/접근 권한 확인

---

## 7. 프로젝트 전체 구조

```
school-community/
├── .env                      # 서버 환경변수 (커밋 제외)
├── .env.example              # 환경변수 예시 (커밋 포함)
├── package.json              # 루트 패키지 (프라이빗 메타)
├── client/                   # 프론트엔드
│   ├── package.json
│   ├── vite.config.ts        # Vite 설정 + 프록시
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx           # 라우팅 구성
│   │   ├── index.css
│   │   ├── types.ts          # 공유 타입
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   └── useApi.ts
│   │   ├── components/
│   │   │   ├── Header.tsx
│   │   │   ├── PostList.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── Layout.tsx
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       ├── LoginPage.tsx
│   │       ├── RegisterPage.tsx
│   │       ├── PostDetailPage.tsx
│   │       ├── WritePage.tsx
│   │       ├── ProfilePage.tsx
│   │       ├── EditProfilePage.tsx
│   │       └── admin/
│   │           └── AdminPage.tsx
├── server/                   # 백엔드
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle-kit.config.ts # Drizzle 설정
│   ├── .env
│   ├── .env.example
│   ├── db-setup.sql          # 수동 DB 스키마 SQL (필요 시)
│   ├── src/
│   │   ├── index.ts          # 메인 진입점 (Express, 미들웨어, 라우트)
│   │   ├── db/
│   │   │   ├── index.ts     # DB 연결 (Drizzle + pg)
│   │   │   └── schema.ts    # 테이블 스키마
│   │   ├── lib/
│   │   │   ├── errors.ts    # AppError, 오류 핸들러
│   │   │   ├── auth.ts      # 인증 헬퍼, requireAuth, requireAdmin, 스키마
│   │   │   ├── session-middleware.ts
│   │   │   ├── csrf.ts      # csrf-csrf 기반 CSRF
│   │   │   └── rate-limit.ts
│   │   ├── routes/
│   │   │   ├── users.ts
│   │   │   ├── posts.ts
│   │   │   ├── comments.ts
│   │   │   ├── likes.ts
│   │   │   ├── admin.ts
│   │   │   └── upload.ts
│   │   ├── services/
│   │   │   └── image.ts     # Sharp + R2 업로드 서비스
│   │   └── types/
│   │       └── session.d.ts # 세션 타입 확장
│   └── uploads/              # 로컬 이미지 저장 디렉토리 (fallback)
├── shared/                   # (선택) 프론트/백 공유 코드
├── db/                       # (선택) DB 관련 보조 파일
└── README.md                 # 이 파일
```

### 기술 스택 요약

- **프론트엔드**: React 18 + TypeScript + Vite + Tailwind CSS + react-router-dom + react-hook-form + zod
- **백엔드**: Node.js + Express + TypeScript + Drizzle ORM + PostgreSQL(pg)
- **인증**: express-session + connect-redis(선택) / 인메모리, Argon2id(@node-rs/argon2)
- **보안**: csrf-csrf(CSRF), express-rate-limit + ioredis(Rate Limit), helmet, cors
- **이미지**: Sharp(처리) + Cloudflare R2(저장, fetch 기반) / 로컬 uploads 폴더 fallback
- **개발 도구**: tsx(TypeScript 직접 실행), drizzle-kit(스키마 관리), tsc(빌드)

---

> 📌 본 README는 개발 진행 상황에 따라 계속 갱신될 수 있습니다.
