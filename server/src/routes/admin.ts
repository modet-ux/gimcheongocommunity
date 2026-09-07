import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, asc, desc, like, or, sql, count, inArray, isNull, isNotNull } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";

const router = Router();

// ==================== 송설글 설정/관리 ====================
router.get("/songseol-settings", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const setting = await db.query.siteSettings.findFirst({ where: eq(schema.siteSettings.id, 1) });
    res.json({ songseolMinLikes: setting?.songseolMinLikes ?? 10 });
  } catch (err) { next(err); }
});

router.patch("/songseol-settings", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const value = Number(req.body?.songseolMinLikes);
    if (!Number.isInteger(value) || value < 0 || value > 1000000) { res.status(400).json({ message: "추천수 기준은 0~1,000,000의 정수여야 합니다." }); return; }
    await db.insert(schema.siteSettings).values({ id: 1, songseolMinLikes: value, updatedAt: new Date() }).onConflictDoUpdate({ target: schema.siteSettings.id, set: { songseolMinLikes: value, updatedAt: new Date() } });
    // 기준을 다시 저장하면 관리자가 이전에 해제한 글도 추천수 기준을 다시 적용한다.
    await db.update(schema.posts).set({ isSongseolExcluded: false, updatedAt: new Date() }).where(eq(schema.posts.isSongseolExcluded, true));
    res.json({ songseolMinLikes: value });
  } catch (err) { next(err); }
});

router.patch("/posts/:id/songseol", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (typeof req.body?.isSongseol !== "boolean" || (req.body?.isSongseolExcluded !== undefined && typeof req.body.isSongseolExcluded !== "boolean")) { res.status(400).json({ message: "송설글 설정값이 올바르지 않습니다." }); return; }
    const isSongseol = req.body.isSongseol;
    const [post] = await db.update(schema.posts).set({
      isSongseol,
      // 수동 해제는 추천수가 기준을 넘더라도 송설글에서 제외한다.
      isSongseolExcluded: req.body.isSongseolExcluded ?? !isSongseol,
      updatedAt: new Date(),
    }).where(eq(schema.posts.id, req.params.id)).returning({ id: schema.posts.id, isSongseol: schema.posts.isSongseol, isSongseolExcluded: schema.posts.isSongseolExcluded });
    if (!post) { res.status(404).json({ message: "게시글을 찾을 수 없습니다." }); return; }
    res.json({ post });
  } catch (err) { next(err); }
});

// ==================== GET /api/admin/notices - 공지 고정 관리 ====================
router.get("/notices", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res, next) => {
  try {
    const notices = await db
      .select({ id: schema.posts.id, title: schema.posts.title, noticePriority: schema.posts.noticePriority, createdAt: schema.posts.createdAt })
      .from(schema.posts)
      .where(eq(schema.posts.isNotice, true))
      .orderBy(asc(schema.posts.noticePriority), desc(schema.posts.createdAt));
    res.json({ notices });
  } catch (err) { next(err); }
});

router.patch("/notices/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const priority = Number(req.body?.noticePriority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 999) {
      res.status(400).json({ error: true, message: "고정 순서는 0~999의 정수여야 합니다." });
      return;
    }
    const updated = await db.update(schema.posts)
      .set({ noticePriority: priority, updatedAt: new Date() })
      .where(eq(schema.posts.id, req.params.id))
      .returning({ id: schema.posts.id, isNotice: schema.posts.isNotice, noticePriority: schema.posts.noticePriority });
    if (!updated[0]) { res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." }); return; }
    if (!updated[0].isNotice) { res.status(400).json({ error: true, message: "공지 게시글만 고정할 수 있습니다." }); return; }
    res.json({ notice: updated[0] });
  } catch (err) { next(err); }
});


// ==================== GET /api/admin/stats - 관리자 대시보드 통계 ====================
router.get("/stats", requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res, next) => {
  try {
    const [usersResult, postsResult, commentsResult, pendingReportsResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.users),
      db.select({ count: sql<number>`count(*)` }).from(schema.posts),
      db.select({ count: sql<number>`count(*)` }).from(schema.comments),
      db.select({ count: sql<number>`count(*)` }).from(schema.reports).where(eq(schema.reports.status, "PENDING")),
    ]);

    res.json({
      users: Number(usersResult[0]?.count) || 0,
      posts: Number(postsResult[0]?.count) || 0,
      comments: Number(commentsResult[0]?.count) || 0,
      pendingReports: Number(pendingReportsResult[0]?.count) || 0,
    });
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/admin/users - 회원 목록 ====================
router.get("/users", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = "1", limit = "20", search, status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const usersTable = schema.users;

    let whereCondition: any = undefined;
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = or(
        like(usersTable.email, searchTerm),
        like(usersTable.nickname, searchTerm),
      );
    }
    if (status && status !== "ALL") {
      // 쿼리 파라미터는 string이므로 enum 타입으로 명시적 캐스팅
      const statusValue = status as "ACTIVE" | "SUSPENDED";
      whereCondition = whereCondition
        ? and(whereCondition, eq(usersTable.status, statusValue))
        : eq(usersTable.status, statusValue);
    }

    const users = await db.query.users.findMany({
      where: whereCondition,
      orderBy: [desc(usersTable.createdAt)],
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

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(whereCondition as any);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalResult[0]?.count) || 0,
        totalPages: Math.ceil((Number(totalResult[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== PATCH /api/admin/users/:id/status - 회원 정지/해제 ====================
router.patch("/users/:id/status", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.params.id;
    const status = req.body?.status;
    if (status !== "ACTIVE" && status !== "SUSPENDED") {
      res.status(400).json({ error: true, message: "올바른 회원 상태가 필요합니다." });
      return;
    }
    if (userId === req.userId) {
      res.status(400).json({ error: true, message: "현재 로그인한 관리자 계정은 변경할 수 없습니다." });
      return;
    }
    const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!target) {
      res.status(404).json({ error: true, message: "회원을 찾을 수 없습니다." });
      return;
    }
    await db.update(schema.users).set({ status, updatedAt: new Date() }).where(eq(schema.users.id, userId));
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!, action: status === "SUSPENDED" ? "user_suspend" : "user_unsuspend",
      targetType: "USER", targetId: userId,
      details: JSON.stringify({ email: target.email, nickname: target.nickname }), createdAt: new Date(),
    });
    res.json({ success: true, status });
  } catch (err) { next(err); }
});

// ==================== DELETE /api/admin/users/:id - 회원 삭제 ====================
router.delete("/users/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.params.id;
    if (userId === req.userId) {
      res.status(400).json({ error: true, message: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." });
      return;
    }
    const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!target) {
      res.status(404).json({ error: true, message: "회원을 찾을 수 없습니다." });
      return;
    }
    await db.delete(schema.users).where(eq(schema.users.id, userId));
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!, action: "user_delete", targetType: "USER", targetId: userId,
      details: JSON.stringify({ email: target.email, nickname: target.nickname }), createdAt: new Date(),
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ==================== GET /api/admin/posts - 게시글 목록 (관리자) ====================
router.get("/posts", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = "1", limit = "20", search, sort = "latest" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const postsTable = schema.posts;
    const usersTable = schema.users;

    let orderBy: any;
    if (sort === "popular") {
      orderBy = desc(postsTable.likeCount);
    } else {
      orderBy = desc(postsTable.createdAt);
    }

    let whereCondition: any = undefined;
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = or(
        like(postsTable.title, searchTerm),
        // content(json)에서 텍스트 검색 - LIKE는 컬럼만 허용하므로 sql 템플릿 사용
        sql`${postsTable.title} like ${searchTerm}`,
      );
    }

    const posts = await db.query.posts.findMany({
      where: whereCondition,
      orderBy,
      limit: limitNum,
      offset,
      with: {
        author: {
          columns: {
            id: true,
            nickname: true,
            email: true,
            status: true,
          },
        },
      },
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(postsTable)
      .where(whereCondition as any);

    res.json({
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalResult[0]?.count) || 0,
        totalPages: Math.ceil((Number(totalResult[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== DELETE /api/admin/posts/:id - 게시글 삭제 (관리자) ====================
router.delete("/posts/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const postId = req.params.id;

    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
    });

    if (!post) {
      res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." });
      return;
    }

    await db.delete(schema.posts)
      .where(eq(schema.posts.id, postId));

    // 관리자 로그
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!,
      action: "post_delete",
      targetType: "POST",
      targetId: postId,
      details: JSON.stringify({
        title: post.title,
        authorId: post.authorId,
      }),
      createdAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/admin/comments - 댓글 목록 ( 관리자) ====================
router.get("/comments", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = "1", limit = "20", search } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const commentsTable = schema.comments;
    const postsTable = schema.posts;
    const usersTable = schema.users;

    let whereCondition: any = undefined;
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = or(
        like(commentsTable.content, searchTerm),
      );
    }

    const comments = await db.query.comments.findMany({
      where: whereCondition,
      orderBy: [desc(commentsTable.createdAt)],
      limit: limitNum,
      offset,
      with: {
        author: {
          columns: {
            id: true,
            nickname: true,
            email: true,
            status: true,
          },
        },
        post: {
          columns: {
            id: true,
            title: true,
            authorId: true,
          },
        },
      },
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(commentsTable)
      .where(whereCondition as any);

    res.json({
      comments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalResult[0]?.count) || 0,
        totalPages: Math.ceil((Number(totalResult[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== DELETE /api/admin/comments/:id - 댓글 삭제 (관리자) ====================
router.delete("/comments/:id", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const commentId = req.params.id;

    const comment = await db.query.comments.findFirst({
      where: eq(schema.comments.id, commentId),
    });

    if (!comment) {
      res.status(404).json({ error: true, message: "댓글을 찾을 수 없습니다." });
      return;
    }

    await db.delete(schema.comments)
      .where(eq(schema.comments.id, commentId));

    // 게시글 댓글 수 감소
    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, comment.postId),
    });

    if (post) {
      await db.update(schema.posts)
        .set({
          commentCount: sql`${schema.posts.commentCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.posts.id, comment.postId));
    }

    // 관리자 로그
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!,
      action: "comment_delete",
      targetType: "COMMENT",
      targetId: commentId,
      details: JSON.stringify({
        content: comment.content.slice(0, 100),
        authorId: comment.authorId,
        postId: comment.postId,
      }),
      createdAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/admin/reports - 신고 목록 ====================
router.get("/reports", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = "1", limit = "20", status } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const reportsTable = schema.reports;

    let whereCondition: any = undefined;
    if (status && status !== "ALL") {
      const statusValue = status as "PENDING" | "RESOLVED" | "DISMISSED";
      whereCondition = eq(reportsTable.status, statusValue);
    }

    const reports = await db.query.reports.findMany({
      where: whereCondition,
      orderBy: [desc(reportsTable.createdAt)],
      limit: limitNum,
      offset,
      with: {
        reporter: {
          columns: {
            id: true,
            nickname: true,
            email: true,
          },
        },
      },
    });

    // 대상 정보 별도 조회 (with 관계 미정의로 인한 타입 문제 회피)
    const postIds = reports
      .filter((r) => r.targetType === "POST")
      .map((r) => r.targetId);
    const commentIds = reports
      .filter((r) => r.targetType === "COMMENT")
      .map((r) => r.targetId);

    const postsMap = new Map<string, { id: string; title: string; authorId: string } | null>();
    if (postIds.length > 0) {
      const foundPosts = await db.query.posts.findMany({
        where: inArray(schema.posts.id, postIds),
        columns: { id: true, title: true, authorId: true },
      });
      foundPosts.forEach((p) => postsMap.set(p.id, p));
    }

    const commentsMap = new Map<string, { id: string; content: string; postId: string; authorId: string } | null>();
    if (commentIds.length > 0) {
      const foundComments = await db.query.comments.findMany({
        where: inArray(schema.comments.id, commentIds),
        columns: { id: true, content: true, postId: true, authorId: true },
      });
      foundComments.forEach((c) => commentsMap.set(c.id, c));
    }

    // 대상 정보 매핑
    const enrichedReports: any[] = reports.map((report) => {
      let targetInfo: any = null;
      if (report.targetType === "POST") {
        const post = postsMap.get(report.targetId) || null;
        if (post) {
          targetInfo = {
            type: "POST",
            id: post.id,
            title: post.title,
            authorId: post.authorId,
          };
        }
      } else if (report.targetType === "COMMENT") {
        const comment = commentsMap.get(report.targetId) || null;
        if (comment) {
          targetInfo = {
            type: "COMMENT",
            id: comment.id,
            content: comment.content,
            postId: comment.postId,
            authorId: comment.authorId,
          };
        }
      }
      return {
        ...report,
        targetInfo,
      };
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(reportsTable)
      .where(whereCondition as any);

    res.json({
      reports: enrichedReports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalResult[0]?.count) || 0,
        totalPages: Math.ceil((Number(totalResult[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/admin/reports/:id/resolve - 신고 처리 ====================
router.post("/reports/:id/resolve", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const reportId = req.params.id;
    const { action, details } = req.body; // action: "resolve" | "dismiss"

    if (!action || !["resolve", "dismiss"].includes(action)) {
      res.status(400).json({ error: true, message: "잘못된 처리입니다." });
      return;
    }

    const report = await db.query.reports.findFirst({
      where: eq(schema.reports.id, reportId),
    });

    if (!report) {
      res.status(404).json({ error: true, message: "신고를 찾을 수 없습니다." });
      return;
    }

    // 처리 상태에 따라 대상 삭제 여부 결정
    // resolve: 신고 대상 삭제
    // dismiss: 신고 반려 (대상 유지)
    if (action === "resolve") {
      if (report.targetType === "POST") {
        await db.delete(schema.posts)
          .where(eq(schema.posts.id, report.targetId));
      } else if (report.targetType === "COMMENT") {
        await db.delete(schema.comments)
          .where(eq(schema.comments.id, report.targetId));
      }
    }

    // 신고 상태 업데이트 + 처리자 기록
    await db.update(schema.reports)
      .set({
        status: action === "resolve" ? "RESOLVED" : "DISMISSED",
        resolvedAt: new Date(),
      })
      .where(eq(schema.reports.id, reportId));

    // 관리자 로그
    await db.insert(schema.adminLogs).values({
      adminId: req.userId!,
      action: `report_${action}`,
      targetType: "REPORT",
      targetId: reportId,
      details: JSON.stringify({
        targetType: report.targetType,
        targetId: report.targetId,
        reason: report.reason,
        action,
        details,
      }),
      createdAt: new Date(),
    });

    res.json({ success: true, action });
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/admin/logs - 관리자 활동 로그 ====================
router.get("/logs", requireAuth, requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { page = "1", limit = "20", search, action } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const logsTable = schema.adminLogs;
    const usersTable = schema.users;

    let whereCondition: any = undefined;
    if (search) {
      const searchTerm = `%${search}%`;
      whereCondition = or(
        like(logsTable.action, searchTerm),
        like(logsTable.details, searchTerm),
      );
    }
    if (action && action !== "ALL") {
      const actionValue = action as string;
      whereCondition = whereCondition
        ? and(whereCondition, eq(logsTable.action, actionValue))
        : eq(logsTable.action, actionValue);
    }

    const logs = await db.query.adminLogs.findMany({
      where: whereCondition,
      orderBy: [desc(logsTable.createdAt)],
      limit: limitNum,
      offset,
      with: {
        admin: {
          columns: {
            id: true,
            nickname: true,
            email: true,
          },
        },
      },
    });

    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(logsTable)
      .where(whereCondition as any);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(totalResult[0]?.count) || 0,
        totalPages: Math.ceil((Number(totalResult[0]?.count) || 0) / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
