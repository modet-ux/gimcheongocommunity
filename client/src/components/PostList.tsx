import { Link, useNavigate } from "react-router-dom";
import { Post } from "../types";

interface Props {
  posts: Post[];
  loading?: boolean;
  emptyMessage?: string;
}

export function PostList({ posts, loading, emptyMessage = "게시글이 없습니다." }: Props) {
  const navigate = useNavigate();
  if (loading) {
    return (
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded-xl h-32"></div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m0 1H5a2 2 0 01-2-2V6a2 2 0 00-2-2h10a2 2 0 00-2 2v1m0 1h14V4l-4 4m0 0l-4-4m4 4V10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-700 mb-2">{emptyMessage}</h3>
        <p className="text-sm text-gray-400">첫 게시글을 작성해보세요.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {posts.map((post) => (
        <Link
          key={post.id}
          to={`/post/${post.id}`}
          className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
        >
          <div className="flex items-start gap-3">
            {/* 프로필 이미지 */}
            <div className="shrink-0">
              {post.isAnonymous ? (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">익</div>
              ) : post.author?.profileImageUrl ? (
                <img
                  src={post.author.profileImageUrl}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-600">
                  {post.isAnonymous ? "익" : post.author?.nickname?.slice(0, 1)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* 제목 */}
              <div className="flex items-center gap-2 mb-1">
                {post.isNotice && <span className="shrink-0 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-medium">공지</span>}
                {!post.isNotice && post.category && <span className="shrink-0 text-[11px] text-indigo-600 font-medium">{({ FREE: "자유", QUESTION: "질문", STUDY: "공부", SCHOOL: "학교생활", CLUB: "동아리", CAREER: "진로", INFO: "정보", SUGGESTION: "건의" } as Record<string, string>)[post.category]}</span>}
              </div>
              <h3 className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1">
                {post.title}
              </h3>

              {/* 작성자 + 시간 */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <button
                  type="button"
                  className="font-medium text-gray-600 hover:text-primary-600 hover:underline"
                  onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (post.author?.id) navigate(`/users/${post.author.id}`); }}
                >
                  {post.isAnonymous ? "익명" : post.author?.nickname || "알 수 없음"}
                </button>
                <span>·</span>
                <time>{formatDate(post.createdAt)}</time>
              </div>

              {/* 통계 */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v9h9.28a2 2 0 001.94-1.515l1.2-5A2 2 0 0017.48 11H14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11H5a2 2 0 00-2 2v5a2 2 0 002 2h2" /></svg>
                  좋아요 {post.likeCount}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  조회수 {post.viewCount}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 17.212 3 14.815 3 13 3 9.582 5.734 7 9 7H15c3.266 0 5.146-2.438 5.146-2.438" />
                  </svg>
                  댓글 {post.commentCount}
                </span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function formatDate(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return `${d.getHours()}시 ${String(d.getMinutes()).padStart(2, "0")}분`;
  }
  if (days === 1) {
    return "어제";
  }
  if (days < 7) {
    return `${days}일 전`;
  }
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}
