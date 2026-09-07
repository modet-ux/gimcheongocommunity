import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: { nickname?: string; profileImageUrl?: string; statusMessage?: string | null }) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token", { credentials: "include" });
  if (!res.ok) throw new Error("CSRFトークン取得失敗");
  const data = await res.json();
  return data.csrfToken;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/users/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error("ユーザー情報조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch("/api/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "로그인에 실패했습니다.");
    }

    await fetchUser();
  };

  const register = async (email: string, password: string, nickname: string) => {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch("/api/users/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify({ email, password, nickname }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "회원가입에 실패했습니다.");
    }
  };

  const logout = async () => {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch("/api/users/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("로그아웃에 실패했습니다.");
    }

    setUser(null);
  };

  const updateProfile = async (data: { nickname?: string; profileImageUrl?: string; statusMessage?: string | null }) => {
    const csrfToken = await fetchCsrfToken();
    const res = await fetch("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || "프로필 수정에 실패했습니다.");
    }

    await fetchUser();
  };

  const refreshUser = fetchUser;

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated: !!user && user.status === "ACTIVE",
      login,
      register,
      logout,
      updateProfile,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
