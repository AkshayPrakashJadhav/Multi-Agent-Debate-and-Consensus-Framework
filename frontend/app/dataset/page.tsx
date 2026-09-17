"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { 
  Database, 
  Play, 
  Layers, 
  Cpu, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from "recharts";

interface Experiment {
  id: string;
  name: string;
  query_count: number;
  status: string;
  created_at: string;
  metrics: {
    single_agent: { avg_accuracy: number; avg_cost: number; avg_latency: number };
    majority_voting: { avg_accuracy: number; avg_cost: number; avg_latency: number };
    approval_voting: { avg_accuracy: number; avg_cost: number; avg_latency: number };
    our_method: { avg_accuracy: number; avg_cost: number; avg_latency: number };
  };
}

export default function DatasetExplorer() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [selectedExp, setSelectedExp] = useState<Experiment | null>(null);

  const [experimentName, setExperimentName] = useState("");
  const [queryCount, setQueryCount] = useState(10);
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const fetchData = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/dataset/experiments`, { headers });
      if (res.ok) {
        const data = await res.json();
        setExperiments(data);
        if (data.length > 0 && !selectedExp) {
          setSelectedExp(data[0]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRunExperiment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!experimentName.trim()) return;

    setRunning(true);
    setFeedback({ message: "", type: "" });
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/dataset/evaluate-batch`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: experimentName, limit: queryCount })
      });

      if (res.ok) {
        const data = await res.json();
        setExperiments(prev => [data, ...prev]);
        setSelectedExp(data);
        setExperimentName("");
        setFeedback({ message: `Successfully executed batch benchmark experiment "${data.name}"!`, type: "success" });
      } else {
        throw new Error("Failed to run batch evaluation.");
      }
    } catch (err: any) {
      setFeedback({ message: err.message || "An error occurred.", type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const getAccuracyChartData = (exp: Experiment) => {
    return [
      { name: "Single Agent", accuracy: exp.metrics.single_agent.avg_accuracy },
      { name: "Majority Voting", accuracy: exp.metrics.majority_voting.avg_accuracy },
      { name: "Approval Voting", accuracy: exp.metrics.approval_voting.avg_accuracy },
      { name: "Multi-Agent Debate", accuracy: exp.metrics.our_method.avg_accuracy }
    ];
  };

  const getCostLatencyData = (exp: Experiment) => {
    return [
      { name: "Single Agent", cost: exp.metrics.single_agent.avg_cost * 1000, latency: exp.metrics.single_agent.avg_latency },
      { name: "Majority Voting", cost: exp.metrics.majority_voting.avg_cost * 1000, latency: exp.metrics.majority_voting.avg_latency },
      { name: "Approval Voting", cost: exp.metrics.approval_voting.avg_cost * 1000, latency: exp.metrics.approval_voting.avg_latency },
      { name: "Multi-Agent Debate", cost: exp.metrics.our_method.avg_cost * 1000, latency: exp.metrics.our_method.avg_latency }
    ];
  };

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-border-subtle">
            <div>
              <h2 className="text-xl font-semibold text-text-primary tracking-tight flex items-center gap-2">
                <Database className="text-accent w-5 h-5" />
                <span>Dataset & research benchmark</span>
              </h2>
              <p className="text-text-secondary text-xs mt-0.5">
                Batch evaluation of consensus and voting mechanisms over dataset benchmarks
              </p>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchData();
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary font-semibold rounded-lg text-xs transition-colors cursor-pointer self-start"
            >
              <span>Refresh directory</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left controller panel */}
            <div className="lg:col-span-1 space-y-6">
              {/* Form */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <div className="flex items-center space-x-2 pb-2 border-b border-border-subtle">
                  <Play className="w-4 h-4 text-accent" />
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Run batch experiment</h3>
                </div>

                {feedback.message && (
                  <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                    feedback.type === "success" 
                      ? "bg-success-soft border-success/20 text-success" 
                      : "bg-danger-soft border-danger/20 text-danger"
                  }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{feedback.message}</span>
                  </div>
                )}

                <form onSubmit={handleRunExperiment} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Experiment name</label>
                    <input
                      type="text"
                      placeholder="e.g. Llama-3-70b-debate-run"
                      value={experimentName}
                      onChange={(e) => setExperimentName(e.target.value)}
                      className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Query batch size</label>
                    <select
                      value={queryCount}
                      onChange={(e) => setQueryCount(parseInt(e.target.value))}
                      className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="5">5 Queries</option>
                      <option value="10">10 Queries</option>
                      <option value="20">20 Queries</option>
                      <option value="50">50 Queries</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={running || !experimentName.trim()}
                    className="w-full py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>{running ? "Running batch runs..." : "Launch batch evaluation"}</span>
                  </button>
                </form>
              </div>

              {/* Experiment History */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono pb-2 border-b border-border-subtle">Experiment directory</h3>
                {loading ? (
                  <div className="py-6 text-center text-text-secondary text-xs font-mono animate-pulse">Retrieving experiments...</div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {experiments.map((exp) => (
                      <button
                        key={exp.id}
                        onClick={() => setSelectedExp(exp)}
                        className={`w-full p-3 rounded-lg text-left border text-xs transition-all flex flex-col space-y-1 bg-transparent cursor-pointer ${
                          selectedExp?.id === exp.id
                            ? "border-accent bg-accent-soft/40"
                            : "border-border-subtle hover:bg-bg-hover"
                        }`}
                      >
                        <span className="font-semibold text-text-primary truncate w-full">{exp.name}</span>
                        <div className="flex justify-between items-center w-full mt-1">
                          <span className="px-1.5 py-0.2 bg-bg-hover border border-border-subtle rounded text-[9px] font-mono text-text-secondary">
                            {exp.query_count} Qs
                          </span>
                          <span className="text-[9px] text-text-tertiary font-mono">
                            {new Date(exp.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right main analysis panel */}
            <div className="lg:col-span-2 space-y-6">
              <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider font-mono">Research benchmark details</h3>
                  <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">
                    The framework imports complete trace histories of specialized LLM agents (Research, Expert, Critic) engaging in multi-turn discussions. This allows us to compare how agreement methods (majority consensus, approval voting, and Arbiter AI) resolve conflicts and arrive at decisions.
                  </p>
                </div>

                {/* Flow Diagram */}
                <div className="p-5 bg-bg-app border border-border-subtle rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono flex items-center gap-2">
                    <Layers className="w-4 h-4 text-accent" />
                    <span>Dataset integration & evaluation pipeline</span>
                  </h4>
                  
                  <div className="relative flex flex-col space-y-4 md:space-y-0 md:flex-row items-center justify-between p-4 bg-bg-surface rounded-xl border border-border-subtle">
                    {/* Box 1 */}
                    <div className="flex flex-col items-center text-center p-2.5 w-36 rounded-lg bg-bg-app border border-border-subtle shrink-0">
                      <Database className="w-4 h-4 text-text-secondary mb-1 shrink-0" />
                      <span className="text-[11px] font-bold text-text-primary">DEBATE Dataset</span>
                      <span className="text-[9px] text-text-secondary">100 Benchmark Qs</span>
                    </div>

                    <div className="text-text-tertiary font-bold text-sm rotate-90 md:rotate-0">→</div>

                    {/* Box 2 */}
                    <div className="flex flex-col items-center text-center p-2.5 w-36 rounded-lg bg-bg-app border border-border-subtle shrink-0">
                      <Layers className="w-4 h-4 text-text-secondary mb-1 shrink-0" />
                      <span className="text-[11px] font-bold text-text-primary">Preprocessing</span>
                      <span className="text-[9px] text-text-secondary">Clean & Split</span>
                    </div>

                    <div className="text-text-tertiary font-bold text-sm rotate-90 md:rotate-0">→</div>

                    {/* Box 3 */}
                    <div className="flex flex-col items-center text-center p-2.5 w-36 rounded-lg bg-accent-soft border border-accent shrink-0">
                      <Cpu className="w-4 h-4 text-accent mb-1 shrink-0" />
                      <span className="text-[11px] font-bold text-accent">Debate System</span>
                      <span className="text-[9px] text-text-secondary">Agents + Arbiter</span>
                    </div>

                    <div className="text-text-tertiary font-bold text-sm rotate-90 md:rotate-0">→</div>

                    {/* Box 4 */}
                    <div className="flex flex-col items-center text-center p-2.5 w-36 rounded-lg bg-bg-app border border-border-subtle shrink-0">
                      <TrendingUp className="w-4 h-4 text-success mb-1 shrink-0" />
                      <span className="text-[11px] font-bold text-text-primary">Metrics Suite</span>
                      <span className="text-[9px] text-text-secondary">Accuracy & Cost</span>
                    </div>
                  </div>
                </div>

                {/* Selected Experiment metrics visualizer */}
                {selectedExp ? (
                  <div className="space-y-6 pt-4 border-t border-border-subtle">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-soft text-accent">
                        Experiment: {selectedExp.name}
                      </span>
                      <p className="text-text-secondary text-[11px] mt-2 font-mono">
                        Executed: {new Date(selectedExp.created_at).toLocaleString()} | Batch count: {selectedExp.query_count} queries
                      </p>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Accuracy Chart */}
                      <div className="p-4 bg-bg-app border border-border-subtle rounded-xl space-y-4">
                        <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">Average Accuracy comparison (%)</h4>
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={getAccuracyChartData(selectedExp)} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={9} />
                              <YAxis stroke="var(--text-secondary)" fontSize={9} domain={[0, 100]} />
                              <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                              <Bar dataKey="accuracy" fill="var(--accent)" name="Accuracy (%)" radius={[2, 2, 0, 0]} />
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Cost / Latency Chart */}
                      <div className="p-4 bg-bg-app border border-border-subtle rounded-xl space-y-4">
                        <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-wider font-mono">System overhead benchmarks</h4>
                        <div className="h-56 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={getCostLatencyData(selectedExp)} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                              <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={9} />
                              <YAxis stroke="var(--text-secondary)" fontSize={9} />
                              <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                              <Legend wrapperStyle={{ fontSize: 9 }} />
                              <Bar dataKey="latency" fill="var(--agent-research)" name="Latency (s)" radius={[2, 2, 0, 0]} />
                              <Bar dataKey="cost" fill="var(--accent)" name="Cost ($x1000)" radius={[2, 2, 0, 0]} />
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-text-secondary text-xs font-mono">
                    Select an experiment run from the directory to load batch statistics.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
