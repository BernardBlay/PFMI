"use client";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function OCRUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
    <main className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <div className="container mx-auto px-6 py-24 flex-1 max-w-2xl">
        <h1 className="text-3xl font-bold mb-4">OCR Maintenance Log Upload</h1>
        <p className="text-[var(--text-secondary)] mb-8">
          Upload scan/photo of any maintenance logs to ingest them into the system automatically using AI OCR.
        </p>

        <form onSubmit={handleUpload} className="p-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] mb-8">
          <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--border-hover)] transition-colors">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-input"
              accept="image/*,application/pdf"
            />
            <label htmlFor="file-input" className="cursor-pointer">
              <div className="text-4xl mb-2">📁</div>
              <span className="font-semibold block mb-1">
                {file ? file.name : "Click to select a file"}
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                Supports JPG, PNG, or PDF up to 10MB
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={!file || uploading}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            {uploading ? "Ingesting & Analyzing..." : "Upload & Analyze"}
          </button>
        </form>

        {result && (
          <div className="p-6 rounded-lg bg-[var(--bg-card)] border border-green-500/20">
            <h3 className="font-bold text-lg mb-4 text-green-400">OCR Analysis Result</h3>
            <pre className="text-xs font-mono bg-slate-950 p-4 rounded overflow-x-auto text-slate-300">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}
