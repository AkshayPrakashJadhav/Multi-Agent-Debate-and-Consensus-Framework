"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  MessageSquareCode, 
  Files, 
  BarChart3, 
  LogOut, 
  LogIn, 
  User as UserIcon,
  Cpu,
  Database,
  Activity,
  MessageSquare
} from "lucide-react";

interface PastSession {
  id: string;
  query: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [history, setHistory] = useState<PastSession[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && pathname !== "/login") {
      setUserEmail("guest@agenticdebate.io");
    } else if (token) {
      try {
        const payloadBase64 = token.split(".")[1];
        const decoded = JSON.parse(atob(payloadBase64));
        setUserEmail(decoded.sub || "user@domain.com");
      } catch {
        setUserEmail("user@domain.com");
      }
    }
  }, [pathname]);

  useEffect(() => {
    const fetchHistory = async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      try {
        const res = await fetch(`${baseUrl}/debate/sessions`, { headers });
        if (res.ok) {
          const data = await res.json();
          setHistory(data.slice(0, 6)); // Top 6 sessions
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchHistory();
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUserEmail(null);
    router.push("/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Dataset explorer", href: "/dataset", icon: Database },
    { name: "Agent debate board", href: "/debate", icon: MessageSquareCode },
    { name: "RAG document hub", href: "/documents", icon: Files },
    { name: "Benchmark suite", href: "/evaluation", icon: Activity },
    { name: "Analytics dashboard", href: "/analytics", icon: BarChart3 },
  ];

  return (
    <aside className="w-[240px] bg-bg-sidebar border-r border-border-subtle flex flex-col justify-between h-screen sticky top-0 shrink-0 font-sans">
      <div className="p-5 flex flex-col h-[calc(100vh-64px)] overflow-y-auto">
        {/* Title / Logo */}
        <Link href="/" className="flex items-center space-x-3 mb-6 group shrink-0">
          <div className="p-2 bg-accent-soft rounded-lg text-accent group-hover:scale-105 transition-transform">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight text-text-primary">ConsensusAI</h1>
            <span className="text-[9px] text-text-secondary font-mono tracking-wider">multi-agent v1.0</span>
          </div>
        </Link>

        {/* Links */}
        <nav className="space-y-1 shrink-0 mb-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-accent-soft text-accent border-l-2 border-accent"
                    : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-accent" : "text-text-secondary"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Past Debate History */}
        {history.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-[150px] border-t border-border-subtle pt-4">
            <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono tracking-wider block mb-2 px-1">
              Recent debates
            </span>
            <div className="space-y-1">
              {history.map((h) => {
                return (
                  <Link
                    key={h.id}
                    href={`/debate?id=${h.id}`}
                    className="flex items-center space-x-2 px-2.5 py-2 rounded-md text-[11px] text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors truncate"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    <span className="truncate">{h.query}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer Profile */}
      <div className="p-4 border-t border-border-subtle bg-bg-sidebar shrink-0">
        {userEmail ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-full bg-bg-hover flex items-center justify-center text-text-secondary shrink-0">
                <UserIcon className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-[11px] font-semibold text-text-primary truncate">{userEmail}</span>
                <span className="text-[8px] text-success font-mono font-semibold">Active Session</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-1 rounded-lg text-text-secondary hover:text-accent hover:bg-bg-hover transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center justify-center space-x-2 w-full py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Sign Up</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
