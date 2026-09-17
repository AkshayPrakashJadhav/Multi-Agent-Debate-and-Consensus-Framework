"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { 
  FileText, 
  ChevronRight, 
  FileDown, 
  ThumbsUp, 
  ThumbsDown, 
  AlertTriangle
} from "lucide-react";

interface Round {
  id: string;
  round_number: number;
  agent_name: string;
  response: string;
  critique: string | null;
  confidence: number;
  evidence: Array<{ source: string; chunk_index: number; citation_text: string }> | null;
  weaknesses: string | null;
}

interface DebateSession {
  id: string;
  query: string;
  domain: string;
  consensus_answer: string | null;
  confidence_score: number | null;
  cost: number;
  tokens_used: number;
  debate_length_rounds: number;
  agent_influence: Record<string, number> | null;
  rating: string | null;
  feedback_comment: string | null;
  rounds: Round[];
}

export default function DebateBoard() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen bg-bg-app text-text-primary font-sans items-center justify-center">
        <div className="text-text-secondary font-mono text-xs animate-pulse">Loading debate board...</div>
      </div>
    }>
      <DebateBoardContent />
    </Suspense>
  );
}

function DebateBoardContent() {
  const searchParams = useSearchParams();
  const sessionIdParam = searchParams.get("id");

  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("Technology");
  
  const [session, setSession] = useState<DebateSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState("");
  const [activeTimelineStep, setActiveTimelineStep] = useState<string>("Planner");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Feedback states
  const [feedbackRating, setFeedbackRating] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const fetchSessionDetails = async (id: string) => {
    setLoading(true);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/debate/sessions/${id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        
        if (data.rating) {
          setFeedbackRating(data.rating);
          setFeedbackComment(data.feedback_comment || "");
        } else {
          setFeedbackRating(null);
          setFeedbackComment("");
        }

        const steps = getStepsForSession(data);
        if (steps.length > 0) {
          setActiveTimelineStep(steps[steps.length - 1]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionIdParam) {
      fetchSessionDetails(sessionIdParam);
    }
  }, [sessionIdParam]);


  const activeTimelineSteps = getStepsForSession(session);

  const handleStartDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    setSession(null);
    setStreamingStatus("Deconstructing query parameters...");
    setActiveTimelineStep("Planner");
    setFeedbackRating(null);
    setFeedbackComment("");

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/debate/sessions?stream=true`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query, domain })
      });

      if (!res.ok || !res.body) {
        let detail = "";
        try {
          const errData = await res.json();
          detail = errData.detail || errData.message;
        } catch {
          detail = res.statusText;
        }
        throw new Error(detail || `Debate server returned HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.substring(6));
              
              if (event.type === "error") {
                throw new Error(event.message || "An error occurred during agent orchestration.");
              }
              else if (event.type === "session_created") {
                setSession(event.session);
                setStreamingStatus("Retrieving context from vectors...");
              } 
              else if (event.type === "planner_completed") {
                setStreamingStatus("Planner initialized subtasks. Generating initial analyses...");
                setSession(prev => {
                  if (!prev) return null;
                  return { ...prev, rounds: [...prev.rounds, event.round] };
                });
                setActiveTimelineStep("Planner");
              } 
              else if (event.type === "agent_completed") {
                setStreamingStatus(`${event.agent_name} generated response for Round ${event.round_number}.`);
                setSession(prev => {
                  if (!prev) return null;
                  const filtered = prev.rounds.filter(r => r.id !== event.round.id);
                  const updated = { ...prev, rounds: [...filtered, event.round] };
                  setActiveTimelineStep(`Round ${event.round_number}`);
                  return updated;
                });
              } 
              else if (event.type === "round_completed") {
                setStreamingStatus(`Round ${event.round_number} complete.`);
              } 
              else if (event.type === "devils_advocate_completed") {
                setStreamingStatus("Consensus converged. Engaging Devil's Advocate...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Devil's Advocate");
                  return updated;
                });
              } 
              else if (event.type === "arbiter_completed") {
                setStreamingStatus("Consensus answers compiled. Arbiter synthesizing...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Arbiter");
                  return updated;
                });
              } 
              else if (event.type === "compliance_completed") {
                setStreamingStatus("Synthesized answer generated. Auditing regulatory compliance...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Compliance");
                  return updated;
                });
              } 
              else if (event.type === "explainability_completed") {
                setStreamingStatus("Generating plain-language executive summary...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Plain Summary");
                  return updated;
                });
              } 
              else if (event.type === "consistency_completed") {
                setStreamingStatus("Cross-referencing historical decisions...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Consistency");
                  return updated;
                });
              } 
              else if (event.type === "bias_completed") {
                setStreamingStatus("Auditing agent framing for cognitive biases...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Bias Audit");
                  return updated;
                });
              } 
              else if (event.type === "verifier_completed") {
                setStreamingStatus("Comparing claims with vector source documentation...");
                setSession(prev => {
                  if (!prev) return null;
                  const updated = { ...prev, rounds: [...prev.rounds, event.round] };
                  setActiveTimelineStep("Verifier");
                  return updated;
                });
              } 
              else if (event.type === "session_complete") {
                setStreamingStatus("");
                setSession(event.session);
              }
            } catch (err: any) {
              if (err.message && !err.message.includes("JSON")) {
                throw err;
              }
              console.error("Error parsing streaming line:", err);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Debate simulation error:", err);
      const isNetworkError = 
        err?.message?.includes("fetch") || 
        err?.name === "TypeError" || 
        err?.message?.includes("NetworkError") ||
        err?.message?.includes("Failed to fetch");

      const message = isNetworkError
        ? `Cannot connect to backend service at ${baseUrl}. Please ensure the backend server is running (e.g. run "python run.py" on port 8000).`
        : (err?.message || "An error occurred during debate simulation.");

      setErrorMessage(message);
      setStreamingStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !feedbackRating) return;

    setSubmittingFeedback(true);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/debate/sessions/${session.id}/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment })
      });
      if (res.ok) {
        const updatedSess = await res.json();
        setSession(updatedSess);
      }
    } catch {
      alert("Failed to submit feedback.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const downloadPdf = async () => {
    if (!session) return;
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/debate/sessions/${session.id}/pdf`, { headers });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `consensus_report_${session.id.slice(0, 8)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
      alert("Failed to export report.");
    }
  };

  const getAgentColor = (name: string) => {
    if (name.includes("Planner")) return "var(--agent-planner)";
    if (name.includes("Research")) return "var(--agent-research)";
    if (name.includes("Domain") || name.includes("Expert")) return "var(--agent-expert)";
    if (name.includes("Risk")) return "var(--agent-risk)";
    if (name.includes("Reviewer") || name.includes("Critical") || name.includes("Critic")) return "var(--agent-critic)";
    if (name.includes("Devil")) return "var(--agent-devil)";
    if (name.includes("Arbiter")) return "var(--agent-arbiter)";
    if (name.includes("Compliance")) return "var(--agent-critic)";
    if (name.includes("Explainability")) return "var(--agent-research)";
    if (name.includes("Consistency")) return "var(--agent-expert)";
    if (name.includes("Bias")) return "var(--agent-risk)";
    if (name.includes("Verifier") || name.includes("Verification")) return "var(--agent-verifier)";
    return "var(--text-secondary)";
  };


  const renderTimelineDetail = () => {
    if (!session) return null;

    if (activeTimelineStep === "Planner") {
      const plannerRound = session.rounds.find(r => r.agent_name === "Planner");
      if (!plannerRound) return <p className="text-xs text-text-secondary font-mono">Decompressing query constraints...</p>;
      const parsed = JSON.parse(plannerRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Planner")}` }}
        >
          <div className="flex items-center space-x-2 pb-2 border-b border-border-subtle">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Planner") }} />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Planner - Query decomposition</h4>
          </div>
          <div className="space-y-4">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block mb-2 font-mono">Assigned subtasks</span>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-text-primary">
                {parsed.subtasks?.map((t: string, idx: number) => (
                  <li key={idx} className="flex items-center space-x-2.5 p-2 rounded-lg bg-bg-app border border-border-subtle">
                    <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block mb-2 font-mono">Core focus areas</span>
              <div className="flex flex-wrap gap-2">
                {parsed.focus_areas?.map((fa: string, idx: number) => (
                  <span key={idx} className="px-2.5 py-1 bg-accent-soft border border-transparent text-accent rounded-md text-xs font-semibold font-mono">
                    {fa}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep.startsWith("Round ")) {
      const rNum = parseInt(activeTimelineStep.split(" ")[1]);
      const roundRounds = session.rounds.filter(r => r.round_number === rNum && !["Verifier", "Planner", "Arbiter", "Compliance Agent", "Explainability Agent", "Historical Consistency Agent", "Bias Detection Agent", "Devil's Advocate"].includes(r.agent_name));
      
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {roundRounds.map((agent) => (
            <div 
              key={agent.id} 
              className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-3"
              style={{ borderLeft: `3px solid ${getAgentColor(agent.agent_name)}` }}
            >
              <div className="flex justify-between items-center pb-2 border-b border-border-subtle">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor(agent.agent_name) }} />
                  <span className="text-xs font-semibold text-text-primary">{agent.agent_name}</span>
                </div>
                <span className="text-xs font-semibold text-accent font-mono">{agent.confidence}% confidence</span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                {agent.response}
              </p>
              {agent.critique && (
                <div className="p-3 bg-accent-soft rounded-lg border border-transparent text-xs">
                  <span className="font-semibold text-accent block mb-1 font-mono uppercase text-[9px]">Peer critique reflection:</span>
                  <span className="text-text-primary italic">"{agent.critique}"</span>
                </div>
              )}
              {agent.weaknesses && (
                <div className="p-3 bg-bg-hover rounded-lg border border-transparent text-xs">
                  <span className="font-semibold text-text-secondary block mb-1 font-mono uppercase text-[9px]">Self-assessed weaknesses:</span>
                  <span className="text-text-primary italic">{agent.weaknesses}</span>
                </div>
              )}
              {agent.evidence && (agent.evidence as any).length > 0 && (
                <div className="pt-2">
                  <span className="text-[9px] text-text-secondary font-bold block mb-1.5 uppercase font-mono">Supporting sources</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(agent.evidence as any).map((ev: any, evIdx: number) => (
                      <span key={evIdx} className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-bg-app border border-border-subtle text-[10px] font-mono text-text-secondary">
                        <FileText className="w-3 h-3 text-text-tertiary shrink-0" />
                        <span className="truncate max-w-[150px]">{typeof ev === 'string' ? ev : ev.source}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </motion.div>
      );
    }

    if (activeTimelineStep === "Devil's Advocate") {
      const daRound = session.rounds.find(r => r.agent_name === "Devil's Advocate");
      if (!daRound) return null;
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Devil's Advocate")}` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Devil's Advocate") }} />
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Devil's Advocate Agent (Consensus challenge)</h4>
            </div>
            <span className="px-2 py-0.5 bg-accent-soft text-accent rounded text-[10px] font-mono font-bold">
              Opposing strength: {daRound.confidence}%
            </span>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Strongest Counter-argument stance</span>
              <p className="text-sm text-text-primary leading-relaxed bg-bg-app p-3 rounded-lg border border-border-subtle whitespace-pre-line">
                {daRound.response}
              </p>
            </div>
            {daRound.critique && (
              <div className="p-3.5 rounded-lg bg-accent-soft border border-transparent space-y-1">
                <span className="text-[10px] text-accent font-bold uppercase tracking-wider font-mono block">Unresolved risk identified</span>
                <p className="text-xs text-text-primary italic">
                  "{daRound.critique}"
                </p>
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Arbiter") {
      const arbiterRound = session.rounds.find(r => r.agent_name === "Arbiter");
      if (!arbiterRound) return null;
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Arbiter")}` }}
        >
          <div className="flex justify-between items-start pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Arbiter") }} />
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Arbiter final synthesis</h3>
            </div>
            <div className="text-right">
              <span className="block text-[9px] text-text-secondary uppercase font-mono font-bold">Consensus confidence</span>
              <span className="text-sm font-bold text-accent font-mono">{arbiterRound.confidence}%</span>
            </div>
          </div>
          <div className="space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Synthesized decision</span>
              <p className="text-sm text-text-primary leading-relaxed bg-bg-app p-4 rounded-lg border border-border-subtle whitespace-pre-line">
                {arbiterRound.response}
              </p>
            </div>
            {arbiterRound.critique && (
              <div className="space-y-1">
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Synthesis rationale</span>
                <p className="text-xs text-text-secondary italic bg-bg-hover/40 p-3 rounded-lg border border-border-subtle">
                  "{arbiterRound.critique}"
                </p>
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Compliance") {
      const compRound = session.rounds.find(r => r.agent_name === "Compliance Agent");
      if (!compRound) return null;
      const data = JSON.parse(compRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Compliance Agent")}` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Compliance Agent") }} />
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Ethics & regulatory compliance audit</h4>
            </div>
            <span className={data.severity === "High" ? "badge-danger" : "badge-warning"}>
              Severity: {data.severity}
            </span>
          </div>
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block mb-2">Compliance flags detected</span>
              {data.complianceFlags?.length === 0 ? (
                <p className="text-text-secondary italic p-3 rounded-lg bg-bg-app border border-border-subtle">No regulatory mismatches identified.</p>
              ) : (
                <ul className="space-y-2">
                  {data.complianceFlags?.map((f: string, idx: number) => (
                    <li key={idx} className="p-2.5 rounded-lg bg-bg-app border border-border-subtle text-text-primary flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Mitigation recommendations</span>
              <p className="text-xs text-text-secondary bg-bg-app p-3 rounded-lg border border-border-subtle leading-relaxed">
                {data.recommendation}
              </p>
            </div>
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Plain Summary") {
      const expRound = session.rounds.find(r => r.agent_name === "Explainability Agent");
      if (!expRound) return null;
      const data = JSON.parse(expRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Explainability Agent")}` }}
        >
          <div className="flex items-center space-x-2 pb-2 border-b border-border-subtle">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Explainability Agent") }} />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Plain-language summarizer</h4>
          </div>
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Executive summary (Non-expert view)</span>
              <p className="text-sm text-text-primary bg-bg-app p-4 rounded-lg border border-border-subtle">
                {data.plainSummary}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-[10px] text-success font-bold uppercase tracking-wider font-mono block">Core rationale (Top 3)</span>
                <ul className="space-y-1.5">
                  {data.keyReasons?.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start space-x-2 text-text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] text-danger font-bold uppercase tracking-wider font-mono block">Identified vulnerabilities (Top 2)</span>
                <ul className="space-y-1.5">
                  {data.keyRisks?.map((r: string, idx: number) => (
                    <li key={idx} className="flex items-start space-x-2 text-text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Consistency") {
      const constRound = session.rounds.find(r => r.agent_name === "Historical Consistency Agent");
      if (!constRound) return null;
      const data = JSON.parse(constRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Historical Consistency Agent")}` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Historical Consistency Agent") }} />
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Temporal stance consistency check</h4>
            </div>
            <span className={data.contradictionDetected ? "badge-danger animate-pulse" : "badge-warning"}>
              {data.contradictionDetected ? "Contradiction detected" : "Consistent with history"}
            </span>
          </div>
          <div className="space-y-4 text-xs leading-relaxed">
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Consistency analysis</span>
              <p className="text-xs text-text-primary bg-bg-app p-3 rounded-lg border border-border-subtle">
                {data.explanation}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block mb-2">Queried historical matches</span>
              {data.similarPastSessions?.length === 0 ? (
                <p className="text-text-secondary italic p-3 rounded-lg bg-bg-app border border-border-subtle">No prior matching queries in same domain.</p>
              ) : (
                <div className="space-y-2">
                  {data.similarPastSessions?.map((s: any, idx: number) => (
                    <div key={idx} className="p-3 bg-bg-app border border-border-subtle rounded-lg">
                      <span className="text-[10px] text-text-secondary block font-semibold mb-1 truncate">Prior query: "{s.query}"</span>
                      <span className="text-xs text-text-primary line-clamp-2">Answer stance: {s.consensus_answer}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Bias Audit") {
      const biasRound = session.rounds.find(r => r.agent_name === "Bias Detection Agent");
      if (!biasRound) return null;
      const data = JSON.parse(biasRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Bias Detection Agent")}` }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Bias Detection Agent") }} />
              <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Cognitive & stakeholder bias audit</h4>
            </div>
            <span className={data.severity === "High" ? "badge-danger" : "badge-warning"}>
              Bias severity: {data.severity}
            </span>
          </div>
          <div className="space-y-4 text-xs leading-relaxed">
            <div>
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block mb-2">Detected framing / stakeholder biases</span>
              {data.detectedBiases?.length === 0 ? (
                <p className="text-text-secondary italic p-3 rounded-lg bg-bg-app border border-border-subtle">No significant biases flagged.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {data.detectedBiases?.map((b: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-accent-soft border border-transparent text-accent text-[10px] font-mono">
                      {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider font-mono block">Mitigation & balance analysis</span>
              <p className="text-xs text-text-primary bg-bg-app p-3 rounded-lg border border-border-subtle">
                {data.explanation}
              </p>
            </div>
          </div>
        </motion.div>
      );
    }

    if (activeTimelineStep === "Verifier") {
      const verifierRound = session.rounds.find(r => r.agent_name === "Verifier");
      if (!verifierRound) return null;
      const data = JSON.parse(verifierRound.response);
      return (
        <motion.div 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.2 }}
          className="p-5 bg-bg-surface border border-border-subtle rounded-xl space-y-4"
          style={{ borderLeft: `3px solid ${getAgentColor("Verifier")}` }}
        >
          <div className="flex items-center space-x-2 pb-2 border-b border-border-subtle">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getAgentColor("Verifier") }} />
            <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Source document claim verifier</h4>
          </div>
          <div className="space-y-4 text-xs leading-relaxed">
            <div>
              <span className="text-[10px] text-success font-bold block mb-2 uppercase tracking-wide font-mono">Verified claims (Direct context alignment)</span>
              <ul className="space-y-2">
                {data.supported_claims?.map((c: string, idx: number) => (
                  <li key={idx} className="p-3 rounded-lg bg-bg-app border border-border-subtle text-text-primary flex items-start space-x-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            {data.unsupported_claims?.length > 0 && (
              <div>
                <span className="text-[10px] text-danger font-bold block mb-2 uppercase tracking-wide font-mono">Unsupported assertions / missing citations</span>
                <ul className="space-y-2">
                  {data.unsupported_claims.map((c: string, idx: number) => (
                    <li key={idx} className="p-3 rounded-lg bg-bg-app border border-border-subtle text-text-primary flex items-start space-x-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[720px] mx-auto space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-text-primary tracking-tight">Agent debate board</h2>
              <p className="text-text-secondary text-xs mt-0.5">witness real-time multi-agent structured debate streams</p>
            </div>
            {session && (
              <button
                onClick={downloadPdf}
                className="flex items-center space-x-2 px-3 py-1.5 bg-bg-surface border border-border-default hover:bg-bg-hover text-text-primary font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-accent" />
                <span>Export analysis PDF</span>
              </button>
            )}
          </div>

          {/* Input box */}
          {!sessionIdParam && (
            <form onSubmit={handleStartDebate} className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-4 shadow-none">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1">
                  <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Ask your query</label>
                  <textarea
                    placeholder="e.g. Should we migrate our electronic healthcare records system to a decentralized blockchain ledger?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent min-h-[70px] resize-none"
                    required
                  />
                </div>

                <div className="w-full sm:w-52 space-y-1">
                  <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Knowledge domain</label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-sm text-text-primary focus:outline-none focus:border-accent h-[70px]"
                  >
                    <option value="Healthcare">Healthcare</option>
                    <option value="Finance">Finance</option>
                    <option value="Legal">Legal</option>
                    <option value="Technology">Technology</option>
                    <option value="Education">Education</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors flex items-center space-x-2 cursor-pointer"
                >
                  <span>{loading ? "Engaging debate agents..." : "Trigger debate pipeline"}</span>
                </button>
              </div>
            </form>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-danger/10 border border-danger/30 flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-semibold text-danger">Debate Orchestration Failed</h5>
                  <p className="text-text-primary mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-text-secondary hover:text-text-primary p-1 rounded transition-colors cursor-pointer"
                title="Dismiss"
              >
                ✕
              </button>
            </motion.div>
          )}

          {/* Live Loading Pulse */}
          {loading && streamingStatus && (
            <div className="p-5 rounded-xl bg-bg-surface border border-border-subtle text-center py-8">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent animate-pulse mr-2.5" />
              <span className="text-text-primary font-semibold text-xs uppercase tracking-wider font-mono">Orchestrating debate stream</span>
              <p className="text-text-secondary text-xs mt-1.5 max-w-md mx-auto italic">
                "{streamingStatus}"
              </p>
            </div>
          )}

          {session && (
            <div className="space-y-8">
              {/* Stepper Timeline Navigation */}
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-xl relative">
                <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block mb-4">Debate process timeline</span>
                
                {/* Horizontal pill list connected by a line */}
                <div className="relative w-full py-2">
                  <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-border-default -translate-y-1/2 z-0" />
                  <div className="relative flex justify-between items-center z-10 overflow-x-auto min-w-max pb-1 gap-2">
                    {activeTimelineSteps.map((step) => {
                      const isSelected = activeTimelineStep === step;
                      const currentIndex = activeTimelineSteps.indexOf(activeTimelineStep);
                      const stepIndex = activeTimelineSteps.indexOf(step);
                      const isCompleted = stepIndex < currentIndex;

                      return (
                        <button
                          key={step}
                          onClick={() => setActiveTimelineStep(step)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold font-mono transition-all cursor-pointer border ${
                            isSelected
                              ? "bg-accent-soft text-accent border-accent"
                              : isCompleted
                              ? "bg-bg-surface text-text-secondary border-border-default hover:text-text-primary hover:border-text-secondary"
                              : "bg-bg-surface text-text-tertiary border-border-subtle hover:text-text-secondary"
                          }`}
                        >
                          {step}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Dynamic Stepper Display Content */}
              {renderTimelineDetail()}

              {/* Arbiter Consensus Answer Summary Card */}
              <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <div className="pb-3 border-b border-border-subtle flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent-soft text-accent border border-transparent">
                        Consensus output
                      </span>
                      <h3 className="text-sm font-bold text-text-primary mt-3 uppercase tracking-wider font-mono">Executive answer synthesis</h3>
                    </div>
                  </div>
                  {session.confidence_score && (
                    <div className="pt-2">
                      <ConsensusBar value={session.confidence_score} />
                    </div>
                  )}
                </div>

                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
                  {session.consensus_answer || "Synthesizing consensus..."}
                </p>
              </div>

              {/* Dynamic Agent Attribution Progress Bars */}
              {session.agent_influence && (
                <div className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                  <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Debate contribution share</span>
                  <div className="space-y-3">
                    {Object.entries(session.agent_influence).map(([agentName, val]) => (
                      <div key={agentName} className="space-y-1.5">
                        <div className="flex justify-between text-[11px] text-text-secondary">
                          <span className="font-medium">{agentName}</span>
                          <span className="font-mono font-bold text-accent">{val}%</span>
                        </div>
                        <div className="w-full bg-bg-app rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-accent h-1.5 rounded-full transition-all duration-700" 
                            style={{ width: `${val}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Human Feedback Widget */}
              <form onSubmit={handleFeedbackSubmit} className="p-6 bg-bg-surface border border-border-subtle rounded-xl space-y-4">
                <span className="text-[10px] text-text-secondary uppercase font-mono font-bold block">Human feedback loop</span>
                <div className="flex space-x-3 justify-center">
                  <button
                    type="button"
                    onClick={() => !session.rating && setFeedbackRating("thumbs_up")}
                    disabled={!!session.rating}
                    className={`p-2.5 rounded-lg border flex items-center justify-center space-x-2 w-1/2 cursor-pointer transition-all text-xs font-semibold ${
                      feedbackRating === "thumbs_up"
                        ? "bg-accent-soft border-accent text-accent"
                        : "border-border-default text-text-secondary hover:border-border-default hover:text-text-primary bg-bg-app"
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Upvote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => !session.rating && setFeedbackRating("thumbs_down")}
                    disabled={!!session.rating}
                    className={`p-2.5 rounded-lg border flex items-center justify-center space-x-2 w-1/2 cursor-pointer transition-all text-xs font-semibold ${
                      feedbackRating === "thumbs_down"
                        ? "bg-danger-soft border-danger text-danger"
                        : "border-border-default text-text-secondary hover:border-border-default hover:text-text-primary bg-bg-app"
                    }`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>Downvote</span>
                  </button>
                </div>
                
                {!session.rating ? (
                  <div className="space-y-3">
                    <textarea
                      placeholder="Comment on the quality of consensus synthesis..."
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      className="w-full bg-bg-app border border-border-default rounded-lg p-2.5 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent min-h-[55px] resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingFeedback || !feedbackRating}
                      className="w-full py-2 bg-accent hover:bg-accent-hover text-white font-bold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {submittingFeedback ? "Submitting..." : "Submit feedback"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-text-secondary space-y-2">
                    {session.feedback_comment && (
                      <p className="italic bg-bg-app p-2.5 rounded-lg border border-border-subtle">"{session.feedback_comment}"</p>
                    )}
                    <p className="text-success font-semibold font-mono text-xs">✔ Feedback recorded</p>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ConsensusBar({ value }: { value: number }) {
  return (
    <div className="flex items-center space-x-3 w-full">
      <span className="text-[11px] text-text-secondary font-mono tracking-wider font-semibold shrink-0">Consensus</span>
      <div className="relative flex-1 bg-border-subtle rounded-full h-1.5 overflow-hidden">
        <div 
          className="bg-accent h-1.5 rounded-full transition-all duration-500" 
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs font-mono font-bold text-accent shrink-0">{value}%</span>
    </div>
  );
}

function getStepsForSession(sess: DebateSession | null) {
  if (!sess) return ["Planner"];
  const steps: string[] = ["Planner"];
  
  const debateRounds = Array.from(
    new Set(
      sess.rounds
        .filter(r => r.round_number > 0 && !["Arbiter", "Verifier", "Compliance Agent", "Explainability Agent", "Historical Consistency Agent", "Bias Detection Agent", "Devil's Advocate"].includes(r.agent_name))
        .map(r => r.round_number)
    )
  ).sort((a, b) => a - b);

  debateRounds.forEach(rNum => steps.push(`Round ${rNum}`));

  if (sess.rounds.some(r => r.agent_name === "Devil's Advocate")) {
    steps.push("Devil's Advocate");
  }
  if (sess.rounds.some(r => r.agent_name === "Arbiter")) {
    steps.push("Arbiter");
  }
  if (sess.rounds.some(r => r.agent_name === "Compliance Agent")) {
    steps.push("Compliance");
  }
  if (sess.rounds.some(r => r.agent_name === "Explainability Agent")) {
    steps.push("Plain Summary");
  }
  if (sess.rounds.some(r => r.agent_name === "Historical Consistency Agent")) {
    steps.push("Consistency");
  }
  if (sess.rounds.some(r => r.agent_name === "Bias Detection Agent")) {
    steps.push("Bias Audit");
  }
  if (sess.rounds.some(r => r.agent_name === "Verifier")) {
    steps.push("Verifier");
  }

  return steps;
}
