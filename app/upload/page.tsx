"use client";

import { useState } from "react";
import type { IngestionResponse } from "@/lib/ingestion/service";

export default function UploadPage() {
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
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500/30">
      <main className="max-w-4xl mx-auto px-6 py-20 flex flex-col items-center">
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4">
            Data Ingestion
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Upload your SLA monitoring CSV data for processing, validation, and persistent storage.
          </p>
        </div>

        <div className="w-full max-w-xl bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl transition-all duration-300 hover:border-gray-700/80">
          <form onSubmit={handleUpload} className="flex flex-col gap-6">
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
                    : "border-gray-700 bg-gray-800/30 group-hover:border-indigo-400 group-hover:bg-gray-800/60"
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {file ? (
                    <>
                      <svg
                        className="w-10 h-10 text-indigo-400 mb-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <p className="text-sm text-indigo-300 font-medium">{file.name}</p>
                      <p className="text-xs text-indigo-400/70 mt-1">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-10 h-10 text-gray-400 mb-3 group-hover:text-indigo-400 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        ></path>
                      </svg>
                      <p className="mb-2 text-sm text-gray-300">
                        <span className="font-semibold group-hover:text-indigo-300 transition-colors">
                          Click to upload
                        </span>{" "}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">CSV files only (MAX. 10MB)</p>
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
              className={`relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white shadow-lg transition-all duration-300 ${
                !file || isUploading
                  ? "bg-gray-800 cursor-not-allowed opacity-70"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 hover:shadow-indigo-500/25 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 active:scale-[0.98]"
              }`}
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
        </div>

        {/* Results View */}
        {result && (
          <div className="w-full max-w-xl mt-8 animate-fade-in-up">
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl">
              <div className="bg-emerald-900/30 px-6 py-4 border-b border-emerald-900/50 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <div>
                  <h3 className="text-emerald-400 font-semibold text-lg">Ingestion Successful</h3>
                  <p className="text-emerald-400/60 text-xs font-mono">{result.upload.id}</p>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Total Rows" value={result.summary.totalRows} />
                <StatCard label="Accepted" value={result.summary.acceptedRows} color="text-indigo-400" />
                <StatCard label="Inserted" value={result.summary.insertedRows} color="text-emerald-400" />
                <StatCard label="Already DB" value={result.summary.alreadyExistingRows} color="text-blue-400" />
                <StatCard label="Duplicates" value={result.summary.duplicateRows} color="text-orange-400" />
                <StatCard label="Rejected" value={result.summary.rejectedRows} color="text-red-400" />
              </div>

              {result.summary.rejectedRows > 0 && (
                <div className="px-6 pb-6 pt-2">
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-3">Rejection Reasons</h4>
                    <div className="space-y-2">
                      {Object.entries(result.summary.rejectionReasons).map(([reason, count]) => (
                        <div key={reason} className="flex items-center justify-between text-sm">
                          <span className="text-gray-300 font-mono text-xs">{reason}</span>
                          <span className="bg-red-500/10 text-red-400 px-2.5 py-0.5 rounded-full text-xs border border-red-500/20 font-semibold">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value, color = "text-gray-200" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-900/40 rounded-2xl p-4 border border-gray-800/60 flex flex-col justify-between">
      <span className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-2">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}
