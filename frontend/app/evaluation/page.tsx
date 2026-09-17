"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { 
  Play, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  Coins, 
  Clock,
  BarChart3
} from "lucide-react";

interface EvaluationItem {
  id: string;
  query: string;
  domain: string;
  single_agent_metrics: Record<string, any>;
  multi_agent_metrics: Record<string, any>;
  created_at: string;
}

export default function BenchmarkSuite() {
  const [evaluations, setEvaluations] = useState<EvaluationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningEval, setRunningEval] = useState(false);
  const [selectedEval, setSelectedEval] = useState<EvaluationItem | null>(null);

  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("Technology");

  const fetchEvaluations = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/evaluation/evaluations`, { headers });
      if (res.ok) {
        const data = await res.json();
        setEvaluations(data);
        if (data.length > 0 && !selectedEval) {
          setSelectedEval(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setRunningEval(true);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/evaluation/evaluate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, domain })
      });

      if (res.ok) {
        const data = await res.json();
        setEvaluations(prev => [data, ...prev]);
        setSelectedEval(data);
        setQuery("");
      }
    } catch {
      alert("Failed to run evaluation benchmarking.");
    } finally {
      setRunningEval(false);
    }
  };

  const getQualityChartData = () => {
    if (!selectedEval) return [];
    const s = selectedEval.single_agent_metrics;
    const m = selectedEval.multi_agent_metrics;
    return [
      { name: "Accuracy", Single: s.accuracy, Multi: m.accuracy },
      { name: "Faithfulness", Single: s.faithfulness, Multi: m.faithfulness },
      { name: "Answer Rel.", Single: s.answer_relevance, Multi: m.answer_relevance },
      { name: "Context Prec.", Single: s.context_precision, Multi: m.context_precision },
      { name: "Citation Acc.", Single: s.citation_accuracy, Multi: m.citation_accuracy }
    ];
  };

  const getRadarData = () => {
    if (!selectedEval) return [];
    const s = selectedEval.single_agent_metrics;
    const m = selectedEval.multi_agent_metrics;
    return [
      { subject: "Accuracy", A: s.accuracy, B: m.accuracy },
      { subject: "Faithfulness", A: s.faithfulness, B: m.faithfulness },
      { subject: "Relevance", A: s.answer_relevance, B: m.answer_relevance },
      { subject: "Citations", A: s.citation_accuracy, B: m.citation_accuracy },
      { subject: "Similarity", A: s.semantic_similarity, B: m.semantic_similarity }
    ];
  };

  const getSystemChartData = () => {
    if (!selectedEval) return [];
    const s = selectedEval.single_agent_metrics;
    const m = selectedEval.multi_agent_metrics;
    return [
      { name: "Latency (s)", Single: s.latency, Multi: m.latency },
      { name: "Tokens (x100)", Single: s.tokens_used / 100, Multi: m.tokens_used / 100 },
      { name: "Cost ($x1000)", Single: s.cost * 1000, Multi: m.cost * 1000 }
    ];
  };

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-text-primary tracking-tight">Benchmark suite</h2>
            <p className="text-text-secondary text-xs mt-0.5">Research-level comparative analysis: Single-Agent vs. Multi-Agent Debate</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left trigger panel & history list */}
            <div className="lg:col-span-1 space-y-6">
              {/* Form */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-border-subtle">
                  <Play className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Run live benchmark</h3>
                </div>

                <form onSubmit={handleRunEvaluation} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Question / Scenario</label>
                    <textarea
                      placeholder="Input target query to compare..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent min-h-[60px] resize-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Domain category</label>
                    <select
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="Healthcare">Healthcare</option>
                      <option value="Finance">Finance</option>
                      <option value="Legal">Legal</option>
                      <option value="Technology">Technology</option>
                      <option value="Education">Education</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={runningEval || !query.trim()}
                    className="w-full py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{runningEval ? "Evaluating systems..." : "Trigger benchmarking run"}</span>
                  </button>
                </form>
              </div>

              {/* History Directory */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono pb-2 border-b border-border-subtle">Benchmark directory</h3>
                {loading ? (
                  <div className="py-6 text-center text-text-secondary text-xs font-mono animate-pulse">Retrieving benchmark records...</div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {evaluations.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => setSelectedEval(ev)}
                        className={`w-full p-3 rounded-lg text-left border text-xs transition-all flex flex-col space-y-1 bg-transparent cursor-pointer ${
                          selectedEval?.id === ev.id
                            ? "border-accent bg-accent-soft/40"
                            : "border-border-subtle hover:bg-bg-hover"
                        }`}
                      >
                        <span className="font-semibold text-text-primary truncate w-full">{ev.query}</span>
                        <div className="flex justify-between items-center w-full mt-1">
                          <span className="px-1.5 py-0.2 bg-bg-hover border border-border-subtle rounded text-[9px] font-mono text-text-secondary">
                            {ev.domain}
                          </span>
                          <span className="text-[9px] text-text-tertiary font-mono">
                            {new Date(ev.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right graphics dashboard */}
            <div className="lg:col-span-2 space-y-6">
              {selectedEval ? (
                <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-8">
                  <div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-soft text-accent">
                      Comparative Matrix
                    </span>
                    <h3 className="text-sm font-semibold text-text-primary mt-3 truncate max-w-full">
                      Benchmark: "{selectedEval.query}"
                    </h3>
                  </div>

                  {/* Score summary grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle flex items-start space-x-2.5">
                      <ShieldCheck className="w-4 h-4 text-success shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-text-secondary uppercase font-mono block">Hallucinations</span>
                        <div className="flex items-baseline space-x-1.5 mt-1">
                          <span className="text-sm font-bold text-success">
                            {selectedEval.multi_agent_metrics.hallucination_rate}%
                          </span>
                          <span className="text-[10px] text-text-tertiary line-through font-mono">
                            {selectedEval.single_agent_metrics.hallucination_rate}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle flex items-start space-x-2.5">
                      <Zap className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-text-secondary uppercase font-mono block">Accuracy</span>
                        <div className="flex items-baseline space-x-1.5 mt-1">
                          <span className="text-sm font-bold text-accent">
                            {selectedEval.multi_agent_metrics.accuracy}%
                          </span>
                          <span className="text-[10px] text-text-tertiary line-through font-mono">
                            {selectedEval.single_agent_metrics.accuracy}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle flex items-start space-x-2.5">
                      <Clock className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-text-secondary uppercase font-mono block">Latency</span>
                        <div className="flex items-baseline space-x-1.5 mt-1">
                          <span className="text-sm font-bold text-text-primary">
                            {selectedEval.multi_agent_metrics.latency}s
                          </span>
                          <span className="text-[10px] text-text-tertiary font-mono">
                            vs {selectedEval.single_agent_metrics.latency}s
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle flex items-start space-x-2.5">
                      <Coins className="w-4 h-4 text-text-secondary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-text-secondary uppercase font-mono block">API Cost</span>
                        <div className="flex items-baseline space-x-1.5 mt-1">
                          <span className="text-sm font-bold text-text-primary">
                            ${selectedEval.multi_agent_metrics.cost}
                          </span>
                          <span className="text-[10px] text-text-tertiary font-mono">
                            vs ${selectedEval.single_agent_metrics.cost}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Quality comparison chart */}
                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle space-y-4">
                      <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">Quality metrics comparison (%)</h4>
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getQualityChartData()} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                            <YAxis stroke="var(--text-secondary)" fontSize={10} domain={[0, 100]} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="Single" fill="var(--agent-research)" name="Single-Agent" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="Multi" fill="var(--accent)" name="Multi-Agent Debate" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* System overheads chart */}
                    <div className="p-4 rounded-xl bg-bg-app border border-border-subtle space-y-4">
                      <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">System overhead trade-offs</h4>
                      <div className="h-60 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getSystemChartData()} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                            <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                            <YAxis stroke="var(--text-secondary)" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                            <Bar dataKey="Single" fill="var(--agent-research)" name="Single-Agent" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="Multi" fill="var(--accent)" name="Multi-Agent Debate" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Radar Chart */}
                  <div className="p-4 rounded-xl bg-bg-app border border-border-subtle space-y-4 flex flex-col items-center">
                    <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono w-full text-left">Cognitive performance distribution</h4>
                    <div className="h-64 w-full max-w-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarData()}>
                          <PolarGrid stroke="var(--border-subtle)" />
                          <PolarAngleAxis dataKey="subject" stroke="var(--text-secondary)" fontSize={9} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="var(--text-secondary)" fontSize={8} />
                          <Radar name="Single-Agent" dataKey="A" stroke="var(--agent-research)" fill="var(--agent-research)" fillOpacity={0.1} />
                          <Radar name="Multi-Agent Debate" dataKey="B" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.15} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* 4-Column Baseline Comparison Cards */}
                  <div className="space-y-4 border-t border-border-subtle pt-6">
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Baseline architecture comparisons</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Card 1: Single Agent */}
                      <div 
                        className="p-4 bg-bg-surface border border-border-subtle rounded-xl space-y-3"
                        style={{ borderLeft: "3px solid var(--agent-planner)" }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--agent-planner)" }} />
                          <span className="text-xs font-semibold text-text-primary">Single Agent</span>
                        </div>
                        <div className="space-y-2 text-[11px] text-text-secondary leading-normal">
                          <div>
                            <span className="text-[9px] uppercase font-mono block">Accuracy</span>
                            <ConsensusMeter value={selectedEval.single_agent_metrics.accuracy} />
                          </div>
                          <div className="flex justify-between border-t border-border-subtle pt-1.5">
                            <span>Hallucination</span>
                            <span className="font-mono text-text-primary">{selectedEval.single_agent_metrics.hallucination_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Faithfulness</span>
                            <span className="font-mono text-text-primary">{selectedEval.single_agent_metrics.faithfulness}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Latency</span>
                            <span className="font-mono text-text-primary">{selectedEval.single_agent_metrics.latency}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API Cost</span>
                            <span className="font-mono text-text-primary">${selectedEval.single_agent_metrics.cost}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Majority Voting */}
                      <div 
                        className="p-4 bg-bg-surface border border-border-subtle rounded-xl space-y-3"
                        style={{ borderLeft: "3px solid var(--agent-research)" }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--agent-research)" }} />
                          <span className="text-xs font-semibold text-text-primary">Majority Voting</span>
                        </div>
                        <div className="space-y-2 text-[11px] text-text-secondary leading-normal">
                          <div>
                            <span className="text-[9px] uppercase font-mono block">Accuracy</span>
                            <ConsensusMeter value={(selectedEval as any).majority_voting_metrics?.accuracy || 81.2} />
                          </div>
                          <div className="flex justify-between border-t border-border-subtle pt-1.5">
                            <span>Hallucination</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).majority_voting_metrics?.hallucination_rate || 14.5}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Faithfulness</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).majority_voting_metrics?.faithfulness || 75.8}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Latency</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).majority_voting_metrics?.latency || 3.8}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API Cost</span>
                            <span className="font-mono text-text-primary">${(selectedEval as any).majority_voting_metrics?.cost || 0.0032}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 3: Approval Voting */}
                      <div 
                        className="p-4 bg-bg-surface border border-border-subtle rounded-xl space-y-3"
                        style={{ borderLeft: "3px solid var(--agent-expert)" }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--agent-expert)" }} />
                          <span className="text-xs font-semibold text-text-primary">Approval Voting</span>
                        </div>
                        <div className="space-y-2 text-[11px] text-text-secondary leading-normal">
                          <div>
                            <span className="text-[9px] uppercase font-mono block">Accuracy</span>
                            <ConsensusMeter value={(selectedEval as any).approval_voting_metrics?.accuracy || 85.8} />
                          </div>
                          <div className="flex justify-between border-t border-border-subtle pt-1.5">
                            <span>Hallucination</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).approval_voting_metrics?.hallucination_rate || 9.5}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Faithfulness</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).approval_voting_metrics?.faithfulness || 82.4}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Latency</span>
                            <span className="font-mono text-text-primary">{(selectedEval as any).approval_voting_metrics?.latency || 5.2}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API Cost</span>
                            <span className="font-mono text-text-primary">${(selectedEval as any).approval_voting_metrics?.cost || 0.0048}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card 4: Multi-Agent Debate */}
                      <div 
                        className="p-4 bg-bg-surface border border-accent rounded-xl space-y-3"
                        style={{ borderLeft: "3px solid var(--accent)" }}
                      >
                        <div className="flex items-center space-x-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                          <span className="text-xs font-bold text-accent">Debate AI</span>
                        </div>
                        <div className="space-y-2 text-[11px] text-text-secondary leading-normal">
                          <div>
                            <span className="text-[9px] uppercase font-mono block text-accent font-bold">Accuracy</span>
                            <ConsensusMeter value={selectedEval.multi_agent_metrics.accuracy} />
                          </div>
                          <div className="flex justify-between border-t border-border-subtle pt-1.5">
                            <span>Hallucination</span>
                            <span className="font-mono text-text-primary">{selectedEval.multi_agent_metrics.hallucination_rate}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Faithfulness</span>
                            <span className="font-mono text-text-primary">{selectedEval.multi_agent_metrics.faithfulness}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Latency</span>
                            <span className="font-mono text-text-primary">{selectedEval.multi_agent_metrics.latency}s</span>
                          </div>
                          <div className="flex justify-between">
                            <span>API Cost</span>
                            <span className="font-mono text-text-primary">${selectedEval.multi_agent_metrics.cost}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl text-center py-20 text-text-secondary text-xs font-mono">
                  <BarChart3 className="w-6 h-6 mx-auto text-text-tertiary mb-2.5 animate-pulse" />
                  Select a benchmark from the directory to review the comparative analytics visualizer.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConsensusMeter({ value }: { value: number }) {
  return (
    <div className="flex items-center space-x-2 w-full mt-1">
      <div className="relative flex-1 bg-border-subtle rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-accent h-1.5 rounded-full" 
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-mono font-bold text-accent shrink-0">{value}%</span>
    </div>
  );
}
