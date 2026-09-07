export type User = {
  id: string;
  email: string;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  replyCount?: number;
  category?: "FREE" | "QUESTION" | "STUDY" | "SCHOOL" | "CLUB" | "CAREER" | "INFO" | "SUGGESTION";
  isNotice?: boolean;
  isAnonymous?: boolean;
  noticePriority?: number;
  isSongseol?: boolean;
  isSongseolExcluded?: boolean;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  };
  images?: PostImage[];
  userLiked?: boolean;
};

export type PostImage = {
  id: string;
  postId: string;
  url: string;
  width: number;
  height: number;
  uploadedAt: string;
};

export type Comment = {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  likeCount: number;
  createdAt: string;
  updatedAt: string;
  author?: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
  };
  replies?: Comment[];
  userLiked?: boolean;
};

export type Report = {
  id: string;
  reporterId: string;
  targetType: "POST" | "COMMENT";
  targetId: string;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  createdAt: string;
  resolvedAt?: string;
  reporter?: {
    id: string;
    nickname: string;
    email: string;
  };
};

export type AdminLog = {
  id: string;
  adminId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
  createdAt: string;
  admin?: {
    id: string;
    nickname: string;
    email: string;
  };
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
