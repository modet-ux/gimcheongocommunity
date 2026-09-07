import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import connectRedis from "connect-redis";
import { createClient } from "redis";
import { db, schema } from "./db/index.js";
import { errorHandler } from "./lib/errors.js";
import { validateSession } from "./lib/session-middleware.js";
import usersRouter from "./routes/users.js";
import postsRouter from "./routes/posts.js";
import commentsRouter from "./routes/comments.js";
import adminRouter from "./routes/admin.js";
import uploadRouter from "./routes/upload.js";
import { configureRateLimiter } from "./lib/rate-limit.js";
import { csrfProtectionMiddleware, csrfTokenRouter } from "./lib/csrf.js";
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import argon2 from "@node-rs/argon2";

config();

const app = express();
const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = parseInt(process.env.PORT || "3001", 10);

// 환경변수 확인
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
  console.error("서버를 시작하려면 .env 파일에 DATABASE_URL을 설정해주세요.");
  process.exit(1);
}

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
    },
  },
}));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// 비공개 교내 커뮤니티: 모든 검색엔진 색인 차단
app.use((_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  next();
});
app.get("/robots.txt", (_req, res) => {
  res.type("text/plain").send(`User-agent: *
Disallow: /
`);
});

if (process.env.NODE_ENV !== "production") {
  app.use("/uploads", express.static(path.join(SERVER_ROOT, "uploads")));
}

// 세션 설정
const redisUrl = process.env.REDIS_URL;
let redisStore;

// Redis 세션은 명시적으로 활성화한 경우에만 사용한다.
// Redis가 설치되지 않은 로컬 개발 환경에서는 메모리 세션으로 안전하게 폴백한다.
if (redisUrl && process.env.REDIS_SESSION_STORE === "true") {
  const redisClient = createClient({ url: redisUrl });
  redisClient.connect().then(() => {
    console.log("Redis 연결 성공");
  }).catch(() => {
    console.warn("Redis 연결 실패, 인메모리 세션 사용");
  });
  redisStore = new connectRedis({ client: redisClient });
} else {
  console.log("인메모리 세션 사용 (Redis 세션 비활성화)");
}

app.use(session({
  name: "school-session",
  secret: process.env.SESSION_SECRET || "development-secret-change-me",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
  store: redisStore || undefined,
}));

// CSRF 토큰 발급 라우트
app.use("/api", csrfTokenRouter());

// CSRF 보호 미들웨어 (POST/PUT/DELETE 등에 적용)
app.use(csrfProtectionMiddleware);

// 세션 검증 미들웨어
app.use(validateSession);

// Rate Limiting
configureRateLimiter(app);

app.get("/health", (_req, res) => {
  const body = JSON.stringify({ status: "ok", timestamp: new Date().toISOString() });
  res.status(200).type("application/json").set("Content-Length", String(Buffer.byteLength(body))).end(body);
});

// API 라우트
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/posts", commentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/uploads", uploadRouter);

// 프로덕션에서는 클라이언트 정적 파일도 같은 도메인에서 제공한다.
// Cloudflare DNS/CDN 뒤에 API와 프론트를 함께 두면 세션 쿠키와 상대 경로 API가 그대로 동작한다.
if (process.env.NODE_ENV === "production") {
  const clientDistDir = process.env.CLIENT_DIST_DIR || path.resolve(SERVER_ROOT, "../client/dist");
  app.use(express.static(clientDistDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/health" || req.path === "/robots.txt") {
      next();
      return;
    }
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

// 오류 핸들러 (반드시 마지막)
app.use(errorHandler);

async function initAdmin() {
  if (process.env.NODE_ENV === "production") return;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword) return;

  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@school.kr";
    const existing = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, adminEmail),
    });
    const anyAdmin = existing ?? await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.role, "ADMIN"),
    });
    if (!anyAdmin) {
      const hash = await argon2.hash(adminPassword, {
        algorithm: argon2.Algorithm.Argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      await db.insert(schema.users).values({
        email: adminEmail,
        passwordHash: hash,
        nickname: "ㅇㅇ",
        role: "ADMIN",
        status: "ACTIVE",
      });
      console.log("관리자 계정이 생성되었습니다.");
    }
  } catch (err) {
    console.error("관리자 초기화 오류:", err);
  }
}

async function waitForDatabase(maxAttempts = 5): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await db.select({ now: sql`now()` }).from(schema.users).limit(1);
      console.log("DB 연결 성공");
      return;
    } catch (err) {
      lastError = err;
      console.warn(`DB 연결 재시도 ${attempt}/${maxAttempts}`);
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function startServer() {
  try {
    await waitForDatabase();
    await initAdmin();
  } catch (err) {
    console.error("DB 초기화 실패. 서버를 시작하지 않습니다:", err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`서버: http://localhost:${PORT}`);
    console.log(`프론트엔드: ${process.env.CLIENT_ORIGIN || "http://localhost:5173"}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  void startServer();
}

export default app;
