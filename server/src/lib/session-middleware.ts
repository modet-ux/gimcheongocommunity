import { Request, Response, NextFunction } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, or } from "drizzle-orm";
import { z } from "zod";

// 세션 선언 병합 (express-session의 SessionData에 속성 추가)
declare module "express-session" {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
  }
}

// 세션 검증 미들웨어
export function validateSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const sessionId = req.session?.id;
  const userId = req.session?.userId;

  if (sessionId && userId) {
    (req as any).userId = userId;
    (req as any).isAdmin = req.session?.isAdmin || false;
  }

  next();
}

// 현재 세션의 사용자 정보 조회
export async function getCurrentUser(
  userId: string
): Promise<typeof schema.users.$inferSelect | undefined> {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });
  return user;
}

// 관리자 권한 검증 헬퍼
export async function checkAdminAccess(
  userId: string
): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: and(
      eq(schema.users.id, userId),
      eq(schema.users.role, "ADMIN"),
      or(eq(schema.users.status, "ACTIVE"), eq(schema.users.status, "SUSPENDED"))
    ),
  });
  return !!user;
}

// 세션 기반 요청 타입
export interface AuthenticatedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

// Zod 스키마 (DB 스키마와 이름 충돌 방지 위해 별도 이름 사용)
export const registerSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").max(255),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다.").max(128),
  nickname: z.string().min(2, "닉네임은 최소 2자 이상이어야 합니다.").max(50),
});

export const loginSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").max(255),
  password: z.string().min(1, "비밀번호를 입력해주세요.").max(128),
});

export const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(50).optional(),
  profileImageUrl: z.string().url().nullable().optional(),
});
