"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { 
  Database, 
  MessageSquare, 
  TrendingUp, 
  DollarSign, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  FileDown
} from "lucide-react";

interface Session {
  id: string;
  query: string;
  domain: string;
  consensus_answer: string;
  confidence_score: number;
  cost: number;
  tokens_used: number;
  created_at: string;
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Global aggregate stats
  const [stats, setStats] = useState({
    totalRuns: 0,
    avgConfidence: 0,
    totalCost: 0,
    docsIndexed: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const sessionRes = await fetch(`${baseUrl}/debate/sessions`, { headers });
        let sessionData: Session[] = [];
        if (sessionRes.ok) {
          sessionData = await sessionRes.json();
          setSessions(sessionData);
        }

        const docRes = await fetch(`${baseUrl}/rag/documents`, { headers });
        let docs = [];
        if (docRes.ok) {
          docs = await docRes.json();
        }

        const total = sessionData.length;
        const sumConfidence = sessionData.reduce((acc, s) => acc + (s.confidence_score || 0), 0);
        const sumCost = sessionData.reduce((acc, s) => acc + (s.cost || 0), 0);
        
        setStats({
          totalRuns: total,
          avgConfidence: total > 0 ? Math.round(sumConfidence / total) : 0,
          totalCost: parseFloat(sumCost.toFixed(4)),
          docsIndexed: docs.length
        });
      } catch (e) {
        console.error("Error retrieving dashboard stats: ", e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const downloadPdf = async (id: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/debate/sessions/${id}/pdf`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `consensus_report_${id.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      alert("Failed to export PDF report.");
    }
  };

  const statCards = [
    { name: "Total knowledge documents", value: stats.docsIndexed, icon: Database, color: "text-text-secondary bg-bg-hover" },
    { name: "Agent debate runs", value: stats.totalRuns, icon: MessageSquare, color: "text-accent bg-accent-soft" },
    { name: "Avg consensus confidence", value: `${stats.avgConfidence}%`, icon: TrendingUp, color: "text-success bg-success-soft" },
    { name: "Aggregate agent cost", value: `$${stats.totalCost}`, icon: DollarSign, color: "text-text-secondary bg-bg-hover" }
  ];

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />
      
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold text-text-primary tracking-tight">System dashboard</h2>
              <p className="text-text-secondary text-xs mt-0.5">Multi-agent debate-and-consensus support framework</p>
            </div>
            <Link
              href="/debate"
              className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors shadow-none cursor-pointer self-start"
            >
              <span>Launch debate session</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.name}
                  className="p-5 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between h-[105px]"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-text-secondary text-[11px] font-medium">{c.name}</span>
                    <div className={`p-1.5 rounded-md ${c.color} border border-transparent`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary tracking-tight font-mono leading-none">{c.value}</h3>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main recent debates table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle">
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider font-mono">Recent decisions</h3>
                  <p className="text-text-secondary text-xs mt-0.5">List of latest multi-agent consensus iterations</p>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-text-secondary text-xs animate-pulse font-mono">Retrieving sessions...</div>
                ) : sessions.length === 0 ? (
                  <div className="py-16 text-center rounded-xl border border-dashed border-border-default">
                    <ShieldCheck className="w-6 h-6 mx-auto text-text-tertiary mb-2" />
                    <p className="text-text-secondary text-xs font-semibold">No debate sessions run yet</p>
                    <p className="text-text-tertiary text-[11px] mt-0.5">Upload knowledge sources and input a query to begin.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-text-primary border-collapse">
                      <thead>
                        <tr className="border-b border-border-subtle text-text-secondary font-semibold font-mono">
                          <th className="pb-3 text-left">Query / Request</th>
                          <th className="pb-3 text-left px-4">Domain</th>
                          <th className="pb-3 text-center px-4">Confidence</th>
                          <th className="pb-3 text-right px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {sessions.map((s) => (
                          <tr key={s.id} className="hover:bg-bg-hover/40 transition-colors">
                            <td className="py-3 pr-4 max-w-[280px]">
                              <div className="font-semibold text-text-primary truncate">{s.query}</div>
                              <div className="text-[11px] text-text-secondary mt-0.5 truncate">
                                {s.consensus_answer ? s.consensus_answer : "Orchestration incomplete"}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-bg-hover border border-border-subtle text-text-secondary font-mono">
                                {s.domain}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-xs font-mono font-semibold ${
                                s.confidence_score >= 85 
                                  ? "text-success" 
                                  : s.confidence_score >= 70 
                                  ? "text-warning" 
                                  : "text-text-secondary"
                              }`}>
                                {s.confidence_score ? `${s.confidence_score}%` : "Calculating"}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-3">
                              <Link 
                                href={`/debate?id=${s.id}`}
                                className="inline-flex items-center space-x-1 text-xs text-accent hover:text-accent-hover transition-colors font-medium"
                                title="Inspect Transcript"
                              >
                                <span>Review</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                              <button
                                onClick={() => downloadPdf(s.id)}
                                className="inline-flex items-center space-x-1 text-xs text-text-secondary hover:text-text-primary transition-colors bg-transparent border-0 cursor-pointer p-0"
                                title="Export PDF"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Quick guides sidebar */}
            <div className="space-y-6">
              <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider font-mono mb-4">Framework methodology</h3>
                <div className="space-y-4 text-xs text-text-secondary leading-relaxed">
                  <p>
                    This decision support system employs multiple distinct LLM personas working in cooperative debate rounds.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <span className="w-4 h-4 rounded bg-accent-soft text-accent font-semibold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">1</span>
                      <p><b>Planner Agent</b> parses the query and configures parameters.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-4 h-4 rounded bg-accent-soft text-accent font-semibold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">2</span>
                      <p><b>RAG Pipeline</b> parses query synonyms, retrieves dense chunks, and reranks them.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-4 h-4 rounded bg-accent-soft text-accent font-semibold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">3</span>
                      <p><b>Specialized Agents</b> debate findings, review peers, self-reflect, and vote.</p>
                    </div>
                    <div className="flex items-start space-x-3">
                      <span className="w-4 h-4 rounded bg-accent-soft text-accent font-semibold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">4</span>
                      <p><b>Arbiter</b> and <b>Verification Agent</b> validate claims, calculate variance, and estimate confidence.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-accent-soft border border-border-subtle flex flex-col justify-between min-h-[160px]">
                <div>
                  <h3 className="text-xs font-semibold text-accent uppercase tracking-wider font-mono mb-2">Systems benchmarking</h3>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Compare debate outputs against single-agent baselines. Observe differences in accuracy, faithfulness, citation precision, cost, and latency.
                  </p>
                </div>
                <Link
                  href="/evaluation"
                  className="mt-4 flex items-center justify-center space-x-2 py-2 border border-accent hover:bg-accent hover:text-white rounded-lg text-xs font-semibold text-accent transition-all cursor-pointer bg-bg-surface"
                >
                  <span>View evaluation metrics</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
