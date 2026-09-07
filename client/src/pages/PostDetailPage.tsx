import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { usePost, useComments } from "../hooks/useApi";
import { fetchCsrfToken, useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { TiptapEditor } from "../components/TiptapEditor";

function renderPostContent(content: unknown, images: any[] = []) {
  let normalized = content;
  if (typeof content === "string") {
    try {
      let parsed: any = JSON.parse(content);
      if (typeof parsed === "string") {
        try { parsed = JSON.parse(parsed); } catch { /* 일반 문자열 */ }
      }
      if (Array.isArray(parsed) || parsed?.type === "doc") normalized = parsed;
    } catch { /* 일반 문자열 본문 */ }
  }
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized) && (normalized as any).type === "doc") {
    normalized = (normalized as any).content || [];
  }
  if (!Array.isArray(normalized)) return typeof normalized === "string" ? normalized : JSON.stringify(normalized, null, 2);
  return normalized.map((block: any, index: number) => {
    if (block?.type === "image" || block?.type === "image_single") {
      const attrs = block.attrs || block;
      const image = images.find((item) => item.id === attrs.imageId || item.id === block.imageId) || images[index];
      const src = image?.url || attrs.src;
      const width = attrs.width || block.width;
      const align = attrs.align || block.align || "center";
      const margin = align === "left" ? "0 auto 0 0" : align === "right" ? "0 0 0 auto" : "0 auto";
      return src ? <img key={index} src={src} alt={attrs.alt || block.caption || "본문 이미지"} className="my-4 rounded-xl block" style={{ width: width ? `${width}px` : "auto", maxWidth: "100%", margin, objectFit: "contain" }} /> : null;
    }
    if (block?.type === "paragraph" || block?.type === "heading" || block?.type === "blockquote") {
      const text = (block.content || []).map((child: any) => child.text || "").join("");
      return text ? <p key={index} className="whitespace-pre-wrap break-words">{text}</p> : null;
    }
    return block?.text ? <p key={index} className="whitespace-pre-wrap break-words">{block.text}</p> : null;
  });
}

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { show } = useToast();

  const postResult = usePost(id || "");
  const { status, data: postData, error } = postResult as any;
  const post = postData?.post;

  const commentsResult = useComments(id || "");
  const { status: commentsStatus, data: commentsData } = commentsResult as any;
  const [comments, setComments] = useState<any[]>([]);
  useEffect(() => {
    setComments((commentsData as any)?.comments || []);
  }, [commentsData]);

  const [localLikeCount, setLocalLikeCount] = useState(post?.likeCount || 0);
  const [localDislikeCount, setLocalDislikeCount] = useState(post?.dislikeCount || 0);
  const [localReaction, setLocalReaction] = useState<"LIKE" | "DISLIKE" | null>(post?.userReaction || null);

  const [commentContent, setCommentContent] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [postEditing, setPostEditing] = useState(false);
  const [postEditTitle, setPostEditTitle] = useState("");
  const [postEditContent, setPostEditContent] = useState("");
  const [commentEditingId, setCommentEditingId] = useState<string | null>(null);
  const [commentEditContent, setCommentEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [anonymousAuthOpen, setAnonymousAuthOpen] = useState(false);
  const [anonymousAuthAction, setAnonymousAuthAction] = useState<"edit" | "delete" | null>(null);
  const [anonymousEmail, setAnonymousEmail] = useState("");
  const [anonymousPassword, setAnonymousPassword] = useState("");
  const [reportTarget, setReportTarget] = useState<{ type: "POST" | "COMMENT"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");

  const updateCommentTree = (items: any[], commentId: string, updater: (comment: any) => any): any[] => items.map((comment) => comment.id === commentId
    ? updater(comment)
    : { ...comment, replies: updateCommentTree(comment.replies || [], commentId, updater) });

  const removeCommentTree = (items: any[], commentId: string): any[] => items
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({ ...comment, replies: removeCommentTree(comment.replies || [], commentId) }));

  const appendReply = (items: any[], parentId: string, reply: any): any[] => items.map((comment) => comment.id === parentId
    ? { ...comment, replies: [...(comment.replies || []), reply] }
    : { ...comment, replies: appendReply(comment.replies || [], parentId, reply) });

  const categoryLabels: Record<string, string> = { FREE: "자유게시판", QUESTION: "질문게시판", STUDY: "공부게시판", SCHOOL: "학교생활", CLUB: "동아리", CAREER: "진로", INFO: "정보게시판", SUGGESTION: "건의게시판" };

  // 좋아요
  const handleReaction = async (reaction: "LIKE" | "DISLIKE") => {
    if (user?.status !== "ACTIVE") {
      show("warning", "로그인 후 이용해주세요.");
      navigate("/login");
      return;
    }

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        credentials: "include",
        body: JSON.stringify({ reaction }),
      });
      if (!res.ok) throw new Error("반응 처리에 실패했습니다.");
      const data = await res.json();
      setLocalReaction(data.reaction);
      setLocalLikeCount(data.likeCount);
      setLocalDislikeCount(data.dislikeCount);
    } catch (err: any) {
      show("error", err.message);
    }
  };

  // 댓글 작성
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    if (user?.status !== "ACTIVE") {
      show("warning", "로그인 후 이용해주세요.");
      navigate("/login");
      return;
    }

    setCommentLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        credentials: "include",
        body: JSON.stringify({ content: commentContent.trim() }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "댓글 작성에 실패했습니다.");
      }
      setCommentContent("");
      const data = await res.json();
      setComments((current) => [...current, data.comment]);
    } catch (err: any) {
      show("error", err.message);
    } finally {
      setCommentLoading(false);
    }
  };

  // 댓글 좋아요
  const handleCommentReaction = async (commentId: string, reaction: "LIKE" | "DISLIKE") => {
    if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/comments/${commentId}/like`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ reaction }) });
      if (!res.ok) throw new Error("댓글 반응 처리에 실패했습니다.");
      const data = await res.json();
      setComments((current) => updateCommentTree(current, commentId, (comment) => ({
        ...comment,
        likeCount: data.likeCount,
        dislikeCount: data.dislikeCount,
        userReaction: data.reaction,
        userLiked: data.reaction === "LIKE",
      })));
    } catch (err: any) { show("error", err.message); }
  };

  // 댓글 수정
  const handleCommentEdit = async (commentId: string, currentContent: string) => {
    if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    setCommentEditingId(commentId);
    setCommentEditContent(currentContent);
  };

  const submitCommentEdit = async () => {
    if (!commentEditingId || !commentEditContent.trim()) return;
    setEditLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/comments/${commentEditingId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
        body: JSON.stringify({ content: commentEditContent.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "댓글 수정에 실패했습니다.");
      const data = await res.json();
      setComments((current) => updateCommentTree(current, commentEditingId, (comment) => ({ ...comment, ...data.comment })));
      setCommentEditingId(null);
      setCommentEditContent("");
    } catch (err: any) { show("error", err.message); }
    finally { setEditLoading(false); }
  };

  // 대댓글 작성
  const handleCommentReply = async (parentId: string, content: string) => {
    if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    if (!content.trim()) return;
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ content: content.trim(), parentId }) });
      if (!res.ok) throw new Error((await res.json()).message || "답글 작성에 실패했습니다.");
      const data = await res.json();
      setComments((current) => appendReply(current, parentId, data.comment));
    } catch (err: any) { show("error", err.message); }
  };

  // 댓글 삭제
  const handleCommentDelete = async (commentId: string) => {
    if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    if (!confirm("이 댓글과 답글을 삭제하시겠습니까?")) return;
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}/comments/${commentId}`, { method: "DELETE", credentials: "include", headers: { "x-csrf-token": csrfToken } });
      if (!res.ok) throw new Error((await res.json()).message || "댓글 삭제에 실패했습니다.");
      setComments((current) => removeCommentTree(current, commentId));
    } catch (err: any) { show("error", err.message); }
  };

  const handleCommentReport = async (commentId: string) => {
    if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    setReportTarget({ type: "COMMENT", id: commentId }); setReportReason("");
  };

  // 신고
  const handleReport = async () => {
    if (user?.status !== "ACTIVE") {
      show("warning", "로그인 후 이용해주세요.");
      navigate("/login");
      return;
    }

    setReportTarget({ type: "POST", id: id || "" }); setReportReason("");
  };

  const submitReport = async () => {
    if (!reportTarget || reportReason.trim().length < 10) { show("warning", "신고 사유는 10자 이상 입력해야 합니다."); return; }
    try {
      const token = await fetchCsrfToken();
      const url = reportTarget.type === "POST" ? `/api/posts/${id}/report` : `/api/posts/${id}/comments/${reportTarget.id}/report`;
      const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ reason: reportReason.trim() }) });
      if (!res.ok) throw new Error((await res.json()).message || "신고에 실패했습니다.");
      setReportTarget(null); setReportReason(""); show("success", "신고가 접수되었습니다.");
    } catch (err: any) { show("error", err.message); }
  };

  // 게시글 삭제
  const handlePostEdit = async () => {
    if (post?.isAnonymous && user?.id !== post?.authorId && user?.role !== "ADMIN") {
      setAnonymousAuthAction("edit"); setAnonymousAuthOpen(true); return;
    } else if (user?.status !== "ACTIVE") { show("warning", "로그인 후 이용해주세요."); navigate("/login"); return; }
    setPostEditTitle(post?.title || "");
    setPostEditContent(typeof post?.content === "string" ? post.content : JSON.stringify(post?.content || ""));
    setPostEditing(true);
  };

  const submitPostEdit = async () => {
    if (!postEditTitle.trim() || !postEditContent.trim()) return;
    setEditLoading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ title: postEditTitle.trim(), content: postEditContent.trim() }) });
      if (!res.ok) throw new Error((await res.json()).message || "게시글 수정에 실패했습니다.");
      await res.json();
      setPostEditing(false);
      window.location.reload();
    } catch (err: any) { show("error", err.message); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async () => {
    if (!confirm("이 게시글을 삭제하시겠습니까?")) return;
    if (post?.isAnonymous && user?.id !== post?.authorId && user?.role !== "ADMIN") {
      setAnonymousAuthAction("delete"); setAnonymousAuthOpen(true); return;
    } else if (user?.status !== "ACTIVE") {
      show("warning", "로그인 후 이용해주세요.");
      navigate("/login");
      return;
    }

    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrfToken },
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "삭제에 실패했습니다.");
      }
      navigate("/");
    } catch (err: any) {
      show("error", err.message);
    }
  };

  const submitAnonymousAuth = async () => {
    if (!anonymousEmail.trim() || !anonymousPassword || !anonymousAuthAction) return;
    setEditLoading(true);
    try {
      const token = await fetchCsrfToken();
      const login = await fetch("/api/users/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ email: anonymousEmail.trim(), password: anonymousPassword }) });
      if (!login.ok) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      const action = anonymousAuthAction;
      setAnonymousAuthOpen(false); setAnonymousAuthAction(null); setAnonymousEmail(""); setAnonymousPassword("");
      if (action === "edit") { setPostEditTitle(post?.title || ""); setPostEditContent(typeof post?.content === "string" ? post.content : JSON.stringify(post?.content || "")); setPostEditing(true); }
      else { const deleteToken = await fetchCsrfToken(); const res = await fetch(`/api/posts/${id}`, { method: "DELETE", credentials: "include", headers: { "x-csrf-token": deleteToken } }); if (!res.ok) throw new Error((await res.json()).message || "삭제에 실패했습니다."); navigate("/"); }
    } catch (err: any) { show("error", err.message); }
    finally { setEditLoading(false); }
  };

  if (status === "loading" || commentsStatus === "loading") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="animate-pulse bg-white rounded-2xl border border-gray-200 p-6 h-48"></div>
          <div className="animate-pulse bg-white rounded-2xl border border-gray-200 p-6 h-32 mt-4"></div>
        </div>
      </div>
    );
  }

  if (status === "error" || !post) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-2">게시글을 찾을 수 없습니다.</h1>
          <p className="text-gray-500 mb-4">{error}</p>
          <Link to="/" className="text-primary-600 hover:text-primary-700 font-medium">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const author = post.author;

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* 게시글 카드 */}
        {anonymousAuthOpen && <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold text-blue-900 mb-2">익명 글 인증</h2><p className="text-sm text-blue-700 mb-3">작성에 사용한 회원 계정의 이메일과 비밀번호를 입력하세요.</p><div className="space-y-2"><input type="email" value={anonymousEmail} onChange={(e) => setAnonymousEmail(e.target.value)} placeholder="이메일" className="w-full px-3 py-2 border rounded-lg bg-white" /><input type="password" value={anonymousPassword} onChange={(e) => setAnonymousPassword(e.target.value)} placeholder="비밀번호" className="w-full px-3 py-2 border rounded-lg bg-white" /><div className="flex gap-2"><button type="button" onClick={submitAnonymousAuth} disabled={editLoading} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm">{editLoading ? "인증 중..." : "인증하기"}</button><button type="button" onClick={() => { setAnonymousAuthOpen(false); setAnonymousAuthAction(null); }} className="px-4 py-2 rounded-lg text-sm text-gray-600">취소</button></div></div></div>}
        {reportTarget && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4"><h2 className="font-semibold text-red-900 mb-2">{reportTarget.type === "POST" ? "게시글 신고" : "댓글 신고"}</h2><textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={4} maxLength={1000} placeholder="신고 사유를 10자 이상 입력하세요" className="w-full px-3 py-2 border border-red-200 rounded-lg bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300" /><div className="flex justify-end gap-2 mt-2"><button type="button" onClick={() => setReportTarget(null)} className="px-3 py-1.5 text-sm text-gray-600">취소</button><button type="button" onClick={submitReport} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">신고 접수</button></div></div>}
        <article className="rounded-2xl border overflow-hidden bg-white border-gray-200">
          {/* 헤더 */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 프로필 */}
              {post.isAnonymous ? (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">익</div>
              ) : author?.profileImageUrl ? (
                <img
                  src={author.profileImageUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-primary-100"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                  {post.isAnonymous ? "익" : author?.nickname?.slice(0, 1)}
                </div>
              )}
              <div>
                <button type="button" onClick={() => !post.isAnonymous && author?.id && navigate(`/users/${author.id}`)} className="font-medium text-gray-900 text-sm hover:text-primary-600 hover:underline">{post.isAnonymous ? "익명" : author?.nickname || "알 수 없음"}</button>
                <div className="text-xs text-gray-400">
                  {formatDate(post.createdAt)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                조회수 {post.viewCount}
              </span>
            </div>
          </div>

          {/* 제목 */}
          <div className="px-6 py-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {post.isNotice && <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">공지</span>}
              {!post.isNotice && post.category && <span className="px-2.5 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">{categoryLabels[post.category] || post.category}</span>}
            </div>
            {postEditing ? (
              <div className="space-y-3 mb-4">
                <input value={postEditTitle} onChange={(e) => setPostEditTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-lg font-bold" />
                <TiptapEditor value={postEditContent} onChange={setPostEditContent} />
                <div className="flex gap-2"><button type="button" onClick={submitPostEdit} disabled={editLoading} className="px-3 py-2 rounded-lg bg-primary-600 text-white text-sm">{editLoading ? "저장 중..." : "저장"}</button><button type="button" onClick={() => setPostEditing(false)} className="px-3 py-2 rounded-lg text-sm text-gray-500">취소</button></div>
              </div>
            ) : <h1 className="text-xl font-bold text-gray-900 mb-4">{post.title}</h1>}

          </div>

          {/* 본문 */}
          <div className="px-6 py-4">
            <div
              className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap break-words"
            >
              {renderPostContent(post.content, post.images || [])}
            </div>
          </div>


          {/* 좋아요 / 신고 / 삭제 */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* 좋아요 */}
                      <button onClick={() => handleReaction("LIKE")} aria-label="좋아요" className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${localReaction === "LIKE" ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700"}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v9h9.28a2 2 0 001.94-1.515l1.2-5A2 2 0 0017.48 11H14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11H5a2 2 0 00-2 2v5a2 2 0 002 2h2" /></svg>{localLikeCount}</button>
                      <button onClick={() => handleReaction("DISLIKE")} aria-label="싫어요" className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${localReaction === "DISLIKE" ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" : "bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-700"}`}><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V4H7.72a2 2 0 00-1.94 1.515l-1.2 5A2 2 0 006.52 13H10z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 13h2a2 2 0 002-2V6a2 2 0 00-2-2h-2" /></svg>{localDislikeCount}</button>

              {/* 신고 */}
              {user?.status === "ACTIVE" && (
                <button
                  onClick={handleReport}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6m-4 14h8" />
                  </svg>
                  신고
                </button>
              )}
            </div>

            {/* 삭제 (작성자 또는 관리자) */}
            {(post.isAnonymous || user?.id === post.authorId || user?.role === "ADMIN") && (
              <div className="flex items-center gap-2">
                <button onClick={handlePostEdit} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">수정</button>
                <button onClick={handleDelete} className="px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">삭제</button>
              </div>
            )}
          </div>
        </article>

        {/* 댓글 섹션 */}
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              댓글 ({comments.length})
            </h2>
          </div>

          {/* 댓글 작성 */}
          {user?.status === "ACTIVE" ? (
            <form onSubmit={handleCommentSubmit} className="mb-6">
              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
                  {user.nickname.slice(0, 1)}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="댓글을 작성하세요..."
                    rows={2}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow text-sm"
                    disabled={commentLoading}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={!commentContent.trim() || commentLoading}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {commentLoading ? "작성 중..." : "댓글 작성"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl text-center">
              <p className="text-sm text-gray-500 mb-2">댓글을 작성하려면 로그인하세요.</p>
              <Link to="/login" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                로그인하기
              </Link>
            </div>
          )}

          {/* 댓글 목록 */}
          {comments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">첫 댓글을 작성해보세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment: any) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={user?.id || ""}
                  onReaction={handleCommentReaction}
                  onEdit={handleCommentEdit}
                  onDelete={handleCommentDelete}
                  onReply={handleCommentReply}
                  onReport={handleCommentReport}
                  isReply={false}
                  isAdmin={user?.role === "ADMIN"}
                  editingId={commentEditingId}
                  editContent={commentEditContent}
                  onEditContentChange={setCommentEditContent}
                  onSaveEdit={submitCommentEdit}
                  onCancelEdit={() => setCommentEditingId(null)}
                  editLoading={editLoading}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CommentItem({ comment, currentUserId, onReaction, onEdit, onDelete, onReply, onReport, isReply, isAdmin, editingId, editContent, onEditContentChange, onSaveEdit, onCancelEdit, editLoading }: {
  comment: any;
  currentUserId: string;
  onReaction: (commentId: string, reaction: "LIKE" | "DISLIKE") => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onReply: (commentId: string, content: string) => Promise<void>;
  onReport: (commentId: string) => void;
  isReply: boolean;
  isAdmin: boolean;
  editingId: string | null;
  editContent: string;
  onEditContentChange: (content: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  editLoading: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);

  const submitReply = async () => {
    if (!replyContent.trim() || replyLoading) return;
    setReplyLoading(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent("");
      setReplying(false);
    } finally {
      setReplyLoading(false);
    }
  };

  return (
    <div className="flex gap-3">
      <div className="w-10 h-10 shrink-0 rounded-full bg-primary-100 flex items-center justify-center text-sm font-medium text-primary-700">
        {comment.author?.nickname?.slice(0, 1)}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">{comment.author?.nickname}</span>
          <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
        </div>
        {editingId === comment.id ? (
          <div className="space-y-2">
            <textarea value={editContent} onChange={(e) => onEditContentChange(e.target.value)} rows={3} className="w-full px-3 py-2 border-2 border-blue-400 rounded-lg text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
            <div className="flex gap-2"><button type="button" onClick={onSaveEdit} disabled={editLoading} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs">{editLoading ? "저장 중..." : "저장"}</button><button type="button" onClick={onCancelEdit} className="px-3 py-1.5 rounded-lg text-xs text-gray-500">취소</button></div>
          </div>
        ) : <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.content}</p>}
        <div className="flex items-center gap-3 mt-2">
          <button className={`inline-flex items-center gap-1 text-xs ${comment.userReaction === "LIKE" ? "text-blue-600 font-semibold" : "text-gray-400 hover:text-blue-600"}`} onClick={() => onReaction(comment.id, "LIKE")}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v9h9.28a2 2 0 001.94-1.515l1.2-5A2 2 0 0017.48 11H14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 11H5a2 2 0 00-2 2v5a2 2 0 002 2h2" /></svg>{comment.likeCount}</button>
          <button className={`inline-flex items-center gap-1 text-xs ${comment.userReaction === "DISLIKE" ? "text-blue-600 font-semibold" : "text-gray-400 hover:text-blue-600"}`} onClick={() => onReaction(comment.id, "DISLIKE")}><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 15v4a3 3 0 003 3l4-9V4H7.72a2 2 0 00-1.94 1.515l-1.2 5A2 2 0 006.52 13H10z" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 13h2a2 2 0 002-2V6a2 2 0 00-2-2h-2" /></svg>{comment.dislikeCount || 0}</button>

          {(currentUserId === comment.authorId || currentUserId === comment.author?.id || isAdmin) && (
            <button onClick={() => onEdit(comment.id, comment.content)} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              수정
            </button>
          )}
          {(currentUserId === comment.authorId || currentUserId === comment.author?.id || isAdmin) && (
            <button onClick={() => onDelete(comment.id)} className="text-xs text-red-500 hover:text-red-700 transition-colors">
              삭제
            </button>
          )}
          {!isReply && <button type="button" onClick={() => { setRepliesExpanded(true); setReplying((value) => !value); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">답글</button>}
          <button onClick={() => onReport(comment.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">신고</button>
        </div>
        {replying && (
          <div className="mt-3 flex gap-2">
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              placeholder="답글을 입력하세요..."
              rows={2}
              autoFocus
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={replyLoading}
            />
            <div className="flex flex-col gap-1">
              <button type="button" onClick={submitReply} disabled={!replyContent.trim() || replyLoading} className="px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs disabled:opacity-50">{replyLoading ? "등록 중" : "등록"}</button>
              <button type="button" onClick={() => { setReplying(false); setReplyContent(""); }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs">취소</button>
            </div>
          </div>
        )}
        {!isReply && comment.replies?.length > 0 && (
          <button type="button" onClick={() => setRepliesExpanded((value) => !value)} className="mt-3 text-xs font-medium text-primary-600 hover:text-primary-700">
            {repliesExpanded ? "답글 숨기기" : `답글 ${comment.replies.length}개 보기`}
          </button>
        )}
        {!isReply && repliesExpanded && comment.replies?.length > 0 && (
          <div className="mt-4 ml-6 space-y-4 border-l-2 border-gray-100 pl-4">
            {comment.replies.map((reply: any) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReaction={onReaction}
                onEdit={onEdit}
                onDelete={onDelete}
                onReply={onReply}
                onReport={onReport}
                isReply={true}
                isAdmin={isAdmin}
                editingId={editingId}
                editContent={editContent}
                onEditContentChange={onEditContentChange}
                onSaveEdit={onSaveEdit}
                onCancelEdit={onCancelEdit}
                editLoading={editLoading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(date: string): string {
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
