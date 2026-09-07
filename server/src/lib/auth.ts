import { Request, Response, NextFunction } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, sql } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    res.status(401).json({ error: true, message: "인증이 필요합니다." });
    return;
  }

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.id, sessionId),
      sql`${schema.sessions.expiresAt} > now()`
    ),
  });

  if (!session) {
    res.status(401).json({ error: true, message: "세션이 만료되었습니다." });
    return;
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, session.userId),
    columns: { status: true, role: true },
  });

  if (!user || user.status !== "ACTIVE") {
    res.status(401).json({ error: true, message: "사용자 계정이 유효하지 않습니다." });
    return;
  }

  req.userId = session.userId;
  req.isAdmin = user.role === "ADMIN";
  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.userId) {
    res.status(401).json({ error: true, message: "인증이 필요합니다." });
    return;
  }

  if (!req.isAdmin) {
    res.status(403).json({ error: true, message: "관리자 권한이 필요합니다." });
    return;
  }

  next();
}
