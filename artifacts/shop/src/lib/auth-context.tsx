import { createContext, useContext, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL;

type DbUser = NonNullable<ReturnType<typeof useGetMe>["data"]>;

interface AuthContextValue {
  user: DbUser | undefined;
  isLoading: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: undefined,
  isLoading: true,
  isSignedIn: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isPending } = useGetMe({
    query: { retry: false, staleTime: 60_000 },
  });

  const signOut = useCallback(async () => {
    await fetch(`${BASE}api/auth/logout`, { method: "POST", credentials: "include" });
    queryClient.clear();
    setLocation("/sign-in");
  }, [queryClient, setLocation]);

  return (
    <AuthContext.Provider value={{ user, isLoading: isPending, isSignedIn: !!user, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
