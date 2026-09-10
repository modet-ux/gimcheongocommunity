import { doubleCsrf } from "csrf-csrf";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

// csrf-csrf v3: doubleCsrf 팩토리 함수로 미들웨어 객체 생성
const {
  generateToken,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: () => {
    const sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret) {
      throw new Error("SESSION_SECRET이 설정되지 않았습니다.");
    }
    return sessionSecret;
  },
  // Double Submit Cookie 방식은 토큰 쿠키와 요청 헤더의 쌍을
  // 서버 비밀키로 검증하므로 세션 ID를 식별자에 포함하지 않는다.
  // 세션 쿠키가 아직 저장되지 않은 최초 요청에서도 발급 토큰과
  // 다음 보호 요청의 검증 기준이 동일해야 한다.
  getSessionIdentifier: () => "",
  cookieName: "csrf_token",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  },
  size: 64,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
});

// GET /api/csrf-token - CSRF 토큰 발급 라우트 팩토리
export function csrfTokenRouter() {
  const router = Router();
  router.get("/csrf-token", (req: Request, res: Response) => {
    const csrfToken = generateToken(req, res, true);
    res.json({ csrfToken });
  });
  return router;
}

// CSRF 보호 미들웨어 (POST/PUT/PATCH/DELETE 등에 적용)
// OPTIONS 프리플라이트는 자동으로 통과, GET/HEAD도 무시됨
export function csrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const csrfHeader = String(req.headers["x-csrf-token"] || "");
  const csrfCookie = String(req.cookies?.csrf_token || "");
  const csrfCookieParts = csrfCookie.split("|");

  // csrf_token 쿠키의 URL 디코딩 (Set-Cookie로 %7C 인코딩된 값을 처리)
  if (req.cookies && req.cookies["csrf_token"]) {
    try {
      req.cookies["csrf_token"] = decodeURIComponent(req.cookies["csrf_token"]);
    } catch (e) {
      // 디코딩 실패 시 원본 유지
    }
  }

  // csrf-csrf의 doubleCsrfProtection은 내부적으로 메서드/쿠키 체크를 수행하며,
  // CSRF 토큰이 유효하지 않으면 403 Forbidden 오류를 발생시킴
  try {
    doubleCsrfProtection(req, res, next);
  } catch (err) {
    const e = err as Error & { statusCode?: number; code?: string; name?: string };
    if (e.code === "EBADCSRFTOKEN" || e.name === "ForbiddenError") {
      return res.status(403).json({
        error: true,
        message: "CSRF 토큰이 유효하지 않습니다.",
        code: "EBADCSRFTOKEN",
      });
    }
    next(err);
  }
}

// 개별 라우트에서 사용할 CSRF 검증 미들웨어 (선택적)
export function csrfVerify(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // 이미 전역 CSRF 미들웨어가 적용된 경우 별도 검증 불필요
  next();
}
