import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useGetTelegramConfig } from "@workspace/api-client-react";
import { useSignIn } from "@clerk/react";
import { ShieldCheck, Send } from "lucide-react";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export default function SignInPage() {
  const [, setLocation] = useLocation();
  const { data: config, isLoading } = useGetTelegramConfig();
  const { signIn, setActive } = useSignIn();
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ready = !!signIn;

  useEffect(() => {
    if (!config?.configured || !config.botUsername || !widgetRef.current || !ready) return;

    widgetRef.current.innerHTML = "";

    window.onTelegramAuth = async (tgUser: TelegramUser) => {
      setLoading(true);
      setError(null);
      try {
        // Step 1: verify with backend and get a Clerk sign-in token
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tgUser),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Authentication failed");
        }
        const { token } = await res.json();
        const result = await signIn!.create({ strategy: "ticket", ticket: token });
        if (result.status !== "complete") throw new Error("Sign-in incomplete");
        await setActive!({ session: result.createdSessionId });
        setLocation("/dashboard");
      } catch (e: any) {
        setError(e.message || "Authentication failed. Please try again.");
        setLoading(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute("data-telegram-login", config.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.async = true;
    widgetRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [config, ready, signIn, setLocation]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-widest text-primary text-lg sm:text-xl">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-8 sm:w-8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M8 11h8" /><path d="M12 7v8" />
          </svg>
          Telebit
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg shadow-md overflow-hidden">
            <div className="h-1 bg-primary w-full" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-xl font-bold text-foreground text-center">Sign In to Telebit</h1>
                <p className="text-sm text-muted-foreground text-center mt-1">Secure access via Telegram</p>
              </div>

              <div className="flex flex-col items-center gap-4">
                {isLoading || !ready ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Loading…
                  </div>
                ) : !config?.configured ? (
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <Send className="h-5 w-5 text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">Telegram login not configured</p>
                    <p className="text-xs text-muted-foreground">
                      An admin needs to set the Telegram bot credentials in the Admin Panel → Settings.
                    </p>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground">Authenticating with Telegram…</p>
                  </div>
                ) : (
                  <>
                    <div ref={widgetRef} className="flex justify-center min-h-[52px]" />
                    {error && (
                      <div className="w-full bg-destructive/10 border border-destructive/20 rounded px-3 py-2 text-xs text-destructive text-center">
                        {error}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Secure</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {["BSC Network", "AES-256", "No Email"].map((t) => (
                  <div key={t} className="bg-muted/50 rounded px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By signing in you agree to our terms of service.
          </p>
        </div>
      </main>
    </div>
  );
}
