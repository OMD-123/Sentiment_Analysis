import React, { createContext, useContext, useState, useEffect } from "react";
import { api } from "../services/api";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  darkMode: boolean;
  setDarkMode: (value: boolean | ((prev: boolean) => boolean)) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("sentiment_token"));
  const [loading, setLoading] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("sentiment_dark");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("sentiment_dark", String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  useEffect(() => {
    const checkUser = async () => {
      if (token) {
        try {
          const res = await api.get("/auth/me");
          setUser(res.data.user);
        } catch (err) {
          localStorage.removeItem("sentiment_token");
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("sentiment_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const res = await api.post("/auth/register", { name, email, password });
    localStorage.setItem("sentiment_token", res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem("sentiment_token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, darkMode, setDarkMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
