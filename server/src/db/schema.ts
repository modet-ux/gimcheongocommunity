import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  varchar,
  integer,
  pgEnum,
  json,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// 역할 enum
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);

// 계정 상태 enum
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED"]);

// 신고 상태 enum
export const reportStatusEnum = pgEnum("report_status", ["PENDING", "RESOLVED", "DISMISSED"]);

// 좋아요 대상 타입 enum
export const likeTargetTypeEnum = pgEnum("like_target_type", ["POST", "COMMENT"]);
export const reactionTypeEnum = pgEnum("reaction_type", ["LIKE", "DISLIKE"]);

// 게시판 카테고리
export const postCategoryEnum = pgEnum("post_category", [
  "FREE", "QUESTION", "STUDY", "SCHOOL", "CLUB", "CAREER", "INFO", "SUGGESTION",
]);

// ==================== Users ====================
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  nickname: varchar("nickname", { length: 50 }).notNull(),
  profileImageUrl: text("profile_image_url"),
  statusMessage: varchar("status_message", { length: 160 }),
  role: userRoleEnum("role").default("USER").notNull(),
  status: userStatusEnum("status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Sessions ====================
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== Posts ====================
export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: json("content").notNull(),
  category: postCategoryEnum("category").default("FREE").notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  isNotice: boolean("is_notice").default(false).notNull(),
  noticePriority: integer("notice_priority").default(0).notNull(),
  isSongseol: boolean("is_songseol").default(false).notNull(),
  isSongseolExcluded: boolean("is_songseol_excluded").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  dislikeCount: integer("dislike_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Site Settings ====================
export const siteSettings = pgTable("site_settings", {
  id: integer("id").primaryKey(),
  songseolMinLikes: integer("songseol_min_likes").default(10).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Post Images ====================
export const postImages = pgTable("post_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  r2Key: varchar("r2_key", { length: 500 }).notNull(),
  url: text("url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// ==================== Comments ====================
export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }).notNull(),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  parentId: uuid("parent_id"),
  content: text("content").notNull(),
  likeCount: integer("like_count").default(0).notNull(),
  dislikeCount: integer("dislike_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ==================== Likes ====================
export const likes = pgTable("likes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  targetType: likeTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reaction: reactionTypeEnum("reaction").default("LIKE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== Reports ====================
export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  targetType: likeTargetTypeEnum("target_type").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason").notNull(),
  status: reportStatusEnum("status").default("PENDING").notNull(),
  resolvedByAdminId: uuid("resolved_by_admin_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== Admin Logs ====================
export const adminLogs = pgTable("admin_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  targetType: varchar("target_type", { length: 50 }),
  targetId: uuid("target_id"),
  details: text("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [reports.resolvedByAdminId],
    references: [users.id],
  }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminLogs.adminId],
    references: [users.id],
  }),
}));

// ==================== TypeScript Types ====================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type AdminLog = typeof adminLogs.$inferSelect;
