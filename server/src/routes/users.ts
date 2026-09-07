import { Router } from "express";
import { db, schema } from "../db/index.js";
import argon2 from "@node-rs/argon2";
import { z } from "zod";
import { eq, and, like, or, sql } from "drizzle-orm";
import { AppError } from "../lib/errors.js";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../lib/auth.js";
import { v4 as uuidv4 } from "uuid";
import { addHours } from "date-fns";

const router = Router();

// Zod 스키마
const registerSchema = z.object({
  email: z.string().email("올바른 이메일 형식이 아닙니다.").max(255),
  password: z.string().min(8, "비밀번호는 최소 8자 이상이어야 합니다.").max(128),
  nickname: z.string().min(2, "닉네임은 최소 2자 이상이어야 합니다.").max(50),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  nickname: z.string().min(2).max(50).optional(),
  profileImageUrl: z.union([z.string().url(), z.string().regex(/^\/uploads\//)]).nullable().optional(),
  statusMessage: z.string().max(160).nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

// ==================== GET /api/users/me - 현재 사용자 정보 ====================
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, req.userId!),
      columns: {
      id: true,
      email: true,
      nickname: true,
      profileImageUrl: true,
      statusMessage: true,
      role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: true, message: "사용자를 찾을 수 없습니다." });
      return;
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// ==================== PATCH /api/users/me - 프로필 수정 ====================
router.patch("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const { nickname, profileImageUrl, statusMessage } = updateProfileSchema.parse(req.body);

    const updates: Record<string, any> = {};
    const usersTable = schema.users;

    if (nickname !== undefined) {
      // 중복 닉네임 확인 (자기 자신 제외)
      const existing = await db.query.users.findFirst({
        where: and(eq(usersTable.nickname, nickname), sql`${usersTable.id} != ${userId}`),
      });
      if (existing) {
        res.status(400).json({ error: true, message: "이미 사용 중인 닉네임입니다." });
        return;
      }
      updates.nickname = nickname;
    }

    if (profileImageUrl !== undefined) {
      updates.profileImageUrl = profileImageUrl;
    }

    if (statusMessage !== undefined) {
      updates.statusMessage = statusMessage?.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: true, message: "변경할 내용이 없습니다." });
      return;
    }

    updates.updatedAt = new Date();

    await db.update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(usersTable.id, userId),
      columns: {
        id: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        statusMessage: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({ user: updatedUser });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== PATCH /api/users/me/password - 비밀번호 변경 ====================
router.patch("/me/password", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.userId!) });
    if (!user || !(await argon2.verify(user.passwordHash, data.currentPassword))) {
      res.status(400).json({ error: true, message: "현재 비밀번호가 올바르지 않습니다." }); return;
    }
    const passwordHash = await argon2.hash(data.newPassword, { algorithm: argon2.Algorithm.Argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    await db.update(schema.users).set({ passwordHash, updatedAt: new Date() }).where(eq(schema.users.id, req.userId!));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, req.userId!));
    res.clearCookie("session_id", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.json({ success: true, message: "비밀번호가 변경되었습니다. 다시 로그인해주세요." });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: true, message: "새 비밀번호는 8자 이상이어야 합니다." }); return; }
    next(err);
  }
});

// ==================== DELETE /api/users/me - 본인 계정 삭제 ====================
router.delete("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const currentPassword = z.object({ currentPassword: z.string().min(1) }).parse(req.body).currentPassword;
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, req.userId!) });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      res.status(400).json({ error: true, message: "현재 비밀번호가 올바르지 않습니다." }); return;
    }
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, req.userId!));
    await db.delete(schema.users).where(eq(schema.users.id, req.userId!));
    res.clearCookie("session_id", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
    res.json({ success: true, message: "계정이 삭제되었습니다." });
  } catch (err) {
    if (err instanceof z.ZodError) { res.status(400).json({ error: true, message: "현재 비밀번호를 입력해주세요." }); return; }
    next(err);
  }
});

// ==================== POST /api/users/register - 회원가입 ====================
router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    if (await isEmailTaken(data.email)) {
      res.status(400).json({ error: true, message: "이미 가입된 이메일입니다." });
      return;
    }

    if (await isNicknameTaken(data.nickname)) {
      res.status(400).json({ error: true, message: "이미 사용 중인 닉네임입니다." });
      return;
    }

    const passwordHash = await argon2.hash(data.password, {
      algorithm: argon2.Algorithm.Argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    const [newUser] = await db.insert(schema.users)
      .values({
        email: data.email,
        passwordHash,
        nickname: data.nickname,
        role: "USER",
        status: "ACTIVE",
      })
      .returning({ id: schema.users.id, email: schema.users.email, nickname: schema.users.nickname });

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        nickname: newUser.nickname,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== POST /api/users/login - 로그인 ====================
router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, data.email),
    });

    if (!user) {
      res.status(401).json({ error: true, message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      return;
    }

    if (user.status === "SUSPENDED") {
      res.status(403).json({ error: true, message: "계정이 정지 상태입니다." });
      return;
    }

    const validPassword = await argon2.verify(user.passwordHash, data.password);
    if (!validPassword) {
      res.status(401).json({ error: true, message: "이메일 또는 비밀번호가 올바르지 않습니다." });
      return;
    }

    // 세션 저장
    const sessionId = uuidv4();
    const expiresAt = addHours(new Date(), 24 * 7); // 7일

    await db.insert(schema.sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt,
    });

    res.cookie("session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== POST /api/users/logout - 로그아웃 ====================
router.post("/logout", async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session_id;
    if (sessionId) {
      await db.delete(schema.sessions)
        .where(eq(schema.sessions.id, sessionId));
    }

    res.clearCookie("session_id", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/users/:id/profile - 공개 프로필 ====================
router.get("/:id/profile", async (req, res, next) => {
  try {
    const userId = z.string().uuid().parse(req.params.id);
    const profile = await db.query.users.findFirst({
      where: and(eq(schema.users.id, userId), eq(schema.users.status, "ACTIVE")),
      columns: {
        id: true,
        nickname: true,
        profileImageUrl: true,
        statusMessage: true,
      },
    });

    if (!profile) {
      res.status(404).json({ error: true, message: "프로필을 찾을 수 없습니다." });
      return;
    }

    const posts = await db.query.posts.findMany({
      where: and(eq(schema.posts.authorId, userId), eq(schema.posts.isAnonymous, false)),
      columns: {
        id: true,
        title: true,
        category: true,
        isNotice: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
      },
      orderBy: (post, { desc }) => [desc(post.createdAt)],
      limit: 50,
    });

    res.json({ profile, posts });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "잘못된 프로필 주소입니다." });
      return;
    }
    next(err);
  }
});

// ==================== GET /api/users/search - 사용자 검색 (관리자) ====================
router.get("/search", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { q, status, page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string)));

    const usersTable = schema.users;
    const offset = (pageNum - 1) * limitNum;

    let whereCondition: any = undefined;
    if (q) {
      const searchTerm = `%${q}%`;
      whereCondition = or(
        like(usersTable.email, searchTerm),
        like(usersTable.nickname, searchTerm),
      );
    }
    if (status && status !== "ALL") {
      const statusValue = status as "ACTIVE" | "SUSPENDED";
      whereCondition = whereCondition
        ? and(whereCondition, eq(usersTable.status, statusValue))
        : eq(usersTable.status, statusValue);
    }

    const results = await db.query.users.findMany({
      where: whereCondition,
      orderBy: (u, { desc }) => [desc(u.createdAt)],
      limit: limitNum,
      offset,
      columns: {
        id: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const total = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(whereCondition as any);

    res.json({
      users: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total[0]?.count) || 0,
        totalPages: Math.ceil((Number(total[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== PATCH /api/users/:id/suspend - 계정 정지/해제 (관리자) ====================
router.patch("/:id/suspend", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const targetId = req.params.id;
    const action = req.body.action; // "suspend" or "unsuspend"

    if (action !== "suspend" && action !== "unsuspend") {
      res.status(400).json({ error: true, message: "잘못된 작업입니다." });
      return;
    }

    // 자기 자신은 정지 불가
    if (targetId === req.userId) {
      res.status(400).json({ error: true, message: "자신의 계정은 정지할 수 없습니다." });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, targetId),
    });

    if (!user) {
      res.status(404).json({ error: true, message: "사용자를 찾을 수 없습니다." });
      return;
    }

    const newStatus = action === "suspend" ? "SUSPENDED" : "ACTIVE";

    // 이미 해당 상태면 무시
    if (user.status === newStatus) {
      res.json({
        success: true,
        message: `계정이 이미 ${action === "suspend" ? "정지" : "활성"} 상태입니다.`,
      });
      return;
    }

    await db.update(schema.users)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(schema.users.id, targetId));

    // 관리자 로그
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!,
      action: `user_${action}`,
      targetType: "USER",
      targetId: targetId,
      details: JSON.stringify({
        targetNickname: user.nickname,
        targetEmail: user.email,
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `계정이 ${action === "suspend" ? "정지" : "해제"}되었습니다.`,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== DELETE /api/users/:id - 회원 삭제 (관리자) ====================
router.delete("/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const targetId = req.params.id;

    // 자기 자신은 삭제 불가
    if (targetId === req.userId) {
      res.status(400).json({ error: true, message: "자신의 계정은 삭제할 수 없습니다." });
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, targetId),
    });

    if (!user) {
      res.status(404).json({ error: true, message: "사용자를 찾을 수 없습니다." });
      return;
    }

    // 해당 사용자의 게시글, 댓글, 좋아요, 신고 등도 삭제 (CASCADE)
    await db.delete(schema.users)
      .where(eq(schema.users.id, targetId));

    // 관리자 로그
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!,
      action: "user_delete",
      targetType: "USER",
      targetId,
      details: JSON.stringify({
        targetNickname: user.nickname,
        targetEmail: user.email,
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: "회원이 삭제되었습니다.",
    });
  } catch (err) {
    next(err);
  }
});

// ==================== 헬퍼 함수 ====================

async function isEmailTaken(email: string, excludeUserId?: string): Promise<boolean> {
  const result = await db.query.users.findFirst({
    where: excludeUserId
      ? and(eq(schema.users.email, email), sql`${schema.users.id} != ${excludeUserId}`)
      : eq(schema.users.email, email),
  });
  return !!result;
}

async function isNicknameTaken(nickname: string, excludeUserId?: string): Promise<boolean> {
  const result = await db.query.users.findFirst({
    where: excludeUserId
      ? and(eq(schema.users.nickname, nickname), sql`${schema.users.id} != ${excludeUserId}`)
      : eq(schema.users.nickname, nickname),
  });
  return !!result;
}

export default router;
