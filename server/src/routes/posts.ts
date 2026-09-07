import { Router } from "express";
import { db, schema } from "../db/index.js";
import { eq, and, desc, asc, sql, count, like, or, ilike, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin, AuthenticatedRequest } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

async function isAdminRequest(req: any): Promise<boolean> {
  if (req.isAdmin) return true;
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return false;
  const session = await db.query.sessions.findFirst({ where: and(eq(schema.sessions.id, sessionId), sql`${schema.sessions.expiresAt} > now()`) });
  if (!session) return false;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.userId), columns: { role: true, status: true } });
  return user?.role === "ADMIN" && user.status === "ACTIVE";
}

// ==================== GET /api/posts - 게시글 목록 ====================
router.get("/", requireAuth, async (req: any, res, next) => {
  try {
    const requesterIsAdmin = await isAdminRequest(req);
    const { page = "1", limit = "20", sort = "latest", search, userId, category } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const postsTable = schema.posts;
    const usersTable = schema.users;
    const postImagesTable = schema.postImages;
    const likesTable = schema.likes;

    let orderBy: any;
    const pinnedNoticeOrder = sql`CASE WHEN ${postsTable.isNotice} = true AND ${postsTable.noticePriority} > 0 THEN 0 ELSE 1 END`;
    const noticePriorityOrder = sql`CASE WHEN ${postsTable.noticePriority} > 0 THEN ${postsTable.noticePriority} ELSE 2147483647 END`;
    if (sort === "popular") {
      orderBy = [pinnedNoticeOrder, noticePriorityOrder, desc(postsTable.likeCount), desc(postsTable.createdAt)];
    } else {
      orderBy = [pinnedNoticeOrder, noticePriorityOrder, desc(postsTable.createdAt)];
    }

    // 검색 조건
    let whereCondition: any = undefined;
    if (search) {
      const searchTerm = `%${search}%`;
      const matchedAuthors = await db.query.users.findMany({
        where: ilike(usersTable.nickname, searchTerm),
        columns: { id: true },
      });
      const authorIds = matchedAuthors.map((author) => author.id);
      whereCondition = or(
        ilike(postsTable.title, searchTerm),
        sql`CAST(${postsTable.content} AS TEXT) ILIKE ${searchTerm}`,
        ...(authorIds.length > 0 ? [inArray(postsTable.authorId, authorIds)] : []),
      );
    }
    const validCategories = ["FREE", "QUESTION", "STUDY", "SCHOOL", "CLUB", "CAREER", "INFO", "SUGGESTION"] as const;
    if (category === "SONGSEOL") {
      const setting = await db.query.siteSettings.findFirst({ where: eq(schema.siteSettings.id, 1) });
      const minLikes = setting?.songseolMinLikes ?? 10;
      whereCondition = and(sql`(${postsTable.isSongseol} = true OR (${postsTable.isSongseolExcluded} = false AND ${postsTable.likeCount} >= ${minLikes}))`, eq(postsTable.isNotice, false));
      orderBy = [desc(postsTable.createdAt)];
    } else if (category === "NOTICE") {
      whereCondition = whereCondition ? and(whereCondition, eq(postsTable.isNotice, true)) : eq(postsTable.isNotice, true);
    } else if (category && validCategories.includes(category as typeof validCategories[number])) {
      const categoryCondition = and(
        eq(postsTable.category, category as typeof validCategories[number]),
        eq(postsTable.isNotice, false),
      );
      whereCondition = whereCondition ? and(whereCondition, categoryCondition) : categoryCondition;
    }
    if (userId) {
      const authorCondition = eq(postsTable.authorId, String(userId));
      whereCondition = whereCondition ? and(whereCondition, authorCondition) : authorCondition;
    }
    // 공지 카테고리가 아닌 전체 목록에는 고정된 공지만 노출한다.
    if (!category || category === "ALL") {
      const visibleNoticeCondition = or(eq(postsTable.isNotice, false), sql`${postsTable.noticePriority} > 0`);
      whereCondition = whereCondition ? and(whereCondition, visibleNoticeCondition) : visibleNoticeCondition;
    }
    // 게시글 조회
    const posts = await db.query.posts.findMany({
      where: whereCondition,
      orderBy,
      limit: limitNum,
      offset,
      columns: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        category: true,
        isAnonymous: true,
        isNotice: true,
        noticePriority: true,
        isSongseol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 게시글별 작성자, 이미지, 좋아요 정보 가져오기 (N+1 방지: 배치 처리)
    const postIds = posts.map((p: any) => p.id);

    if (postIds.length > 0) {
      const commentCounts = await db
        .select({
          postId: schema.comments.postId,
          commentCount: sql<number>`count(*) filter (where ${schema.comments.parentId} is null)`,
          replyCount: sql<number>`count(*) filter (where ${schema.comments.parentId} is not null)`,
        })
        .from(schema.comments)
        .where(inArray(schema.comments.postId, postIds))
        .groupBy(schema.comments.postId);
      const commentCountMap = new Map(commentCounts.map((row) => [row.postId, {
        commentCount: Number(row.commentCount),
        replyCount: Number(row.replyCount),
      }]));
      // 작성자들
      const authorMap = new Map<string, { id: string; nickname: string; profileImageUrl: string | null } | null>();
      const authors = await db.query.users.findMany({
        where: inArray(usersTable.id, posts.map((p: any) => p.authorId) as string[]),
        columns: {
          id: true,
          nickname: true,
          profileImageUrl: true,
        },
      });
      authors.forEach((a) => {
        authorMap.set(a.id, a);
      });

      // 이미지들
      const imageMap = new Map<string, { id: string; url: string; width: number; height: number }[]>();
      const images = await db.query.postImages.findMany({
        where: inArray(postImagesTable.postId, postIds),
        columns: {
          id: true,
          postId: true,
          url: true,
          width: true,
          height: true,
        },
      });
      images.forEach((img) => {
        const list = imageMap.get(img.postId) || [];
        list.push(img);
        imageMap.set(img.postId, list);
      });

      // 좋아요 여부 (로그인한 사용자인 경우)
      let currentUserLikedPosts: Set<string> | null = null;
      if (req.userId) {
        const likedPosts = await db.query.likes.findMany({
          where: and(
            eq(likesTable.userId, req.userId),
            eq(likesTable.targetType, "POST"),
            inArray(likesTable.targetId, postIds),
          ),
          columns: { targetId: true },
        });
        currentUserLikedPosts = new Set(likedPosts.map((l) => l.targetId));
      }

      // 게시글 카운트 (조회수, 좋아요, 댓글은 게시글에 이미 있음)

      const enrichedPosts = posts.map((post) => {
        const author = authorMap.get(post.authorId) || null;
        const imagesList = imageMap.get(post.id) || [];
        return {
          ...post,
          authorId: post.isAnonymous && !requesterIsAdmin ? null : post.authorId,
          author: post.isAnonymous && !requesterIsAdmin ? null : author ? {
            id: author.id,
            nickname: author.nickname,
            profileImageUrl: author.profileImageUrl,
          } : null,
          images: imagesList,
          commentCount: commentCountMap.get(post.id)?.commentCount ?? 0,
          replyCount: commentCountMap.get(post.id)?.replyCount ?? 0,
          userLiked: currentUserLikedPosts?.has(post.id) || false,
        };
      });

      res.json({
        posts: enrichedPosts,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: posts.length, // 실제 프로덕션에서는 count 쿼리 추가
        },
      });
    } else {
      res.json({ posts: [], pagination: { page: pageNum, limit: limitNum, total: 0 } });
    }
  } catch (err) {
    next(err);
  }
});

// ==================== GET /api/posts/:id - 게시글 상세 ====================
router.get("/:id", requireAuth, async (req: any, res, next) => {
  try {
    const requesterIsAdmin = await isAdminRequest(req);
    const postId = req.params.id;
    const countView = req.query.countView !== "0";

    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
      columns: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        viewCount: true,
        likeCount: true,
        dislikeCount: true,
        commentCount: true,
        category: true,
        isAnonymous: true,
        isNotice: true,
        noticePriority: true,
        isSongseol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!post) {
      res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." });
      return;
    }

    // 조회수는 DB의 현재 값에 원자적으로 1을 더해 동시 요청에서도 유실되지 않게 한다.
    if (countView) {
      const [viewUpdated] = await db.update(schema.posts)
        .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
        .where(eq(schema.posts.id, postId))
        .returning({ viewCount: schema.posts.viewCount });
      post.viewCount = viewUpdated?.viewCount ?? post.viewCount;
    }

    // 작성자 정보
    const author = await db.query.users.findFirst({
      where: eq(schema.users.id, post.authorId),
      columns: {
        id: true,
        nickname: true,
        profileImageUrl: true,
        role: true,
      },
    });

    // 이미지 목록
    const images = await db.query.postImages.findMany({
      where: eq(schema.postImages.postId, postId),
      orderBy: [asc(schema.postImages.uploadedAt)],
      columns: {
        id: true,
        postId: true,
        url: true,
        width: true,
        height: true,
        uploadedAt: true,
      },
    });

    // 현재 사용자의 반응
    let userReaction: "LIKE" | "DISLIKE" | null = null;
    if (req.userId) {
      const like = await db.query.likes.findFirst({
        where: and(
          eq(schema.likes.userId, req.userId),
          eq(schema.likes.targetType, "POST"),
          eq(schema.likes.targetId, postId),
        ),
      });
      userReaction = like?.reaction ?? null;
    }

    res.json({
      post: {
        ...post,
        authorId: post.isAnonymous && !requesterIsAdmin ? null : post.authorId,
        author: post.isAnonymous && !requesterIsAdmin ? null : author,
        images,
        userLiked: userReaction === "LIKE",
        userReaction,      },
    });
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/posts - 게시글 작성 ====================
router.post("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;

    const createPostSchema = z.object({
      title: z.string().min(1).max(200),
      content: z.string().min(1).max(50000),
      category: z.enum(["FREE", "QUESTION", "STUDY", "SCHOOL", "CLUB", "CAREER", "INFO", "SUGGESTION"]).default("FREE"),
      isAnonymous: z.boolean().default(false),
      isNotice: z.boolean().optional(),
      imageUrls: z.array(z.string().url()).optional(),
      imagePositions: z.record(z.string()).optional(), // { imageId: "position:top" }
    });

    const data = createPostSchema.parse(req.body);

    const newPost = await db.insert(schema.posts)
      .values({
        id: uuidv4(),
        authorId: userId,
        title: data.title,
        content: data.content,
        category: data.category,
        isAnonymous: data.isAnonymous,
        isNotice: req.isAdmin ? data.isNotice === true : false,
        noticePriority: 0,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: schema.posts.id, createdAt: schema.posts.createdAt });

    // 이미지 저장 (간단한 URL 저장 - 실제 업로드 라우터는 별도)
    if (data.imageUrls && data.imageUrls.length > 0) {
      const postId = newPost[0].id;
      const imagesToInsert = data.imageUrls.map((url) => ({
        id: uuidv4(),
        postId,
        r2Key: `manual-${uuidv4()}`,
        url,
        width: 0,
        height: 0,
        uploadedAt: new Date(),
      }));
      await db.insert(schema.postImages).values(imagesToInsert);
    }

    const createdPost = await db.query.posts.findFirst({
      where: eq(schema.posts.id, newPost[0].id),
    });

    res.status(201).json({
      post: createdPost,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== PATCH /api/posts/:id - 게시글 수정 ====================
router.patch("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;

    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
    });

    if (!post) {
      res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." });
      return;
    }

    // 권한 체크: 작성자 또는 관리자
    if (post.authorId !== userId && !req.isAdmin) {
      res.status(403).json({ error: true, message: "수정할 권한이 없습니다." });
      return;
    }

    const updatePostSchema = z.object({
      title: z.string().min(1).max(200).optional(),
      content: z.string().min(1).max(50000).optional(),
      category: z.enum(["FREE", "QUESTION", "STUDY", "SCHOOL", "CLUB", "CAREER", "INFO", "SUGGESTION"]).optional(),
    });

    const updateData = updatePostSchema.parse(req.body);

    const updates: Record<string, any> = {};
    if (updateData.title !== undefined) updates.title = updateData.title;
    if (updateData.content !== undefined) updates.content = updateData.content;
    if (updateData.category !== undefined) updates.category = updateData.category;
    updates.updatedAt = new Date();

    await db.update(schema.posts)
      .set(updates)
      .where(eq(schema.posts.id, postId));

    const updatedPost = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
      columns: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        category: true,
        isAnonymous: true,
        isNotice: true,
        noticePriority: true,
        isSongseol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ post: updatedPost });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: true, message: "입력값 검증 오류", details: err.errors });
      return;
    }
    next(err);
  }
});

// ==================== DELETE /api/posts/:id - 게시글 삭제 ====================
router.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;

    const post = await db.query.posts.findFirst({
      where: eq(schema.posts.id, postId),
    });

    if (!post) {
      res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." });
      return;
    }

    // 권한 체크: 작성자 또는 관리자
    if (post.authorId !== userId && !req.isAdmin) {
      res.status(403).json({ error: true, message: "삭제할 권한이 없습니다." });
      return;
    }

    // 게시글 삭제 (CASCADE로 댓글, 이미지, 좋아요도 삭제됨)
    await db.delete(schema.posts)
      .where(eq(schema.posts.id, postId));

    // 관리자 로그
    if (req.isAdmin) {
      const author = await db.query.users.findFirst({
        where: eq(schema.users.id, post.authorId),
      });
      await db.insert(schema.adminLogs).values({
        adminId: userId,
        action: "post_delete",
        targetType: "POST",
        targetId: postId,
        details: JSON.stringify({
          title: post.title,
          deletedByAuthor: post.authorId === userId,
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

// ==================== POST /api/posts/:id/like - 좋아요/싫어요 ====================
router.post("/:id/like", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;
    const reaction = z.enum(["LIKE", "DISLIKE"]).catch("LIKE").parse(req.body?.reaction);
    const post = await db.query.posts.findFirst({ where: eq(schema.posts.id, postId) });

    if (!post) {
      res.status(404).json({ error: true, message: "게시글을 찾을 수 없습니다." });
      return;
    }

    const existing = await db.query.likes.findFirst({
      where: and(eq(schema.likes.userId, userId), eq(schema.likes.targetType, "POST"), eq(schema.likes.targetId, postId)),
    });

    if (existing?.reaction === reaction) {
      await db.delete(schema.likes).where(eq(schema.likes.id, existing.id));
      await db.update(schema.posts).set({
        [reaction === "LIKE" ? "likeCount" : "dislikeCount"]: sql`${reaction === "LIKE" ? schema.posts.likeCount : schema.posts.dislikeCount} - 1`,
        updatedAt: new Date(),
      }).where(eq(schema.posts.id, postId));
      res.json({ reaction: null, likeCount: Math.max(0, post.likeCount - (reaction === "LIKE" ? 1 : 0)), dislikeCount: Math.max(0, post.dislikeCount - (reaction === "DISLIKE" ? 1 : 0)) });
      return;
    }

    if (existing) {
      await db.update(schema.likes).set({ reaction }).where(eq(schema.likes.id, existing.id));
      await db.update(schema.posts).set({
        likeCount: reaction === "LIKE" ? sql`${schema.posts.likeCount} + 1` : sql`${schema.posts.likeCount} - 1`,
        dislikeCount: reaction === "DISLIKE" ? sql`${schema.posts.dislikeCount} + 1` : sql`${schema.posts.dislikeCount} - 1`,
        updatedAt: new Date(),
      }).where(eq(schema.posts.id, postId));
      res.json({
        reaction,
        likeCount: post.likeCount + (reaction === "LIKE" ? 1 : -1),
        dislikeCount: post.dislikeCount + (reaction === "DISLIKE" ? 1 : -1),
      });
      return;
    }

    await db.insert(schema.likes).values({ userId, targetType: "POST", targetId: postId, reaction, createdAt: new Date() });
    await db.update(schema.posts).set({
      [reaction === "LIKE" ? "likeCount" : "dislikeCount"]: sql`${reaction === "LIKE" ? schema.posts.likeCount : schema.posts.dislikeCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(schema.posts.id, postId));

    res.json({
      reaction,
      likeCount: post.likeCount + (reaction === "LIKE" ? 1 : 0),
      dislikeCount: post.dislikeCount + (reaction === "DISLIKE" ? 1 : 0),
    });
  } catch (err) {
    next(err);
  }
});

// ==================== POST /api/posts/:id/report - 게시글 신고 ====================
router.post("/:id/report", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const postId = req.params.id;

    const { reason } = z.object({ reason: z.string().min(10).max(500) }).parse(req.body);

    // 이미 신고한 게시글인지 확인
    const existingReport = await db.query.reports.findFirst({
      where: and(
        eq(schema.reports.reporterId, userId),
        eq(schema.reports.targetType, "POST"),
        eq(schema.reports.targetId, postId),
      ),
    });

    if (existingReport) {
      res.status(400).json({ error: true, message: "이미 신고한 게시글입니다." });
      return;
    }

    const [report] = await db.insert(schema.reports).values({
      id: uuidv4(),
      reporterId: userId,
      targetType: "POST",
      targetId: postId,
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

// ==================== GET /api/posts/user/:userId - 특정 사용자의 게시글 ====================
router.get("/user/:userId", requireAuth, async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const { page = "1", limit = "20" } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(50, Math.max(10, parseInt(limit as string)));
    const offset = (pageNum - 1) * limitNum;

    const posts = await db.query.posts.findMany({
      where: eq(schema.posts.authorId, targetUserId),
      orderBy: [desc(schema.posts.createdAt)],
      limit: limitNum,
      offset,
      columns: {
        id: true,
        authorId: true,
        title: true,
        content: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        category: true,
        isAnonymous: true,
        isNotice: true,
        noticePriority: true,
        isSongseol: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      posts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: posts.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
