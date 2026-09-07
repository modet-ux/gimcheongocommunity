import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCsrfToken, useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";


export function EditProfilePage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { show } = useToast();

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>(user?.profileImageUrl ?? undefined);
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { show("error", "이미지 파일은 5MB까지 업로드할 수 있습니다."); return; }
    setUploadingImage(true);
    try {
      const form = new FormData(); form.append("images", file);
      const token = await fetchCsrfToken();
      const res = await fetch("/api/uploads/profile-image", { method: "POST", credentials: "include", headers: { "x-csrf-token": token }, body: form });
      if (!res.ok) throw new Error((await res.json()).message || "이미지 업로드에 실패했습니다.");
      setProfileImageUrl((await res.json()).url);
    } catch (err: any) { show("error", err.message); }
    finally { setUploadingImage(false); }
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      await updateProfile({
        nickname: nickname.trim() || undefined,
        profileImageUrl: profileImageUrl || undefined,
        statusMessage: statusMessage.trim() || null,
      });
      navigate("/profile");
    } catch (err: any) {
      setError(err.message);
      show("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">


      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">프로필 수정</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
            {/* 프로필 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">프로필 이미지 <span className="text-gray-400 font-normal">(선택)</span></label>
              <div className="flex items-center gap-4">
                {profileImageUrl ? <img src={profileImageUrl} alt="프로필 미리보기" className="w-20 h-20 rounded-full object-cover border" /> : <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">없음</div>}
                <label className="px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium cursor-pointer hover:bg-primary-700">{uploadingImage ? "업로드 중..." : "이미지 선택"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" disabled={uploadingImage} onChange={(e) => handleImageUpload(e.target.files?.[0])} /></label>
                {profileImageUrl && <button type="button" onClick={() => setProfileImageUrl(undefined)} className="text-sm text-gray-500">삭제</button>}
              </div>
            </div>

            {/* 닉네임 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                닉네임 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
                maxLength={20}
                required
              />
              <span className="text-xs text-gray-400 mt-1 block">
                {nickname.length} / 20
              </span>
            </div>

            {/* 상태 메시지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상태 메시지 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="지금 나의 상태를 알려보세요."
                maxLength={160}
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow"
              />
              <span className="text-xs text-gray-400 mt-1 block text-right">
                {statusMessage.length} / 160
              </span>
            </div>

            {/* 저장 */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "저장 중..." : "저장하기"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
