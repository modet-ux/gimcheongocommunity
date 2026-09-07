import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WritePage } from "./pages/WritePage";
import { PostDetailPage } from "./pages/PostDetailPage";
import { ProfilePage } from "./pages/ProfilePage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { AdminPage } from "./pages/admin/AdminPage";
import { Layout } from "./layout/Layout";
import { ToastProvider } from "./components/Toast";

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-200 border-t-primary-600"></div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={isAuthenticated ? <HomePage /> : <Navigate to="/login" replace />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="write" element={isAuthenticated ? <WritePage /> : <Navigate to="/login" />} />
          <Route path="post/:id" element={isAuthenticated ? <PostDetailPage /> : <Navigate to="/login" replace />} />
          <Route path="profile" element={isAuthenticated ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="users/:id" element={isAuthenticated ? <PublicProfilePage /> : <Navigate to="/login" replace />} />
          <Route path="profile/edit" element={isAuthenticated ? <EditProfilePage /> : <Navigate to="/login" />} />
          <Route path="admin/*" element={<AdminPage />} />
          <Route path="*" element={
            <div className="max-w-5xl mx-auto mt-16 px-4 text-center">
              <h1 className="text-4xl font-bold text-gray-700 mb-4">404</h1>
              <p className="text-gray-500 mb-4">페이지를 찾을 수 없습니다.</p>
              <a href="/" className="text-primary-600 hover:text-primary-700 font-medium">홈으로 돌아가기</a>
            </div>
          } />
        </Route>
      </Routes>
    </ToastProvider>
  );
}
