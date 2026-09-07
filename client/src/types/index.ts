// 공통 타입 정의

export interface User {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl?: string | null;
  statusMessage?: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  title: string;
  content: PostBlock[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  replyCount?: number;
  category?: "FREE" | "QUESTION" | "STUDY" | "SCHOOL" | "CLUB" | "CAREER" | "INFO" | "SUGGESTION";
  isAnonymous?: boolean;
  isNotice?: boolean;
  noticePriority?: number;
  createdAt: string;
  updatedAt: string;
  author?: User;
  images?: PostImage[];
  thumbnailUrl?: string | null;
  userLike?: boolean;
  comments?: CommentWithAuthor[];
}

export interface PostBlock {
  type: "text" | "image" | "image_single";
  text?: string;
  imageId?: string;
  alignment?: "left" | "center" | "right";
  caption?: string;
}

export interface PostImage {
  id: string;
  postId: string;
  r2Key: string;
  url: string;
  width: number;
  height: number;
  uploadedAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId?: string | null;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentWithAuthor extends Comment {
  author: User;
  isLiked?: boolean;
}

export interface Report {
  id: string;
  reporterId: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  resolvedByAdminId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  reporter?: User;
  target?: any;
  targetTypeLabel?: string;
}

export interface AdminLog {
  id: string;
  adminId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  details?: string | null;
  createdAt: string;
  admin?: User;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
