import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import type { Post } from "../types";
import { PostGrid } from "../components/PostCard";
import { Button } from "../components/Button";

type PaginatedResponse<T> = {
  posts?: T[];
  items?: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export function PostsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [sort, setSort] = useState(searchParams.get("sort") || "latest");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [scrollLoading, setScrollLoading] = useState(false);

  const fetchPosts = useCallback(async (pageNum: number, reset = false) => {
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: "20",
        sort,
        ...(searchQuery ? { search: searchQuery } : {}),
      });

      const res = await api.get(`/posts?${params}`);
      const data: PaginatedResponse<Post> = res.data;
      const nextPosts = data.posts || data.items || [];

      setPosts((previous) => reset || pageNum === 1 ? nextPosts : [...previous, ...nextPosts]);
      setPagination(data.pagination);
    } catch (err) {
      console.error("게시글 목록 로딩 실패:", err);
    } finally {
      setLoading(false);
      setScrollLoading(false);
    }
  }, [sort, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchPosts(page, true);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchPosts(1, true);
  }, [sort, searchQuery]);

  // 무한 스크롤 감지
  useEffect(() => {
    if (scrollLoading || pagination.totalPages <= page) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setScrollLoading(true);
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPosts(nextPage);
        }
      },
      { rootMargin: "200px" }
    );

    const sentinel = document.getElementById("scroll-sentinel");
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => observer.disconnect();
  }, [scrollLoading, page, pagination.totalPages, fetchPosts]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (e.currentTarget as HTMLFormElement).search.value.trim();
    setSearchQuery(q);
    setPage(1);
    navigate(`?sort=${sort}&search=${encodeURIComponent(q)}&page=1`, { replace: true });
    fetchPosts(1, true);
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    navigate(`?sort=${value}&search=${encodeURIComponent(searchQuery)}&page=1`, { replace: true });
    fetchPosts(1, true);
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      {/* Hero */}
      <div className="bg-primary text-white py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">김천고 커뮤니티</h1>
            <p className="text-white/80 mt-1 text-sm sm:text-base">
              우리 학교 이야기, 여기에서 나눠보세요
            </p>
          </div>

          {/* 검색 + 정렬 */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 w-full max-w-xl">
            <div className="relative flex-1">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                name="search"
                type="search"
                placeholder="제목, 내용, 닉네임 검색"
                defaultValue={searchQuery}
                className="input pl-10"
              />
            </div>
            <Button type="submit" variant="primary" className="whitespace-nowrap">
              검색
            </Button>
          </form>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex rounded-lg border border-border bg-white overflow-hidden">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${sort === "latest" ? "bg-primary text-white" : "text-muted hover:bg-gray-50"}`}
                onClick={() => handleSortChange("latest")}
              >
                최신순
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors ${sort === "popular" ? "bg-primary text-white" : "text-muted hover:bg-gray-50"}`}
                onClick={() => handleSortChange("popular")}
              >
                인기순
              </button>
            </div>

            <Button variant="secondary" size="sm" onClick={() => navigate("/post/new")}>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                새 글 작성
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* 게시글 목록 */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6">
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-muted">게시글을 불러오는 중...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-12 h-12 mx-auto text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <h3 className="text-lg font-semibold text-foreground">아직 게시글이 없어요</h3>
            <p className="text-sm text-muted mt-1">첫 번째 글을 작성해보세요!</p>
            <Button variant="primary" className="mt-4" onClick={() => navigate("/post/new")}>
              글쓰기
            </Button>
          </div>
        ) : (
          <>
            <PostGrid posts={posts} />

            <div id="scroll-sentinel" className="h-16 flex items-center justify-center text-sm text-muted">
              {scrollLoading ? "게시글을 더 불러오는 중..." : pagination.page >= pagination.totalPages ? "모든 게시글을 확인했습니다." : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
