import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCsrfToken, useAuth } from "../../context/AuthContext";
import { useUserSearch, useReports, useAdminStats, useAdminPosts, useAdminComments } from "../../hooks/useApi";
import { useToast } from "../../components/Toast";


export function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();

  // 관리자 권한 확인
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (user?.role !== "ADMIN") {
      show("warning", "관리자 권한이 없습니다.");
      navigate("/");
    }
  }, [isAuthenticated, user, navigate, show]);

  if (!isAuthenticated || user?.role !== "ADMIN") {
    return null;
  }

  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "posts" | "notices" | "songseol" | "comments" | "reports">("dashboard");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [songseolMinLikes, setSongseolMinLikes] = useState(10);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetch("/api/posts?category=NOTICE&limit=50", { credentials: "include" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "공지 목록을 불러오지 못했습니다.");
        return data;
      })
      .then((data) => setNotices(data.posts || []))
      .catch((err) => show("error", err.message));
  }, [user, refreshKey, show]);

  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    fetch("/api/admin/songseol-settings", { credentials: "include" }).then((res) => res.json()).then((data) => setSongseolMinLikes(Number(data.songseolMinLikes ?? 10))).catch(() => undefined);
  }, [user, refreshKey]);

  // 모든 데이터 훅은 컴포넌트 최상위에서 호출해 탭 전환 시 훅 순서를 유지한다.
  const usersResult = useUserSearch({ q: search || undefined, refreshKey });
  const reportsResult = useReports({ refreshKey });

  const statsResult = useAdminStats(refreshKey);
  const postsResult = useAdminPosts(refreshKey);
  const commentsResult = useAdminComments(refreshKey);

  const updateUserStatus = async (userId: string, status: "ACTIVE" | "SUSPENDED") => {
    const label = status === "SUSPENDED" ? "정지" : "정지 해제";
    if (!window.confirm(`이 회원을 ${label}하시겠습니까?`)) return;
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      show("error", body.message || `${label}에 실패했습니다.`);
      return;
    }
    show("success", `${label}했습니다.`);
    setRefreshKey((value) => value + 1);
  };

  const deleteUser = async (userId: string) => {
    if (!window.confirm("이 회원을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": csrfToken },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      show("error", body.message || "회원 삭제에 실패했습니다.");
      return;
    }
    show("success", "회원을 삭제했습니다.");
  };

  const resolveReport = async (reportId: string, action: "resolve" | "dismiss") => {
    const label = action === "resolve" ? "신고 대상 삭제 처리" : "신고 반려";
    if (!window.confirm(`${label}하시겠습니까?`)) return;
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      show("error", body.message || "신고 처리에 실패했습니다.");
      return;
    }
    show("success", `${label}했습니다.`);
    setRefreshKey((value) => value + 1);
  };

  const deleteAdminTarget = async (path: string, id: string, label: string) => {
    if (!window.confirm(`이 ${label}을(를) 삭제하시겠습니까?`)) return;
    const csrfToken = await fetchCsrfToken();
    const res = await fetch(`${path}${id}`, { method: "DELETE", credentials: "include", headers: { "X-CSRF-Token": csrfToken } });
    if (!res.ok) { const body = await res.json().catch(() => ({})); show("error", body.message || `${label} 삭제에 실패했습니다.`); return; }
    show("success", `${label}을(를) 삭제했습니다.`);
  };

  // 탭 콘텐츠
  const renderDashboard = () => {
    const stats = statsResult.status === "success" ? statsResult.data : null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="전체 회원" value={stats ? String(stats.users) : "-"} color="primary" />
        <StatCard label="전체 게시글" value={stats ? String(stats.posts) : "-"} color="primary" />
        <StatCard label="전체 댓글" value={stats ? String(stats.comments) : "-"} color="primary" />
        <StatCard label="대기 중인 신고" value={stats ? String(stats.pendingReports) : "-"} color="red" />
      </div>
    );
  };

  const renderUsers = () => {
    const { status } = usersResult;
    const users = usersResult.data?.users ||[];

    return (
      <div>
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="회원 검색 (이메일, 닉네임)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {status === "loading" && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-16"></div>
            ))}
          </div>
        )}

        {status === "success" && (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700 shrink-0">
                  {u.nickname.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 text-sm">{u.nickname}</div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    u.status === "ACTIVE"
                      ? "bg-primary-100 text-primary-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {u.status === "ACTIVE" ? "활성" : "정지"}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    u.role === "ADMIN"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-primary-100 text-primary-700"
                  }`}>
                    {u.role === "ADMIN" ? "관리자" : "학생"}
                  </span>
                  {u.role !== "ADMIN" && (
                    <>
                      <button type="button" onClick={() => updateUserStatus(u.id, u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")} className="px-2 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">
                        {u.status === "ACTIVE" ? "정지" : "해제"}
                      </button>
                      <button type="button" onClick={() => deleteUser(u.id)} className="px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50">삭제</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8 text-red-500">
            <p className="text-sm">데이터를 불러오지 못했습니다.</p>
          </div>
        )}
      </div>
    );
  };

  const renderPosts = () => (
    <div className="space-y-2">
      {postsResult.status === "loading" && <div className="text-sm text-gray-400">게시글을 불러오는 중...</div>}
      {postsResult.status === "success" && postsResult.data.posts.map((post) => (
        <div key={post.id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{post.title}</div><div className="text-xs text-gray-400">{post.author?.nickname || post.authorId} · {post.commentCount}댓글</div></div>
          <button type="button" onClick={() => deleteAdminTarget("/api/admin/posts/", post.id, "게시글")} className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600">삭제</button>
        </div>
      ))}
    </div>
  );

  const saveNoticePriority = async (noticeId: string, priority: number) => {
    const save = async () => {
      const csrfResponse = await fetch(`/api/csrf-token?t=${Date.now()}`, { credentials: "include", cache: "no-store" });
      const { csrfToken } = await csrfResponse.json();
      return fetch(`/api/admin/notices/${noticeId}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ noticePriority: priority }) });
    };
    let res = await save();
    if (res.status === 403) res = await save();
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { show("error", `${res.status}: ${data.message || "고정 순서 저장에 실패했습니다."}`); return; }
    setRefreshKey((value) => value + 1);
  };

  const saveSongseolSettings = async () => {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch("/api/admin/songseol-settings", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify({ songseolMinLikes }) });
    if (!res.ok) { const body = await res.json().catch(() => ({})); show("error", body.message || "송설글 설정 저장에 실패했습니다."); return; }
    setRefreshKey((value) => value + 1);
  };

  const toggleSongseol = async (post: any) => {
    const csrfToken = await fetchCsrfToken();
    const isAutomaticallyEligible = !post.isSongseolExcluded && Number(post.likeCount ?? 0) >= songseolMinLikes;
    const isCurrentlySongseol = Boolean(post.isSongseol) || isAutomaticallyEligible;
    const res = await fetch(`/api/admin/posts/${post.id}/songseol`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify(isCurrentlySongseol ? { isSongseol: false, isSongseolExcluded: true } : { isSongseol: true, isSongseolExcluded: false }) });
    if (!res.ok) { const body = await res.json().catch(() => ({})); show("error", body.message || "송설글 지정에 실패했습니다."); return; }
    setRefreshKey((value) => value + 1);
  };

  const renderSongseol = () => (
    <div className="space-y-5">
      <div className="rounded-xl bg-primary-50 border border-primary-100 p-4"><p className="text-sm text-primary-900">추천수가 기준 이상인 글은 자동으로 송설글에 노출됩니다. 관리자가 직접 지정하거나 해제한 글은 자동 기준보다 우선합니다.</p></div>
      <div className="flex items-center gap-3"><label className="text-sm font-medium">자동 선정 추천수 기준</label><input type="number" min={0} value={songseolMinLikes} onChange={(e) => setSongseolMinLikes(Number(e.target.value))} className="w-28 px-3 py-2 border rounded-lg" /><button type="button" onClick={saveSongseolSettings} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm">저장</button></div>
      <div className="border-t pt-4"><p className="text-sm font-semibold mb-3">게시글 직접 지정</p>{postsResult.status === "success" && postsResult.data.posts.map((post) => { const included = Boolean(post.isSongseol) || (!post.isSongseolExcluded && Number(post.likeCount ?? 0) >= songseolMinLikes); return <div key={post.id} className="flex items-center gap-3 p-3 border rounded-lg"><span className="flex-1 truncate text-sm">{post.title}</span><button type="button" onClick={() => toggleSongseol(post)} className={`px-3 py-1.5 text-xs rounded-lg ${included ? "bg-primary-600 text-white" : "border border-gray-200"}`}>{included ? "송설글 해제" : "송설글 지정"}</button></div>; })}</div>
    </div>
  );

  const renderNotices = () => (
    <div className="space-y-3">
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">공지로 등록된 글의 고정 순서를 정합니다. 1부터 입력한 순서대로 모든 게시판 상단에 고정됩니다. 0은 고정하지 않음입니다.</div>
      {notices.length === 0 ? <div className="text-sm text-gray-400">등록된 공지가 없습니다.</div> : notices.map((notice) => (
        <div key={notice.id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{notice.title}</div><div className="text-xs text-gray-400">현재 순서: {notice.noticePriority || "고정 안 함"}</div></div>
          <input aria-label={`${notice.title} 고정 순서`} type="number" min={0} max={999} defaultValue={notice.noticePriority || 0} className="w-20 px-2 py-1.5 border rounded-lg text-sm" id={`notice-priority-${notice.id}`} />
          <button type="button" className="px-3 py-1.5 text-xs rounded-lg bg-primary-600 text-white" onClick={() => { const input = document.getElementById(`notice-priority-${notice.id}`) as HTMLInputElement | null; saveNoticePriority(notice.id, Number(input?.value || 0)); }}>저장</button>
        </div>
      ))}
    </div>
  );

  const renderComments = () => (
    <div className="space-y-2">
      {commentsResult.status === "loading" && <div className="text-sm text-gray-400">댓글을 불러오는 중...</div>}
      {commentsResult.status === "success" && commentsResult.data.comments.map((comment) => (
        <div key={comment.id} className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl">
          <div className="flex-1 min-w-0"><div className="text-sm truncate">{comment.content}</div><div className="text-xs text-gray-400">{comment.authorId}</div></div>
          <button type="button" onClick={() => deleteAdminTarget("/api/admin/comments/", comment.id, "댓글")} className="px-3 py-1.5 text-xs rounded-lg border border-red-200 text-red-600">삭제</button>
        </div>
      ))}
    </div>
  );

  const renderReports = () => {
    const { status } = reportsResult;
    const reports = reportsResult.data?.reports ||[];

    return (
      <div>
        {status === "loading" && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24"></div>
            ))}
          </div>
        )}

        {status === "success" && (
          <div className="space-y-3">
            {reports.map((r) => (
              <div
                key={r.id}
                className="p-4 bg-white rounded-xl border border-gray-200"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      r.status === "PENDING"
                        ? "bg-red-100 text-red-700"
                        : r.status === "RESOLVED"
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {r.status}
                    </span>
                    <span className="text-xs text-gray-400">
                      {r.targetType === "POST" ? "게시글" : "댓글"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(r.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mb-2">{r.reason}</p>

                <div className="text-xs text-gray-400">
                  신고자: {r.reporter?.nickname} ({r.reporter?.email})
                </div>
                {r.status === "PENDING" && (
                  <div className="flex gap-2 mt-4">
                    <button type="button" onClick={() => resolveReport(r.id, "resolve")} className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700">삭제 처리</button>
                    <button type="button" onClick={() => resolveReport(r.id, "dismiss")} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50">반려</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {status === "error" && (
          <div className="text-center py-8 text-red-500">
            <p className="text-sm">데이터를 불러오지 못했습니다.</p>
          </div>
        )}
      </div>
    );
  };


  const tabConfig = [
    { id: "dashboard", label: "대시보드", icon: "📊" },
    { id: "users", label: "회원 관리", icon: "👥" },
    { id: "posts", label: "게시글 관리", icon: "📝" },
    { id: "notices", label: "공지 고정", icon: "📌" },
    { id: "songseol", label: "송설글", icon: "🌲" },
    { id: "comments", label: "댓글 관리", icon: "💬" },
    { id: "reports", label: "신고 관리", icon: "⚠️" },

  ];

  return (
    <div className="min-h-screen bg-gray-50">


      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
          <span className="text-xs text-gray-400">
            {new Date().toLocaleString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-6">
          {tabConfig.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-primary-50 text-primary-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 min-h-[400px]">
          {activeTab === "dashboard" && renderDashboard()}
          {activeTab === "users" && renderUsers()}
          {activeTab === "posts" && renderPosts()}
          {activeTab === "notices" && renderNotices()}
          {activeTab === "songseol" && renderSongseol()}
          {activeTab === "comments" && renderComments()}
          {activeTab === "reports" && renderReports()}

        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: {
  label: string;
  value: string;
  color: "primary" | "red";
}) {
  return (
    <div className={`p-4 rounded-xl border ${
      color === "primary"
        ? "bg-primary-50 border-primary-100"
        : "bg-red-50 border-red-100"
    }`}>
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className={`text-3xl font-bold ${
        color === "primary" ? "text-primary-700" : "text-red-600"
      }`}>
        {value}
      </div>
    </div>
  );
}
