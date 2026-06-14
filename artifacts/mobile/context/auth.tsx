import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { api, User, setTokenGetter } from "@/lib/api";

const TOKEN_KEY = "televerse_token";

async function getStored(): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}
async function saveStored(t: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.setItem(TOKEN_KEY, t); return; }
  return SecureStore.setItemAsync(TOKEN_KEY, t);
}
async function clearStored(): Promise<void> {
  if (Platform.OS === "web") { localStorage.removeItem(TOKEN_KEY); return; }
  return SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, otpCode?: string) => Promise<{ otpRequired?: boolean }>;
  register: (data: {
    email: string;
    password: string;
    fullName: string;
    referralCode?: string;
    otpCode?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyToken = (t: string | null) => {
    setToken(t);
    setTokenGetter(async () => t);
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await getStored();
        if (stored) {
          applyToken(stored);
          const me = await api.me.get();
          setUser(me);
        }
      } catch {
        await clearStored();
        applyToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login: AuthCtx["login"] = async (email, password, otpCode) => {
    const result = await api.auth.login(email, password, otpCode);
    if ("otpRequired" in result && result.otpRequired) return { otpRequired: true };
    const { token: t, user: u } = result as { token: string; user: User };
    await saveStored(t);
    applyToken(t);
    setUser(u);
    return {};
  };

  const register: AuthCtx["register"] = async (data) => {
    const { token: t, user: u } = await api.auth.register(data);
    await saveStored(t);
    applyToken(t);
    setUser(u);
  };

  const logout: AuthCtx["logout"] = async () => {
    try { await api.auth.logout(); } catch {}
    await clearStored();
    applyToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const me = await api.me.get();
    setUser(me);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
