import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchCsrfToken } from "../context/AuthContext";
import { useToast } from "../components/Toast";


export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(user?.profileImageUrl ?? undefined);
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const postsSentinelRef = useRef<HTMLDivElement | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { show("error", "이미지 파일은 5MB까지 업로드할 수 있습니다."); return; }
    setUploadingImage(true);
    try {
      const token = await fetchCsrfToken();
      const form = new FormData(); form.append("images", file);
      const res = await fetch("/api/uploads/profile-image", { method: "POST", credentials: "include", headers: { "x-csrf-token": token }, body: form });
      if (!res.ok) throw new Error((await res.json()).message || "이미지 업로드에 실패했습니다.");
      setProfileImageUrl((await res.json()).url);
    } catch (error: any) { show("error", error.message); }
    finally { setUploadingImage(false); }
  };

  const handleProfileSave = async () => {
    try {
      await updateProfile({ nickname: nickname.trim(), profileImageUrl: profileImageUrl || undefined, statusMessage: statusMessage.trim() || null });
      setEditing(false);
    } catch (error: any) { show("error", error.message); }
  };

  useEffect(() => {
    if (!user?.id) return;
    const hidden = JSON.parse(localStorage.getItem(`hidden-post-history:${user.id}`) || "[]");
    setHiddenPostIds(hidden);
    setMyPosts([]); setPostsPage(1); setHasMorePosts(false);
    fetch(`/api/posts?userId=${user.id}&page=1&limit=20`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("게시글을 불러오지 못했습니다.")))
      .then((data) => {
        setMyPosts((data.posts || []).filter((post: any) => !post.isAnonymous && !hidden.includes(post.id)));
        setHasMorePosts((data.posts || []).length === 20);
      })
      .catch((error) => show("error", error.message));
  }, [user?.id]);

  useEffect(() => {
    const sentinel = postsSentinelRef.current;
    if (!sentinel || !hasMorePosts || loadingMorePosts || !user?.id) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting) return;
      setLoadingMorePosts(true);
      const nextPage = postsPage + 1;
      try {
        const res = await fetch(`/api/posts?userId=${user.id}&page=${nextPage}&limit=20`, { credentials: "include" });
        if (!res.ok) throw new Error("게시글을 더 불러오지 못했습니다.");
        const data = await res.json();
        const nextPosts = (data.posts || []).filter((post: any) => !post.isAnonymous && !hiddenPostIds.includes(post.id));
        setMyPosts((current) => [...current, ...nextPosts]);
        setPostsPage(nextPage);
        setHasMorePosts((data.posts || []).length === 20);
      } catch (error: any) { show("error", error.message); }
      finally { setLoadingMorePosts(false); }
    }, { rootMargin: "240px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [user?.id, postsPage, hasMorePosts, loadingMorePosts, hiddenPostIds]);

  const handlePostDelete = async (postId: string) => {
    if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;
    if (!user?.id) return;
    const nextHidden = [...hiddenPostIds, postId];
    setHiddenPostIds(nextHidden);
    setMyPosts((current) => current.filter((post) => post.id !== postId));
    localStorage.setItem(`hidden-post-history:${user.id}`, JSON.stringify(nextHidden));
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch {
      // 오류 처리
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) { show("warning", "새 비밀번호가 일치하지 않습니다."); return; }
    setPasswordLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch("/api/users/me/password", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "비밀번호 변경에 실패했습니다.");
      show("success", data.message);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      await logout();
      navigate("/login");
    } catch (error: any) { show("error", error.message); }
    finally { setPasswordLoading(false); }
  };

  const handleAccountDelete = async () => {
    if (!deletePassword) { show("warning", "현재 비밀번호를 입력해주세요."); return; }
    if (!window.confirm("계정을 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")) return;
    setDeleteLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch("/api/users/me", { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ currentPassword: deletePassword }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "계정 삭제에 실패했습니다.");
      show("success", data.message);
      await logout();
      navigate("/");
    } catch (error: any) { show("error", error.message); }
    finally { setDeleteLoading(false); }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">


      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* 프로필 카드 */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start gap-6">
              {/* 프로필 이미지 */}
              <div className="relative">
                {profileImageUrl ? (
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-primary-100"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary-600 ring-4 ring-primary-100">
                    {user.nickname.slice(0, 1)}
                  </div>
                )}

              </div>

              {/* 정보 */}
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">닉네임</label>
                      <input
                        type="text"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        maxLength={20}
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm cursor-pointer">{uploadingImage ? "업로드 중..." : "이미지 선택"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingImage} onChange={(e) => handleImageUpload(e.target.files?.[0])} /></label>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">상태 메시지</label>
                      <textarea value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} maxLength={160} rows={3} placeholder="상태 메시지를 입력하세요" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <h1 className="text-xl font-bold text-gray-900">{user.nickname}</h1>
                    {user.statusMessage && (
                      <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap break-words">{user.statusMessage}</p>
                    )}
                    <p className="text-sm text-gray-500">{user.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        user.role === "ADMIN"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary-100 text-primary-700"
                      }`}>
                        {user.role === "ADMIN" ? "관리자" : "학생"}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        user.status === "ACTIVE"
                          ? "bg-primary-100 text-primary-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {user.status === "ACTIVE" ? "활성" : "정지"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 메뉴 */}
          <div className="p-2">
            {!editing && <button
              onClick={() => { setNickname(user.nickname); setProfileImageUrl(user.profileImageUrl ?? undefined); setStatusMessage(user.statusMessage || ""); setEditing(true); }}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 012.828 0L11.172 15H9v-2.828l8.586-8.586z" />
              </svg>
              프로필 수정
            </button>}
            {editing && <button type="button" onClick={handleProfileSave} className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">프로필 저장</button>}

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2.5 flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
              로그아웃
            </button>
          </div>
        </div>

        <section className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">보안 설정</h2>
          <form onSubmit={handlePasswordChange} className="space-y-3 max-w-md">
            <h3 className="text-sm font-semibold text-gray-700">비밀번호 변경</h3>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="현재 비밀번호" required className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="새 비밀번호 (8자 이상)" minLength={8} required className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="새 비밀번호 확인" minLength={8} required className="w-full px-3 py-2 border rounded-lg text-sm" />
            <button type="submit" disabled={passwordLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50">{passwordLoading ? "변경 중..." : "비밀번호 변경"}</button>
          </form>
        </section>

        <section className="mt-6 bg-white rounded-2xl border border-red-200 p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">위험 영역</h2>
          <p className="text-sm text-gray-500 mb-3">계정 삭제 후에는 게시글과 계정 정보를 복구할 수 없습니다.</p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md">
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="현재 비밀번호" className="flex-1 px-3 py-2 border rounded-lg text-sm" />
            <button type="button" onClick={handleAccountDelete} disabled={deleteLoading} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50">{deleteLoading ? "삭제 중..." : "계정 삭제"}</button>
          </div>
        </section>

        {/* 내 게시글 */}
        {!editing && (
          <div className="mt-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">내 게시글 ({myPosts.length})</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {myPosts.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm"><p className="mb-2">게시글이 아직 없습니다.</p><button onClick={() => navigate("/write")} className="text-primary-600 hover:text-primary-700 font-medium">첫 게시글 작성하기 →</button></div> : <div className="divide-y divide-gray-100">{myPosts.map((post) => <div key={post.id} className="p-4 flex items-center justify-between gap-3"><button type="button" onClick={() => navigate(`/post/${post.id}`)} className="text-left min-w-0"><h3 className="font-medium text-gray-900 truncate">{post.title}</h3><p className="text-xs text-gray-400 mt-1">좋아요 {post.likeCount} · 조회수 {post.viewCount} · 댓글 {post.commentCount}</p></button><button type="button" onClick={() => handlePostDelete(post.id)} className="shrink-0 text-sm text-red-500 hover:text-red-700">삭제</button></div>)}<div ref={postsSentinelRef} className="h-8 text-center text-xs text-gray-400 py-2">{loadingMorePosts ? "더 불러오는 중..." : hasMorePosts ? "" : ""}</div></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
