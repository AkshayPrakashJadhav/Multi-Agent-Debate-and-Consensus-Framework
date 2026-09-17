"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { motion } from "framer-motion";
import { 
  Upload, 
  Trash2, 
  FileText, 
  Database, 
  GraduationCap, 
  HeartPulse, 
  TrendingUp, 
  Scale, 
  Cpu,
  Search,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

interface DocumentItem {
  id: string;
  filename: string;
  domain: string;
  created_at: string;
}

export default function DocumentHub() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDomain, setSelectedDomain] = useState("Technology");
  
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  const domains = [
    { name: "Healthcare", icon: HeartPulse, color: "text-danger bg-danger-soft border-transparent" },
    { name: "Finance", icon: TrendingUp, color: "text-success bg-success-soft border-transparent" },
    { name: "Legal", icon: Scale, color: "text-text-primary bg-bg-hover border-transparent" },
    { name: "Technology", icon: Cpu, color: "text-accent bg-accent-soft border-transparent" },
    { name: "Education", icon: GraduationCap, color: "text-warning bg-warning-soft border-transparent" }
  ];

  const fetchDocuments = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/rag/documents`, { headers });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.error("Failed to load documents", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFeedback({ message: "Please select a file to upload first.", type: "error" });
      return;
    }

    setUploading(true);
    setFeedback({ message: "", type: "" });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("domain", selectedDomain);

    try {
      const res = await fetch(`${baseUrl}/rag/upload`, {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "File upload failed.");
      }

      setFeedback({ message: `Successfully uploaded and indexed ${selectedFile.name}!`, type: "success" });
      setSelectedFile(null);
      const fileInput = document.getElementById("file-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      
      fetchDocuments();
    } catch (e: any) {
      setFeedback({ message: e.message || "An error occurred during file parsing.", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this document from the vector store?")) return;
    
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const token = localStorage.getItem("token");
    const headers: HeadersInit = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${baseUrl}/rag/documents/${id}`, {
        method: "DELETE",
        headers
      });

      if (res.ok) {
        setDocuments(documents.filter(d => d.id !== id));
      } else {
        alert("Failed to delete document.");
      }
    } catch {
      alert("Error occurred deleting document.");
    }
  };

  const filteredDocs = documents.filter(d => 
    d.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-bg-app text-text-primary font-sans antialiased">
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto space-y-8">
          {/* Header */}
          <div>
            <h2 className="text-xl font-semibold text-text-primary tracking-tight">RAG Document Hub</h2>
            <p className="text-text-secondary text-xs mt-0.5">Upload files to construct pluggable domain knowledge bases.</p>
          </div>

          {/* Domain grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {domains.map((dom) => {
              const Icon = dom.icon;
              const count = documents.filter(d => d.domain.toLowerCase() === dom.name.toLowerCase()).length;
              return (
                <div 
                  key={dom.name} 
                  className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${dom.color}`}
                >
                  <Icon className="w-5 h-5 mb-2" />
                  <span className="text-xs font-bold text-text-primary">{dom.name}</span>
                  <span className="text-[10px] text-text-secondary font-mono mt-1">{count} Docs Indexed</span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload panel */}
            <div className="lg:col-span-1">
              <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle sticky top-8 space-y-4">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono pb-2 border-b border-border-subtle">Ingest Document</h3>
                
                {feedback.message && (
                  <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
                    feedback.type === "success" 
                      ? "bg-success-soft border-success/20 text-success" 
                      : "bg-danger-soft border-danger/20 text-danger"
                  }`}>
                    {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">Target Knowledge Domain</label>
                    <select
                      value={selectedDomain}
                      onChange={(e) => setSelectedDomain(e.target.value)}
                      className="w-full bg-bg-app border border-border-default rounded-lg py-2.5 px-3 text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="Healthcare">Healthcare</option>
                      <option value="Finance">Finance</option>
                      <option value="Legal">Legal</option>
                      <option value="Technology">Technology</option>
                      <option value="Education">Education</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider font-mono">File Attachment (PDF, TXT)</label>
                    <div className="border border-dashed border-border-default rounded-lg p-6 bg-bg-app flex flex-col items-center justify-center text-center hover:border-accent/40 transition-colors relative">
                      <input
                        type="file"
                        id="file-input"
                        accept=".pdf,.txt"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="w-6 h-6 text-text-tertiary mb-2" />
                      <span className="text-xs text-text-primary font-semibold">
                        {selectedFile ? selectedFile.name : "Choose PDF or Text File"}
                      </span>
                      <span className="text-[10px] text-text-tertiary mt-1">Maximum size 10MB</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading}
                    className="w-full py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {uploading ? "Ingesting & chunking..." : "Process document"}
                  </button>
                </form>

                <div className="h-[1px] bg-border-subtle" />
                <div className="text-[11px] text-text-secondary space-y-2 leading-normal">
                  <div className="flex items-center space-x-2">
                    <Database className="w-3.5 h-3.5 text-accent" />
                    <span className="font-semibold text-text-primary">FAISS Dense Indexing</span>
                  </div>
                  <p>
                    Documents are split into recursive overlapping chunks and mapped into a high-dimensional vector index. This enables our debate agents to validate claims using context citations.
                  </p>
                </div>
              </div>
            </div>

            {/* Documents list panel */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-6 rounded-xl bg-bg-surface border border-border-subtle">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Active Knowledge Base</h3>
                    <p className="text-text-secondary text-xs mt-0.5">Documents serving RAG vector context</p>
                  </div>
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-text-tertiary absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search sources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-bg-app border border-border-default rounded-lg py-1.5 pl-9 pr-4 text-xs text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent w-40"
                    />
                  </div>
                </div>

                {loading ? (
                  <div className="py-12 text-center text-text-secondary text-xs font-mono animate-pulse">Retrieving indexed directory...</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="py-16 text-center text-text-secondary text-xs border border-dashed border-border-default rounded-xl font-mono">
                    <FileText className="w-6 h-6 mx-auto text-text-tertiary mb-2" />
                    <p className="font-semibold">No documents indexed matching query</p>
                    <p className="text-text-tertiary mt-1">Upload a PDF or TXT file to compile the context library.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredDocs.map((doc, idx) => (
                      <motion.div
                        key={doc.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.02 }}
                        className="p-4 rounded-xl bg-bg-app border border-border-subtle hover:border-border-default transition-colors flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <div className="p-2 bg-bg-surface rounded-lg text-accent border border-border-subtle shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <h4 className="text-xs font-semibold text-text-primary truncate pr-4">{doc.filename}</h4>
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-bg-hover text-text-secondary">
                              {doc.domain}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4 shrink-0">
                          <span className="text-[10px] font-mono text-text-secondary">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-1 text-text-secondary hover:text-accent hover:bg-bg-hover rounded transition-colors border-0 bg-transparent cursor-pointer"
                            title="Delete File"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
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
