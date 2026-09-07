import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, desc, like, or, sql, count, inArray, isNull, isNotNull, asc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../lib/auth.js";
import { randomUUID } from "node:crypto";

const router = Router();

// ==================== GET /api/posts/:id/comments - 댓글 목록 ====================
router.get("/:postId/comments", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const postId = req.params.postId;

    const comments = await db.query.comments.findMany({
      where: eq(schema.comments.postId, postId),
      orderBy: [asc(schema.comments.createdAt)],
      with: {
        author: {
          columns: {
            id: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
    });

    // 대댓글 구조화
    const commentMap = new Map<string, any>();
    const topLevel: any[] = [];

    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    commentMap.forEach((comment) => {
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        topLevel.push(comment);
      }
    });

    // 좋아요 여부 추가
    if (req.userId && comments.length > 0) {
      const likes = await db.query.likes.findMany({
        where: and(
          eq(schema.likes.userId, req.userId),
          eq(schema.likes.targetType, "COMMENT"),
          inArray(schema.likes.targetId, comments.map((c) => c.id)),
        ),
        columns: { targetId: true, reaction: true },
      });

      const reactionMap = new Map(likes.map((l) => [l.targetId, l.reaction]));

      const withLikes = (commentList: any[]): any[] => {
        return commentList.map((comment) => ({
          ...comment,
          userLiked: reactionMap.get(comment.id) === "LIKE",
          userReaction: reactionMap.get(comment.id) ?? null,
          replies: withLikes(comment.replies),
        }));
      };

      res.json({ comments: withLikes(topLevel) });
    } else {
      res.json({ comments: topLevel });
    }
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/posts/:postId/comments - 댓글 작성 ====================
router.post("/:postId/comments", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.postId;

    const commentSchema = z.object({
      content: z.string().min(1).max(2000),
      parentId: z.string().uuid().optional(),
    });

    const data = commentSchema.parse(req.body);

    // 부모 댓글이 있는 경우 확인
    if (data.parentId) {
      const parentComment = await db.query.comments.findFirst({
        where: and(
          eq(schema.comments.id, data.parentId),
          eq(schema.comments.postId, postId),
        ),
      });

      if (!parentComment) {
        res.status(404).json({ error: true, message: "부모 댓글을 찾을 수 없습니다." });
        return;
      }
    }

    const [newComment] = await db.insert(schema.comments)
      .values({
        id: randomUUID(),
        postId,
        authorId: userId,
        parentId: data.parentId || null,
        content: data.content,
        likeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id: schema.comments.id,
        postId: schema.comments.postId,
        authorId: schema.comments.authorId,
        parentId: schema.comments.parentId,
        content: schema.comments.content,
        likeCount: schema.comments.likeCount,
        createdAt: schema.comments.createdAt,
      });

    // 게시글 댓글 수 증가
    await db.update(schema.posts)
      .set({
        commentCount: sql`${schema.posts.commentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.posts.id, postId));

    // 작성자 정보
    const author = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: {
        id: true,
        nickname: true,
        profileImageUrl: true,
      },
    });

    res.status(201).json({
      comment: {
        ...newComment,
        author,
        replies: [],
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

// ==================== PATCH /api/posts/:postId/comments/:commentId - 댓글 수정 ====================
router.patch("/:postId/comments/:commentId", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.postId;
    const commentId = req.params.commentId;

    const comment = await db.query.comments.findFirst({
      where: and(
        eq(schema.comments.id, commentId),
        eq(schema.comments.postId, postId),
      ),
    });

    if (!comment) {
      res.status(404).json({ error: true, message: "댓글을 찾을 수 없습니다." });
      return;
    }

    // 권한 체크
    if (comment.authorId !== userId && !req.isAdmin) {
      res.status(403).json({ error: true, message: "수정할 권한이 없습니다." });
      return;
    }

    const { content } = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);

    await db.update(schema.comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(schema.comments.id, commentId));

    const updatedComment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
      with: {
        author: {
          columns: {
            id: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
    });

    res.json({ comment: updatedComment });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== DELETE /api/posts/:postId/comments/:commentId - 댓글 삭제 ====================
router.delete("/:postId/comments/:commentId", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.postId;
    const commentId = req.params.commentId;

    const comment = await db.query.comments.findFirst({
      where: and(
        eq(schema.comments.id, commentId),
        eq(schema.comments.postId, postId),
      ),
    });

    if (!comment) {
      res.status(404).json({ error: true, message: "댓글을 찾을 수 없습니다." });
      return;
    }

    // 권한 체크
    if (comment.authorId !== userId && !req.isAdmin) {
      res.status(403).json({ error: true, message: "삭제할 권한이 없습니다." });
      return;
    }

    // 삭제 전에 하위 답글 수를 계산해야 게시글 카운트를 정확히 줄일 수 있다.
    const childCount = await countChildComments(commentId);

    // 대댓글도 삭제 (CASCADE로 자동 삭제되지만 명시적 처리)
    // 먼저 대댓글들의 like 삭제
    const childIds = await getChildCommentIds(commentId);
    if (childIds.length > 0) {
      await db.delete(schema.likes)
        .where(inArray(schema.likes.targetId, childIds));
    }

    // 댓글 삭제 (CASCADE)
    await db.delete(schema.comments)
      .where(eq(schema.comments.id, commentId));

    // 게시글 댓글 수 감소
    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
    });

    if (post) {
      await db.update(schema.posts)
        .set({
          commentCount: sql`${schema.posts.commentCount} - ${1 + childCount}`,
          updatedAt: new Date(),
        })
        .where(eq(schema.posts.id, postId));
    }

    // 관리자 로그
    if (req.isAdmin) {
      const author = await db.query.users.findFirst({
        where: eq(schema.users.id, comment.authorId),
      });
      await db.insert(schema.adminLogs).values({
        adminId: userId,
        action: "comment_delete",
        targetType: "COMMENT",
        targetId: commentId,
        details: JSON.stringify({
          content: comment.content.slice(0, 100),
          deletedByAuthor: comment.authorId === userId,
          authorNickname: author?.nickname,
        }),
        createdAt: new Date(),
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/posts/:postId/comments/:commentId/like - 댓글 좋아요/싫어요 ====================
router.post("/:postId/comments/:commentId/like", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const commentId = req.params.commentId;
    const reaction = z.enum(["LIKE", "DISLIKE"]).catch("LIKE").parse(req.body?.reaction);
    const comment = await db.query.comments.findFirst({ where: eq(schema.comments.id, commentId) });

    if (!comment) {
      res.status(404).json({ error: true, message: "댓글을 찾을 수 없습니다." });
      return;
    }

    const existing = await db.query.likes.findFirst({
      where: and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, "COMMENT"), eq(schema.likes.targetId, commentId)),
    });

    if (existing?.reaction === reaction) {
      await db.delete(schema.likes).where(eq(schema.likes.id, existing.id));
      await db.update(schema.comments).set({
        [reaction === "LIKE" ? "likeCount" : "dislikeCount"]: sql`${reaction === "LIKE" ? schema.comments.likeCount : schema.comments.dislikeCount} - 1`,
        updatedAt: new Date(),
      }).where(eq(schema.comments.id, commentId));
      res.json({ reaction: null, likeCount: Math.max(0, comment.likeCount - (reaction === "LIKE" ? 1 : 0)), dislikeCount: Math.max(0, comment.dislikeCount - (reaction === "DISLIKE" ? 1 : 0)) });
      return;
    }

    if (existing) {
      await db.update(schema.likes).set({ reaction }).where(eq(schema.likes.id, existing.id));
      await db.update(schema.comments).set({
        likeCount: reaction === "LIKE" ? sql`${schema.comments.likeCount} + 1` : sql`${schema.comments.likeCount} - 1`,
        dislikeCount: reaction === "DISLIKE" ? sql`${schema.comments.dislikeCount} + 1` : sql`${schema.comments.dislikeCount} - 1`,
        updatedAt: new Date(),
      }).where(eq(schema.comments.id, commentId));
      res.json({
        reaction,
        likeCount: comment.likeCount + (reaction === "LIKE" ? 1 : -1),
        dislikeCount: comment.dislikeCount + (reaction === "DISLIKE" ? 1 : -1),
      });
      return;
    }

    await db.insert(schema.likes).values({ userId, targetType: "COMMENT", targetId: commentId, reaction, createdAt: new Date() });
    await db.update(schema.comments).set({
      [reaction === "LIKE" ? "likeCount" : "dislikeCount"]: sql`${reaction === "LIKE" ? schema.comments.likeCount : schema.comments.dislikeCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(schema.comments.id, commentId));

    res.json({
      reaction,
      likeCount: comment.likeCount + (reaction === "LIKE" ? 1 : 0),
      dislikeCount: comment.dislikeCount + (reaction === "DISLIKE" ? 1 : 0),
    });
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/posts/:postId/comments/:commentId/report - 댓글 신고 ====================
router.post("/:postId/comments/:commentId/report", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const commentId = req.params.commentId;

    const { reason } = z.object({ reason: z.string().min(10).max(500) }).parse(req.body);

    const existingReport = await db.query.reports.findFirst({
      where: and(
        eq(schema.reports.reporterId, userId),
        eq(schema.reports.targetType, "COMMENT"),
        eq(schema.reports.targetId, commentId),
      ),
    });

    if (existingReport) {
      res.status(400).json({ error: true, message: "이미 신고한 댓글입니다." });
      return;
    }

    const [report] = await db.insert(schema.reports).values({
      id: randomUUID(),
      reporterId: userId,
      targetType: "COMMENT",
      targetId: commentId,
      reason,
      status: "PENDING",
      createdAt: new Date(),
    }).returning();

    res.status(201).json({ report });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== 헬퍼 함수 ====================

async function getChildCommentIds(parentId: string): Promise<string[]> {
  const children = await db.query.comments.findMany({
    where: eq(schema.comments.parentId, parentId),
    columns: { id: true },
  });
  let ids = children.map((c) => c.id);
  for (const childId of children.map((c) => c.id)) {
    ids = ids.concat(await getChildCommentIds(childId));
  }
  return ids;
}

async function countChildComments(parentId: string): Promise<number> {
  const children = await db.query.comments.findMany({
    where: eq(schema.comments.parentId, parentId),
    columns: { id: true },
  });
  let count = children.length;
  for (const child of children) {
    count += await countChildComments(child.id);
  }
  return count;
}

export default router;
