"use client";

import { useState } from "react";
import type { IngestionResponse } from "@/lib/ingestion/service";

interface UploadSectionProps {
  onUploadSuccess?: () => void;
}

export function UploadSection({ onUploadSuccess }: UploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestionResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload file");
      }

      setResult(data as IngestionResponse);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full bg-[#131627] backdrop-blur-xl border border-[#232743] rounded-3xl px-10 py-8 md:px-12 md:py-10 shadow-2xl transition-all duration-300">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-inner">
          <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide">Upload Data</h2>
      </div>

      <form onSubmit={handleUpload} className="flex flex-col gap-8">
        <div className="relative group">
          <input
            type="file"
            id="file-upload"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
              file
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-[#2A3052] bg-[#171A2E] hover:border-indigo-400 hover:bg-[#1C203A]"
            }`}
          >
            <div className="flex flex-col items-center justify-center p-6 text-center">
              {file ? (
                <>
                  <svg className="w-10 h-10 text-indigo-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-base text-indigo-300 font-medium">{file.name}</p>
                  <p className="text-sm text-indigo-400/70 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </>
              ) : (
                <>
                  <svg className="w-10 h-10 text-slate-400 mb-3 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="mb-2 text-base text-slate-300">
                    <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-sm text-slate-500">CSV files only (MAX. 10MB)</p>
                </>
              )}
            </div>
          </label>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!file || isUploading}
          className={`relative w-full flex justify-center py-4 px-6 border border-transparent text-base font-semibold rounded-xl text-white shadow-lg transition-all duration-300 ${
            !file || isUploading
              ? "bg-slate-800 border-slate-700 cursor-not-allowed text-slate-400"
              : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 hover:shadow-indigo-500/25 active:scale-[0.98]"
          }`}
        >
          {isUploading ? (
            <span className="flex items-center gap-3">
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Pipeline...
            </span>
          ) : (
            "Ingest Data"
          )}
        </button>
      </form>

      {/* Results View */}
      {result && (
        <div className="w-full mt-6 animate-fade-in-up">
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="bg-emerald-900/30 px-5 py-3 border-b border-emerald-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-emerald-400 font-semibold text-sm">Ingestion Successful</h3>
              </div>
              <p className="text-emerald-400/60 text-xs font-mono">{result.upload.id.substring(0,8)}...</p>
            </div>
            
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Total Rows" value={result.summary.totalRows} />
              <StatCard label="Accepted" value={result.summary.acceptedRows} color="text-indigo-400" />
              <StatCard label="Inserted" value={result.summary.insertedRows} color="text-emerald-400" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color = "text-slate-200" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-[#0B0D17]/50 rounded-xl p-3 border border-[#232743]/60 flex flex-col justify-between">
      <span className="text-slate-500 text-[10px] font-medium uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}
