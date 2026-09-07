import { useState, useEffect, useCallback } from "react";
import type { User, Post, Comment, Report, AdminLog } from "../types";

interface FetchStateSuccess<T> { status: "success"; data: T; error?: undefined; }
interface FetchStateError { status: "error"; message: string; data?: undefined; }
type FetchState<T> = FetchStateSuccess<T> | FetchStateError | { status: "loading"; data?: undefined; error?: undefined };

export function useFetch<T>(
  fetchFn: () => Promise<T>,
  deps: React.DependencyList = [],
): FetchState<T> | { status: "loading"; data?: undefined; error?: undefined } {
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });

  const execute = useCallback(async () => {
    try {
      const data = await fetchFn();
      setState({ status: "success", data });
    } catch (err: any) {
      setState({ status: "error", message: err.message || "알 수 없는 오류가 발생했습니다." });
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return state;
}

// 게시글 목록 페치
export function usePosts(params: {
  page?: number;
  limit?: number;
  sort?: "latest" | "popular";
  search?: string;
  category?: string;
} = {}) {
  return useFetch<{ posts: Post[]; pagination: any }>(
    async () => {
      const { page = 1, limit = 20, sort = "latest", search } = params;

      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("limit", String(limit));
      query.set("sort", sort);
      if (search) query.set("search", search);
      if (params.category) query.set("category", params.category);

      const res = await fetch(`/api/posts?${query}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    [params.page, params.limit, params.sort, params.search, params.category],
  );
}

// 게시글 상세 페치
export function usePost(id: string) {
  return useFetch<{ post: Post }>(
    async () => {
      const viewKey = `school-community:viewed:${id}`;
      const alreadyViewed = typeof window !== "undefined" && sessionStorage.getItem(viewKey) === "1";
      if (!alreadyViewed && typeof window !== "undefined") sessionStorage.setItem(viewKey, "1");
      const res = await fetch(`/api/posts/${id}${alreadyViewed ? "?countView=0" : ""}`);
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 404) throw new Error("게시글을 찾을 수 없습니다.");
        throw new Error(err.message);
      }
      return res.json();
    },
    [id],
  );
}

// 댓글 목록 페치
export function useComments(postId: string) {
  return useFetch<{ comments: Comment[] }>(
    async () => {
      const res = await fetch(`/api/posts/${postId}/comments`);
      if (!res.ok) {
        throw new Error("댓글을 불러올 수 없습니다.");
      }
      return res.json();
    },
    [postId],
  );
}

// 회원 검색 (관리자)
export function useUserSearch(params: { q?: string; status?: string; page?: number; limit?: number; refreshKey?: number } = {}) {
  return useFetch<{ users: User[]; pagination: any }>(
    async () => {
      const query = new URLSearchParams();
      if (params.q) query.set("search", params.q);
      if (params.status) query.set("status", params.status);
      query.set("page", String(params.page || 1));
      query.set("limit", String(params.limit || 20));

      const res = await fetch(`/api/admin/users?${query}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    [params.q, params.status, params.page, params.limit, params.refreshKey],
  );
}

// 관리자 대시보드 통계
export function useAdminStats(refreshKey = 0) {
  return useFetch<{ users: number; posts: number; comments: number; pendingReports: number }>(
    async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    [refreshKey],
  );
}

export function useAdminPosts(refreshKey = 0) {
  return useFetch<{ posts: Post[]; pagination: any }>(async () => {
    const res = await fetch("/api/admin/posts", { credentials: "include" });
    if (!res.ok) throw new Error((await res.json()).message);
    return res.json();
  }, [refreshKey]);
}

export function useAdminComments(refreshKey = 0) {
  return useFetch<{ comments: Comment[]; pagination: any }>(async () => {
    const res = await fetch("/api/admin/comments", { credentials: "include" });
    if (!res.ok) throw new Error((await res.json()).message);
    return res.json();
  }, [refreshKey]);
}

// 신고 목록 (관리자)
export function useReports(params: { status?: string; page?: number; limit?: number; refreshKey?: number } = {}) {
  return useFetch<{ reports: Report[]; pagination: any }>(
    async () => {
      const query = new URLSearchParams();
      if (params.status) query.set("status", params.status);
      query.set("page", String(params.page || 1));
      query.set("limit", String(params.limit || 20));

      const res = await fetch(`/api/admin/reports?${query}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    [params.status, params.page, params.limit, params.refreshKey],
  );
}

// 관리자 로그 (관리자)
export { useAuth } from "../context/AuthContext";

export function useAdminLogs(params: { page?: number; limit?: number; search?: string } = {}) {
  return useFetch<{ logs: AdminLog[]; pagination: any }>(
    async () => {
      const query = new URLSearchParams();
      query.set("page", String(params.page || 1));
      query.set("limit", String(params.limit || 20));
      if (params.search) query.set("search", params.search);

      const res = await fetch(`/api/admin/logs?${query}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    [params.page, params.limit, params.search],
  );
}
