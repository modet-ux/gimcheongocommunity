import { Router, Request, Response, NextFunction } from "express";
import { db, schema } from "../db/index";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../lib/auth";
import { AppError } from "../lib/errors";

const router = Router();

// ============ POST /api/likes/:targetType/:targetId - 좋아요/취소 ============
router.post("/:targetType/:targetId", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const targetType = req.params.targetType as "POST" | "COMMENT";
    const targetId = req.params.targetId;
    const likesTable = schema.likes;

    if (targetType !== "POST" && targetType !== "COMMENT") {
      res.status(400).json({ error: true, message: "지원하지 않는 대상 타입입니다." });
      return;
    }

    const existingLike = await db.query.likes.findFirst({
      where: and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, targetType as "POST" | "COMMENT"),
        eq(likesTable.targetId, targetId),
      ),
    });

    if (existingLike) {
      // 좋아요 취소
      await db.delete(likesTable).where(
        and(
          eq(likesTable.userId, userId),
          eq(likesTable.targetType, targetType as "POST" | "COMMENT"),
          eq(likesTable.targetId, targetId),
        )
      );

      res.json({ liked: false });
      return;
    }

    // 좋아요 추가
    await db.insert(likesTable).values({
      userId,
      targetType: targetType as "POST" | "COMMENT",
      targetId,
      createdAt: new Date(),
    });

    res.json({ liked: true });
  } catch (err) {
    next(err);
  }
});

// ============ GET /api/likes/check - 좋아요 여부 확인 ============
router.get("/check", requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const targetType = req.query.targetType as string;
    const targetId = req.query.targetId as string;

    if (!targetType || !targetId) {
      res.status(400).json({ error: true, message: "targetType과 targetId가 필요합니다." });
      return;
    }

    const likesTable = schema.likes;
    const like = await db.query.likes.findFirst({
      where: and(
        eq(likesTable.userId, userId),
        eq(likesTable.targetType, targetType as "POST" | "COMMENT"),
        eq(likesTable.targetId, targetId),
      ),
    });

    res.json({ liked: !!like });
  } catch (err) {
    next(err);
  }
});

export default router;
