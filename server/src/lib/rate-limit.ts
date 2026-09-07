import rateLimit from "express-rate-limit";
import { AppError } from "./errors.js";
import { db, schema } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import Redis from "ioredis";

// Redis 연결 (없으면 인메모리 대체)
let redisClient: Redis | null = null;
let useRedis = false;

function getRedisClient() {
  if (useRedis && redisClient) return redisClient;
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl);
      redisClient.on("error", () => {
        console.warn("Redis 연결 오류, 인메모리 모드로 전환");
        useRedis = false;
      });
      useRedis = true;
      return redisClient;
    } catch {
      console.warn("Redis 연결 실패, 인메모리 모드 사용");
    }
  }
  return null;
}

// 로그인 시도 제한 (IP당 과도한 로그인 시도 방지)
export function createLoginLimiter() {
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15분
    const maxAttempts = 10;

    let record = loginAttempts.get(ip);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
      loginAttempts.set(ip, record);
    }

    record.count++;

    // Redis에도 기록 (영구 저장)
    if (redisClient) {
      redisClient.hincrby(`login:${ip}`, "count", 1);
      redisClient.expire(`login:${ip}`, Math.ceil(windowMs / 1000));
    }

    if (record.count > maxAttempts) {
      const remaining = Math.ceil((record.resetAt - now) / 1000);
      res.status(429).json({
        error: true,
        message: `Too many login attempts. Please try again in ${remaining} seconds.`,
        retryAfter: remaining,
      });
      return;
    }

    res.setHeader("X-RateLimit-Login-Remaining", (maxAttempts - record.count).toString());
    next();
  };
}

// 일반 API Rate Limiting
function createApiRateLimiter() {
  const windowMs = 60 * 1000; // 1분
  const maxRequests = 100; // 분당 100회

  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: true,
      message: "Too many requests. Please try again later.",
    },
    keyGenerator: (req) => {
      return req.ip || "unknown";
    },
    skip: (req) => {
      // 정적 파일, CSRF 토큰 발급 등은 제외
      return req.path === "/api/csrf-token" || req.path.startsWith("/health");
    },
  });
}

// 로그인 라우트 전용 Rate Limit (더 엄격하게)
export function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 15, // 15분당 15회
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: true,
      message: "Too many login attempts. Please try again in 15 minutes.",
    },
    keyGenerator: (req) => {
      return req.body?.email || req.ip || "unknown";
    },
    skip: (req) => req.method !== "POST",
  });
}

// 이미지 업로드 Rate Limit
export function createUploadRateLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    max: 10, // 분당 10회 업로드
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: true,
      message: "Too many upload requests.",
    },
  });
}

// 애플리케이션 전체에 Rate Limiter 적용
export function configureRateLimiter(app: import("express").Application): void {
  // 일반 API Rate Limiting
  app.use(createApiRateLimiter());

  // 로그인 API 전용 Rate Limit (별도 라우터에 적용)
  // upload 라우터 전용 Rate Limit (별도 라우터에 적용)
}
