import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Header() {
  const { user, logout, loading } = useAuth();

  if (loading) return null;

  return (
    <header className="border-b border-primary-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-white border border-primary-100 flex items-center justify-center overflow-hidden shadow-sm">
            <img src="/school-logo.webp" alt="김천고 로고" className="w-8 h-8 object-contain" />
          </div>
          <span className="font-semibold tracking-tight text-primary-900">김천고 커뮤니티</span>
        </Link>

        <nav className="flex items-center gap-4">
          {user?.status === "ACTIVE" ? (
            <>
              <Link
                to="/write"
                className="px-3 py-1.5 text-sm font-medium text-primary-800 hover:text-primary-900 hover:bg-primary-50 rounded-lg transition-colors"
              >
                글쓰기
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 px-3 py-1.5 text-sm"
              >
                {user.profileImageUrl ? (
                  <img
                    src={user.profileImageUrl}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                    {user.nickname.slice(0, 1)}
                  </div>
                )}
                <span className="hidden sm:inline text-gray-700">{user.nickname}</span>
              </Link>
              {user.role === "ADMIN" && (
                <Link
                  to="/admin"
                  className="px-3 py-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                >
                  관리자
                </Link>
              )}
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 text-sm font-medium text-primary-700 hover:text-primary-800"
              >
                로그인
              </Link>
              <Link
                to="/register"
                className="px-4 py-1.5 text-sm font-semibold text-white bg-primary-700 hover:bg-primary-800 rounded-lg transition-colors"
              >
                회원가입
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
