import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCsrfToken, useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";

import { TiptapEditor } from "../components/TiptapEditor";

type Uploaded = { id: string; url: string; width: number; height: number };

function replaceUploadedImages(value: string, uploaded: Uploaded[]) {
  try {
    const doc = JSON.parse(value);
    let index = 0;
    const visit = (node: any): any => {
      if (!node || typeof node !== "object") return node;
      const next = { ...node };
      if (next.type === "image" && uploaded[index]) {
        const image = uploaded[index++];
        next.attrs = { ...(next.attrs || {}), src: image.url, imageId: image.id, alt: next.attrs?.alt || "본문 이미지" };
      }
      if (Array.isArray(next.content)) next.content = next.content.map(visit);
      return next;
    };
    return JSON.stringify(visit(doc));
  } catch {
    return value;
  }
}

function getEditorImageNames(value: string): Set<string> {
  try {
    const doc = JSON.parse(value);
    const names = new Set<string>();
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "image" && node.attrs?.imageId) names.add(node.attrs.imageId);
      if (Array.isArray(node.content)) node.content.forEach(visit);
    };
    visit(doc);
    return names;
  } catch {
    return new Set();
  }
}

export function WritePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("FREE");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isNotice, setIsNotice] = useState(false);
  const [editorImages, setEditorImages] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadEditorImage = async (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw new Error("JPEG, PNG, WebP, GIF 형식이며 파일당 5MB까지 업로드할 수 있습니다.");
    }
    setEditorImages((prev) => [...prev, file]);
    return { src: URL.createObjectURL(file), imageId: file.name };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) { show("warning", "제목과 내용을 입력해주세요."); return; }
    if (user?.status !== "ACTIVE") { show("warning", "로그인이 필요합니다."); navigate("/login"); return; }
    setUploading(true);
    try {
      const csrfToken = await fetchCsrfToken();
      const create = await fetch("/api/posts", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ title: title.trim(), content: content.trim(), category, isAnonymous, ...(user?.role === "ADMIN" ? { isNotice } : {}) }) });
      if (!create.ok) throw new Error((await create.json()).message || "게시글 작성에 실패했습니다.");
      const created = await create.json();
      let finalContent = content.trim();
      const activeImageNames = getEditorImageNames(finalContent);
      const activeEditorImages = editorImages.filter((file) => activeImageNames.has(file.name));
      if (activeEditorImages.length) {
        const form = new FormData();
        form.append("postId", created.post.id);
        activeEditorImages.forEach((file) => form.append("images", file));
        const upload = await fetch("/api/uploads/images", { method: "POST", credentials: "include", headers: { "x-csrf-token": csrfToken }, body: form });
        if (!upload.ok) throw new Error((await upload.json()).message || "이미지 업로드에 실패했습니다.");
        const result = await upload.json();
        finalContent = replaceUploadedImages(finalContent, result.uploaded || []);
        const update = await fetch(`/api/posts/${created.post.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify({ content: finalContent }) });
        if (!update.ok) throw new Error("본문 이미지 연결에 실패했습니다.");
      }
      navigate(`/post/${created.post.id}`);
    } catch (error: any) { show("error", error.message || "게시글 작성에 실패했습니다."); }
    finally { setUploading(false); }
  };

  return <div className="min-h-screen bg-gray-50"><main className="max-w-3xl mx-auto px-4 py-6"><div className="bg-white rounded-2xl border border-gray-200 p-6"><h1 className="text-xl font-bold mb-6">게시글 작성</h1><form onSubmit={handleSubmit} className="space-y-6">
    <div><label className="block text-sm font-medium mb-1">게시판</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-4 py-2.5 border rounded-xl bg-white"><option value="FREE">자유게시판</option><option value="QUESTION">질문게시판</option><option value="STUDY">공부게시판</option><option value="SCHOOL">학교생활</option><option value="CLUB">동아리</option><option value="CAREER">진로</option><option value="INFO">정보게시판</option><option value="SUGGESTION">건의게시판</option></select></div>
    <label className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm"><input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="mt-0.5" /><span><strong>익명으로 작성</strong><span className="block text-xs text-gray-500 mt-1">다른 사용자에게 닉네임과 프로필이 공개되지 않습니다. 관리자는 원 작성자를 확인할 수 있습니다.</span></span></label>
    {user?.role === "ADMIN" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={isNotice} onChange={(e) => setIsNotice(e.target.checked)} />공지로 등록</label><p className="mt-1 text-xs text-amber-800">공지 고정 순서는 관리자 페이지의 공지 고정에서 설정합니다.</p></div>}
    <div><label className="block text-sm font-medium mb-1">제목</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="제목을 입력하세요" className="w-full px-4 py-2.5 border rounded-xl" /></div>
    <div><label className="block text-sm font-medium mb-1">본문</label><TiptapEditor value={content} onChange={setContent} onImageUpload={uploadEditorImage} /><div className="text-xs text-gray-400 mt-1">서식 버튼, 이미지 드래그 앤 드롭, 붙여넣기를 사용할 수 있습니다.</div></div>

    <div className="flex gap-3"><button type="submit" disabled={uploading} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl disabled:opacity-50">{uploading ? "작성 중..." : "게시글 작성"}</button><button type="button" onClick={() => navigate(-1)} className="px-6 py-2.5 border rounded-xl">취소</button></div>
  </form></div></main></div>;
}
