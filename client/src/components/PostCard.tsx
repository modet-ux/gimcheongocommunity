import { Link } from "react-router-dom";
import type { Post } from "../types";

interface Props {
  post: Post;
  index?: number;
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function excerpt(text: string, maxLen = 80): string {
  if (!text) return "";
  const plain = text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
}

function contentExcerpt(content: unknown): string {
  if (typeof content !== "string") return "";
  try {
    let parsed: any = JSON.parse(content);
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch { /* 일반 문자열 */ }
    }
    const nodes = parsed?.type === "doc" ? parsed.content || [] : Array.isArray(parsed) ? parsed : [];
    return nodes.flatMap((node: any) => (node.content || []).map((child: any) => child.text || "")).join(" ");
  } catch {
    return content;
  }
}

export function PostCard({ post, index = 0 }: Props) {
  const categoryLabels: Record<string, string> = {
    FREE: "자유게시판",
    QUESTION: "질문게시판",
    STUDY: "공부게시판",
    SCHOOL: "학교생활",
    CLUB: "동아리",
    CAREER: "진로",
    INFO: "정보게시판",
    SUGGESTION: "건의게시판",
  };

  return (
    <Link
      to={`/post/${post.id}`}
      className="group block rounded-xl border bg-white border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="flex gap-4 p-4 sm:p-5">
        {/* 내용 */}
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          {post.isNotice && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">공지</span>}
          {!post.isNotice && post.category && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">{categoryLabels[post.category] || post.category}</span>}
        </div>
        <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors truncate-2 break-words">
              {post.title}
            </h3>
            <span className="text-xs text-muted whitespace-nowrap">{timeAgo(post.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            <div className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 15v-5m0 0l3 3m-3-3l-3 3" />
              </svg>
              {post.author?.nickname || "알 수 없음"}
            </div>
          </div>

          <div className="text-sm text-muted truncate-3 break-words mb-2">
            {post.images && post.images.length > 0 ? (
              <span className="text-primary font-medium">이미지 {post.images.length}장</span>
            ) : (
              excerpt(contentExcerpt(post.content))
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted">
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v9h9.28a2 2 0 001.94-1.515l1.2-5A2 2 0 0017.48 11H14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11H5a2 2 0 00-2 2v5a2 2 0 002 2h2" /></svg>
              좋아요 {post.likeCount > 0 ? post.likeCount : 0}
            </button>
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              조회수 {post.viewCount > 0 ? post.viewCount : 0}
            </button>
            <button className="flex items-center gap-1 hover:text-primary transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {post.commentCount > 0 ? `댓글 ${post.commentCount}` : "댓글"}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function PostGrid({ posts }: { posts: Post[] }) {
  return (
    <div className="grid gap-4 sm:gap-5">
      {posts.map((post, i) => (
        <PostCard key={post.id} post={post} index={i} />
      ))}
    </div>
  );
}
