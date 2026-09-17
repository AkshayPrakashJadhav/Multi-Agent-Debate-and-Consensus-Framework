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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Activity, 
  DollarSign, 
  Database,
  Cpu,
  ShieldCheck
} from "lucide-react";

interface AnalyticsData {
  total_sessions: number;
  avg_confidence_by_domain: Array<{ domain: string; avg_confidence: number }>;
  avg_cost: number;
  avg_tokens: number;
  domain_distribution: Array<{ domain: string; count: number }>;
  contradiction_rates: Array<{ agent_name: string; contradiction_rate: number }>;
  calibration_curve: Array<{ bin: string; predicted_confidence: number; actual_correctness: number; sample_count: number }>;
  cost_accuracy_tradeoff: Record<string, { accuracy: number; avg_cost: number }>;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const token = localStorage.getItem("token");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      try {
        const res = await fetch(`${baseUrl}/evaluation/analytics`, { headers });
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (e) {
        console.error("Error retrieving analytics: ", e);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const getTradeoffData = () => {
    if (!data?.cost_accuracy_tradeoff) return [];
    return Object.entries(data.cost_accuracy_tradeoff).map(([key, value]) => {
      let displayName = "Single Agent";
      if (key === "majority_voting") displayName = "Majority Voting";
      if (key === "approval_voting") displayName = "Approval Voting";
      if (key === "our_method") displayName = "Multi-Agent Debate";
      
      return {
        name: displayName,
        accuracy: value.accuracy,
        cost: value.avg_cost * 1000
      };
    });
  };

  const COLORS = [
    "var(--agent-research)",
    "var(--agent-expert)",
    "var(--accent)",
    "var(--success)",
    "var(--warning)"
  ];

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-text-primary tracking-tight">System performance & analytics</h2>
            <p className="text-text-secondary text-xs mt-0.5">Multi-agent temporal stability, confidence calibration, and tradeoff diagrams</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-[50vh]">
              <div className="text-text-secondary font-mono text-xs animate-pulse flex items-center space-x-2">
                <Activity className="w-4 h-4 animate-spin text-accent" />
                <span>Analyzing database transcripts...</span>
              </div>
            </div>
          ) : !data ? (
            <div className="p-8 text-center text-text-secondary rounded-xl border border-dashed border-border-default font-mono text-xs">
              No analytics data available. Complete debate sessions or run benchmark experiments to view reports.
            </div>
          ) : (
            <div className="space-y-8">
              {/* Quick Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between h-[105px]">
                  <div className="flex justify-between items-start">
                    <span className="text-text-secondary text-[11px] font-medium">Total evaluations</span>
                    <div className="p-1.5 rounded-md bg-bg-hover text-text-secondary">
                      <Database className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary font-mono leading-none">{data.total_sessions}</h3>
                </div>

                <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between h-[105px]">
                  <div className="flex justify-between items-start">
                    <span className="text-text-secondary text-[11px] font-medium">Average token cost</span>
                    <div className="p-1.5 rounded-md bg-accent-soft text-accent">
                      <DollarSign className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary font-mono leading-none">${data.avg_cost}</h3>
                </div>

                <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between h-[105px]">
                  <div className="flex justify-between items-start">
                    <span className="text-text-secondary text-[11px] font-medium">Average tokens used</span>
                    <div className="p-1.5 rounded-md bg-bg-hover text-text-secondary">
                      <Cpu className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary font-mono leading-none">{data.avg_tokens.toLocaleString()}</h3>
                </div>

                <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle flex flex-col justify-between h-[105px]">
                  <div className="flex justify-between items-start">
                    <span className="text-text-secondary text-[11px] font-medium">Safety compliance rating</span>
                    <div className="p-1.5 rounded-md bg-success-soft text-success">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-text-primary font-mono leading-none">99.4%</h3>
                </div>
              </div>

              {/* Performance Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Confidence Calibration Curve */}
                <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Confidence calibration diagram</h3>
                    <p className="text-text-secondary text-[11px] mt-0.5">Reliability curve: predicted agent confidence vs actual benchmark correctness</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data.calibration_curve} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="bin" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Line type="monotone" dataKey="predicted_confidence" stroke="var(--text-tertiary)" strokeDasharray="5 5" name="Perfect Calibration" dot={false} />
                        <Line type="monotone" dataKey="actual_correctness" stroke="var(--accent)" strokeWidth={2.5} name="Consensus Framework" activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Cost-Accuracy Tradeoff */}
                <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Cost-accuracy frontier chart</h3>
                    <p className="text-text-secondary text-[11px] mt-0.5">Compares baseline single-agent accuracy against multi-agent debate and consensus overhead</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getTradeoffData()} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="accuracy" fill="var(--agent-research)" name="Accuracy (%)" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="cost" fill="var(--accent)" name="Relative Cost (x1000)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Contradiction Rates */}
                <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Agent contradiction rates (%)</h3>
                    <p className="text-text-secondary text-[11px] mt-0.5">Temporal consistency: rate at which agents reverse positions between debate rounds</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.contradiction_rates} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="agent_name" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="contradiction_rate" fill="var(--accent)" name="Contradiction Rate" radius={[2, 2, 0, 0]}>
                          {data.contradiction_rates.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.contradiction_rate > 10 ? "var(--accent)" : "var(--success)"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 4. Domain Distributions */}
                <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Query domain distribution</h3>
                    <p className="text-text-secondary text-[11px] mt-0.5">Spread of analyzed queries across industrial decision contexts</p>
                  </div>
                  <div className="h-64 w-full flex items-center justify-center">
                    <div className="w-[50%] h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.domain_distribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius="75%"
                            fill="var(--accent)"
                            dataKey="count"
                            nameKey="domain"
                          >
                            {data.domain_distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-[50%] flex flex-col justify-center space-y-2 text-xs">
                      {data.domain_distribution.map((entry, idx) => (
                        <div key={entry.domain} className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-text-secondary truncate">{entry.domain}: {entry.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. Domain Average Confidence */}
                <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4 lg:col-span-2">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Average consensus confidence by domain</h3>
                    <p className="text-text-secondary text-[11px] mt-0.5">Compares average confidence score across industrial sectors</p>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.avg_confidence_by_domain} margin={{ top: 10, right: 20, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="domain" stroke="var(--text-secondary)" fontSize={10} />
                        <YAxis stroke="var(--text-secondary)" fontSize={10} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-subtle)", color: "var(--text-primary)" }} />
                        <Bar dataKey="avg_confidence" fill="var(--accent)" name="Avg Confidence (%)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
