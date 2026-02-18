"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
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
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0f1117 0%, #1a1d27 50%, #0f1117 100%)" }}>
      {/* Subtle background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #4f7df9, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, #4f7df9, #3b6ce8)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "#e8eaed" }}>CollabBoard</h1>
          <p className="mt-1.5 text-sm" style={{ color: "#8b8fa3" }}>Real-time collaborative whiteboard</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border" style={{ background: "rgba(26, 29, 39, 0.8)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderColor: "#2a2e3d" }}>
          <h2 className="text-lg font-semibold mb-5" style={{ color: "#e8eaed" }}>
            {isSignup ? "Create Account" : "Welcome back"}
          </h2>

          {error && (
            <div className="px-4 py-2.5 rounded-xl mb-4 text-sm" style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", color: "#fca5a5" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isSignup && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b8fa3" }}>Display Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                  style={{ background: "#242836", border: "1px solid #2a2e3d", color: "#e8eaed" }}
                  onFocus={(e) => { e.target.style.borderColor = "#4f7df9"; e.target.style.boxShadow = "0 0 0 3px rgba(79,125,249,0.1)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "#2a2e3d"; e.target.style.boxShadow = "none"; }}
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b8fa3" }}>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{ background: "#242836", border: "1px solid #2a2e3d", color: "#e8eaed" }}
                onFocus={(e) => { e.target.style.borderColor = "#4f7df9"; e.target.style.boxShadow = "0 0 0 3px rgba(79,125,249,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#2a2e3d"; e.target.style.boxShadow = "none"; }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#8b8fa3" }}>Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{ background: "#242836", border: "1px solid #2a2e3d", color: "#e8eaed" }}
                onFocus={(e) => { e.target.style.borderColor = "#4f7df9"; e.target.style.boxShadow = "0 0 0 3px rgba(79,125,249,0.1)"; }}
                onBlur={(e) => { e.target.style.borderColor = "#2a2e3d"; e.target.style.boxShadow = "none"; }}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl font-medium text-sm text-white transition-all duration-200 hover:shadow-lg cursor-pointer"
              style={{ background: "linear-gradient(135deg, #4f7df9, #3b6ce8)" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(79,125,249,0.3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {isSignup ? "Create Account" : "Sign In"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-4">
            <hr className="flex-1" style={{ borderColor: "#2a2e3d" }} />
            <span className="text-xs" style={{ color: "#5c6070" }}>or</span>
            <hr className="flex-1" style={{ borderColor: "#2a2e3d" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full py-2.5 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
            style={{ background: "#242836", border: "1px solid #2a2e3d", color: "#e8eaed" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3d4258"; e.currentTarget.style.background = "#2a2e3d"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2e3d"; e.currentTarget.style.background = "#242836"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-sm text-center mt-5" style={{ color: "#8b8fa3" }}>
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => {
                setIsSignup(!isSignup);
                setError("");
              }}
              className="font-medium hover:underline cursor-pointer"
              style={{ color: "#4f7df9" }}
            >
              {isSignup ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
