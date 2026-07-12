"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { UploadCloud, FileText, Loader2, CheckCircle2, Cpu, Lock } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

export default function OCRUpload() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [dragActive, setDragActive] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.push("/login");
      } else {
        setIsChecking(false);
      }
    };
    
    // Small delay to ensure localStorage is ready
    setTimeout(checkAuth, 100);
  }, [router]);

  // Show nothing while checking auth
  if (isChecking) {
    return (
      <main className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </main>
    );
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/maintenance-logs", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-background text-foreground relative overflow-hidden">
      {/* Orbs */}
      <div
        className="hero-orb"
        style={{
          width: 400, height: 400,
          background: "radial-gradient(circle, #059669 0%, transparent 70%)",
          top: "-10%", right: "-10%",
        }}
      />

      <Navbar />
      
      <div className="container mx-auto px-6 py-24 flex-1 max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <span className="text-[10px] font-bold font-mono text-emerald-600 dark:text-emerald-500 uppercase tracking-widest block mb-2">
            AI Document Extraction
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground font-sans">
            OCR Maintenance Log Upload
          </h1>
          <p className="text-xs text-text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Upload scan or photo of any maintenance log sheets to automatically ingest, digitize, and sync records into the database.
          </p>
        </div>

        <form onSubmit={handleUpload} className="bg-surface border border-border-mute p-6 sm:p-8 rounded-2xl shadow-xl backdrop-blur-md mb-8">
          {/* Dropzone Container */}
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`workspace-dropzone relative overflow-hidden flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-350 ${
              dragActive 
                ? "border-emerald-500 bg-emerald-500/5 scale-[0.99]" 
                : "border-border-mute hover:border-zinc-400 dark:hover:border-zinc-700 bg-background/50"
            }`}
          >
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              id="file-input"
              accept="image/*,application/pdf"
            />
            
            <div className="p-3 rounded-full bg-surface border border-border-mute shadow-xs mb-4 text-text-muted">
              {file ? (
                <FileText className="h-6 w-6 text-emerald-500 animate-pulse" />
              ) : (
                <UploadCloud className="h-6 w-6" />
              )}
            </div>

            <span className="font-bold text-xs text-foreground block mb-1">
              {file ? file.name : "Select or drag file here"}
            </span>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-wide">
              Supports JPG, PNG, or PDF up to 10MB
            </span>
          </div>

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full mt-6 bg-foreground text-background font-bold py-2.5 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ingesting &amp; Parsing Parameters...
              </>
            ) : (
              "Upload &amp; Extract Data"
            )}
          </button>
        </form>

        {result && (
          <div className="bg-surface border border-border-mute p-6 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border-mute pb-3 mb-4">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
              <div>
                <h3 className="font-bold text-xs text-foreground">Extraction Complete</h3>
                <p className="text-[9px] font-mono text-text-muted leading-none mt-0.5 uppercase tracking-wide">Parsed database payload</p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute top-2 right-3 flex items-center gap-1.5 pointer-events-none">
                <Cpu className="h-3 w-3 text-text-muted animate-pulse" />
                <span className="text-[8px] font-mono text-text-muted uppercase">Structured Node Output</span>
              </div>
              <pre className="text-[10px] font-mono bg-zinc-950 p-4 rounded-xl overflow-x-auto text-zinc-300 border border-zinc-800">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </main>
  );
}
