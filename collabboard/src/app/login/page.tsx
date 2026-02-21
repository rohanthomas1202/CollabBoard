"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const { isDark, toggleTheme } = useTheme();
  const { loginWithEmail, signupWithEmail, loginWithGoogle, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      if (isSignup) {
        await signupWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  };

  const handleGoogle = async () => {
    setError("");
    try {
      await loginWithGoogle();
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      data-theme={isDark ? "dark" : "light"}
      style={{
        background: isDark
          ? `radial-gradient(ellipse at 20% 50%, rgba(108,140,255,0.08), transparent 60%),
             radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.06), transparent 60%),
             radial-gradient(ellipse at 50% 80%, rgba(59,130,246,0.05), transparent 60%),
             var(--bg-primary)`
          : "var(--bg-primary)",
      }}
    >
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="fixed top-5 right-5 w-9 h-9 flex items-center justify-center cursor-pointer z-20"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-sm)",
          color: "var(--text-secondary)",
          transition: "all var(--duration-normal) var(--ease-out)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-hover)";
          e.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-default)";
          e.currentTarget.style.color = "var(--text-secondary)";
        }}
        title={isDark ? "Switch to light" : "Switch to dark"}
      >
        {isDark ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 1, 0.2, 1] }}
      >
        {/* Logo area */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 mb-5"
            style={{
              background: "var(--accent)",
              borderRadius: "var(--radius-lg)",
              boxShadow: isDark ? "0 0 32px rgba(108,140,255,0.2)" : "none",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
            CollabBoard
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            Real-time collaborative whiteboard
          </p>
        </div>

        {/* Card */}
        <div
          className="p-7"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text-primary)" }}>
            {isSignup ? "Create Account" : "Welcome back"}
          </h2>

          {error && (
            <div
              className="px-4 py-2.5 mb-5 text-sm"
              style={{
                background: "var(--error-muted)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: "var(--radius-md)",
                color: "var(--error)",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Display Name
                </label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 text-sm outline-none"
                  style={{
                    height: 44,
                    background: "var(--bg-surface-hover)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text-primary)",
                    transition: "all var(--duration-normal) var(--ease-out)",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "var(--border-active)";
                    e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "var(--border-default)";
                    e.target.style.boxShadow = "none";
                  }}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 text-sm outline-none"
                style={{
                  height: 44,
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  transition: "all var(--duration-normal) var(--ease-out)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--border-active)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-default)";
                  e.target.style.boxShadow = "none";
                }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Password
              </label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 text-sm outline-none"
                style={{
                  height: 44,
                  background: "var(--bg-surface-hover)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--text-primary)",
                  transition: "all var(--duration-normal) var(--ease-out)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--border-active)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-glow)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-default)";
                  e.target.style.boxShadow = "none";
                }}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="w-full font-medium text-sm text-white cursor-pointer"
              style={{
                height: 44,
                background: "var(--accent)",
                borderRadius: "var(--radius-lg)",
                border: "none",
                transition: "all var(--duration-normal) var(--ease-out)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--accent-hover)";
                e.currentTarget.style.boxShadow = "var(--shadow-glow)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--accent)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <hr className="flex-1 border-0" style={{ height: 1, background: "var(--border-subtle)" }} />
            <span className="text-xs" style={{ color: "var(--text-quaternary)" }}>or</span>
            <hr className="flex-1 border-0" style={{ height: 1, background: "var(--border-subtle)" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full font-medium text-sm flex items-center justify-center gap-2.5 cursor-pointer"
            style={{
              height: 44,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-lg)",
              color: "var(--text-primary)",
              transition: "all var(--duration-normal) var(--ease-out)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.background = "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border-default)";
              e.currentTarget.style.background = "var(--bg-surface)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-sm text-center mt-6" style={{ color: "var(--text-secondary)" }}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="font-medium cursor-pointer"
              style={{
                color: "var(--accent)",
                background: "none",
                border: "none",
                transition: "opacity var(--duration-fast) var(--ease-out)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
