"use client";

import { useState } from "react";
import { UploadSection } from "@/components/dashboard/UploadSection";
import { StatsSection } from "@/components/dashboard/StatsSection";
import { LogsSection } from "@/components/dashboard/LogsSection";

export default function DashboardPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans selection:bg-indigo-500/30">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col items-center gap-12">
        {/* Header */}
        <div className="text-center animate-fade-in-up w-full">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-6 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
            <svg
              className="w-8 h-8 text-indigo-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 mb-4">
            SLA Monitoring Dashboard
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A comprehensive overview of service health, availability, and detailed logs.
          </p>
        </div>

        {/* Upload Section */}
        <div className="w-full max-w-3xl animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <UploadSection onUploadSuccess={handleUploadSuccess} />
        </div>

        {/* Stats Section */}
        <div className="w-full animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <StatsSection refreshTrigger={refreshTrigger} />
        </div>

        {/* Logs Section */}
        <div className="w-full animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <LogsSection refreshTrigger={refreshTrigger} />
        </div>
      </main>
    </div>
  );
}
