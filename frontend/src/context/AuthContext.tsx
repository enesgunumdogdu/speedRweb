import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { login as apiLogin, register as apiRegister, type LoginRequest, type RegisterRequest, type AuthResponse } from "../api/authApi";

interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function handleAuthResponse(res: AuthResponse) {
    const authUser: AuthUser = {
      userId: res.userId,
      email: res.email,
      displayName: res.displayName,
    };
    setToken(res.token);
    setUser(authUser);
    localStorage.setItem("token", res.token);
    localStorage.setItem("user", JSON.stringify(authUser));
  }

  async function login(data: LoginRequest) {
    const res = await apiLogin(data);
    handleAuthResponse(res);
  }

  async function register(data: RegisterRequest) {
    const res = await apiRegister(data);
    handleAuthResponse(res);
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  function updateUser(updated: AuthUser) {
    setUser(updated);
    localStorage.setItem("user", JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
