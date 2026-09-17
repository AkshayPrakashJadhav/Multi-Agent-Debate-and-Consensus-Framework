"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Cpu, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const endpoint = isLogin ? "/auth/login" : "/auth/register";
    const url = `${baseUrl}${endpoint}`;

    try {
      if (isLogin) {
        const params = new URLSearchParams();
        params.append("username", email);
        params.append("password", password);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Authentication failed");
        }

        const data = await res.json();
        localStorage.setItem("token", data.access_token);
        router.push("/");
      } else {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            full_name: fullName || null,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Registration failed");
        }

        setIsLogin(true);
        setPassword("");
        setError("Account created! Please sign in.");
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    localStorage.removeItem("token");
    router.push("/");
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-bg-app overflow-hidden font-sans">
      <div 
        className="w-full max-w-md p-8 rounded-2xl bg-bg-surface border border-border-subtle relative z-10 mx-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-accent-soft text-accent rounded-2xl mb-4 border border-transparent">
            <Cpu className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">ConsensusAI Suite</h2>
          <p className="text-text-secondary text-xs mt-1">Multi-Agent Debate & Decision Support</p>
        </div>

        {error && (
          <div className={`p-3 text-xs rounded-lg mb-4 text-center border ${
            error.includes("created") 
              ? "bg-success-soft text-success border-success/20" 
              : "bg-danger-soft text-danger border-danger/20"
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-text-tertiary" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-bg-app border border-border-default rounded-lg py-2 pl-9 pr-4 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-text-tertiary" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-bg-app border border-border-default rounded-lg py-2 pl-9 pr-4 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-text-tertiary" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-bg-app border border-border-default rounded-lg py-2 pl-9 pr-4 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>{loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}</span>
            {!loading && <ArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center space-y-3">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs text-text-secondary hover:text-accent transition-colors bg-transparent border-0 cursor-pointer"
          >
            {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
          </button>
          
          <div className="w-full flex items-center justify-center space-x-2 my-2">
            <div className="h-[1px] bg-border-subtle w-full" />
            <span className="text-[9px] text-text-tertiary font-mono">OR</span>
            <div className="h-[1px] bg-border-subtle w-full" />
          </div>

          <button
            onClick={handleGuestMode}
            className="w-full py-2 bg-bg-app border border-border-default hover:bg-bg-hover text-text-primary font-semibold rounded-lg text-xs transition-colors cursor-pointer"
          >
            Enter Dashboard in Sandbox / Guest Mode
          </button>
        </div>
      </div>
    </div>
  );
}
