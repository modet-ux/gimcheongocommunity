import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

type PublicPost = {
  id: string;
  title: string;
  category: string;
  isNotice: boolean;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
};

type PublicProfile = {
  id: string;
  nickname: string;
  profileImageUrl: string | null;
  statusMessage: string | null;
};

const categoryLabels: Record<string, string> = {
  FREE: "자유", QUESTION: "질문", STUDY: "공부", SCHOOL: "학교생활",
  CLUB: "동아리", CAREER: "진로", INFO: "정보", SUGGESTION: "건의",
};

export function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/users/${id}/profile?page=1&limit=20&t=${Date.now()}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "프로필을 불러오지 못했습니다.");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setProfile(data.profile);
          const hiddenIds = JSON.parse(localStorage.getItem(`hidden-post-history:${data.profile.id}`) || "[]");
          setPosts((data.posts || []).filter((post: PublicPost) => !hiddenIds.includes(post.id)));
          setPage(1);
          setHasMore(data.pagination?.hasMore ?? (data.posts || []).length === 20);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || !id) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      setLoadingMore(true);
      const nextPage = page + 1;
      try {
        const res = await fetch(`/api/users/${id}/profile?page=${nextPage}&limit=20`, { credentials: "include" });
        if (!res.ok) throw new Error("게시글을 더 불러오지 못했습니다.");
        const data = await res.json();
        const hiddenIds = profile ? JSON.parse(localStorage.getItem(`hidden-post-history:${profile.id}`) || "[]") : [];
        setPosts((current) => [...current, ...(data.posts || []).filter((post: PublicPost) => !hiddenIds.includes(post.id))]);
        setPage(nextPage);
        setHasMore(data.pagination?.hasMore ?? (data.posts || []).length === 20);
      } catch (err: any) { setError(err.message); }
      finally { setLoadingMore(false); }
    }, { rootMargin: "240px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [id, page, hasMore, loadingMore, profile]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">프로필을 불러오는 중...</div>;
  if (error || !profile) return <div className="max-w-3xl mx-auto px-4 py-16 text-center"><p className="text-gray-500 mb-4">{error || "프로필을 찾을 수 없습니다."}</p><Link to="/" className="text-primary-600">홈으로 돌아가기</Link></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            {profile.profileImageUrl ? <img src={profile.profileImageUrl} alt="" className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-100" /> : <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600">{profile.nickname.slice(0, 1)}</div>}
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{profile.nickname}</h1>
              {profile.statusMessage && <p className="mt-1 text-gray-600 whitespace-pre-wrap break-words">{profile.statusMessage}</p>}
              <p className="mt-2 text-xs text-gray-400">공개 프로필</p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-bold text-gray-900">작성한 게시글</h2><span className="text-sm text-gray-400">{posts.length}개</span></div>
          {posts.length === 0 ? <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-400">공개된 게시글이 없습니다.</div> : <div className="grid gap-3">{posts.map((post) => <Link key={post.id} to={`/post/${post.id}`} className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-sm transition-all"><div className="flex items-center gap-2 mb-1">{post.isNotice && <span className="text-xs font-bold text-red-600">공지</span>}{!post.isNotice && <span className="text-xs font-medium text-primary-600">{categoryLabels[post.category] || post.category}</span>}</div><h3 className="font-medium text-gray-900">{post.title}</h3><div className="mt-2 text-xs text-gray-400">좋아요 {post.likeCount} · 조회 {post.viewCount} · 댓글 {post.commentCount}</div></Link>)}<div ref={sentinelRef} className="h-10 text-center text-xs text-gray-400 py-2">{loadingMore ? "더 불러오는 중..." : ""}</div></div>}
        </section>
      </div>
    </div>
  );
}
