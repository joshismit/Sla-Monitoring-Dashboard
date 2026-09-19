"use client";

import { useEffect, useState } from "react";

interface PerServiceStat {
  serviceName: string;
  totalChecks: number;
  availableChecks: number;
  failedChecks: number;
  availabilityPercentage: number;
}

interface StatsData {
  totalHealthChecks: number;
  availableChecks: number;
  failedChecks: number;
  overallAvailabilityPercentage: number;
  servicesMonitored: number;
  monitoringStart: string | null;
  monitoringEnd: string | null;
  perServiceStats: PerServiceStat[];
}

interface StatsSectionProps {
  refreshTrigger: number;
}

export function StatsSection({ refreshTrigger }: StatsSectionProps) {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stats");
        if (!res.ok) throw new Error("Failed to fetch statistics");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [refreshTrigger]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

  if (isLoading && !data) {
    return (
      <div className="w-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl flex justify-center items-center h-48 animate-pulse">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 text-sm font-medium">Loading statistics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-red-400 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-center">
          <p className="font-semibold mb-1">Error loading statistics</p>
          <p className="text-sm opacity-80">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.totalHealthChecks === 0) {
    return (
      <div className="w-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl flex flex-col justify-center items-center h-48">
        <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
        </svg>
        <p className="text-gray-400 font-medium">No monitoring data available</p>
        <p className="text-gray-500 text-sm mt-1">Upload a CSV to populate statistics.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#131627] backdrop-blur-xl border border-[#232743] rounded-3xl shadow-2xl transition-all duration-300">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-10 md:px-12 py-7 flex items-center justify-between hover:bg-[#1A1E36] transition-colors rounded-t-3xl"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shadow-inner">
            <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Monitoring Statistics</h2>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-10 md:px-12 py-8 md:py-10 border-t border-[#232743] animate-fade-in-up">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10">
            <div className="bg-[#0B0D17]/50 rounded-2xl p-6 border border-[#232743]/60 flex flex-col justify-center">
              <span className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Overall Availability</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-extrabold tracking-tight ${data.overallAvailabilityPercentage >= 99 ? 'text-emerald-400' : data.overallAvailabilityPercentage >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.overallAvailabilityPercentage}%
                </span>
              </div>
            </div>
            
            <div className="bg-[#0B0D17]/50 rounded-2xl p-6 border border-[#232743]/60 flex flex-col justify-center">
              <span className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Total Checks</span>
              <span className="text-4xl font-bold text-white tracking-tight">{data.totalHealthChecks.toLocaleString()}</span>
            </div>

            <div className="bg-[#0B0D17]/50 rounded-2xl p-6 border border-[#232743]/60 flex flex-col justify-center">
              <span className="text-slate-400 text-sm font-medium mb-2 uppercase tracking-wider">Failed Checks</span>
              <span className={`text-4xl font-bold tracking-tight ${data.failedChecks > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.failedChecks.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-slate-400 mb-4 px-2">
            <p>Services: <span className="text-slate-200 font-semibold">{data.servicesMonitored}</span></p>
            <p>Period: <span className="text-slate-200 font-medium">{formatDate(data.monitoringStart)}</span> – <span className="text-slate-200 font-medium">{formatDate(data.monitoringEnd)}</span></p>
          </div>

          {/* Per-Service Table */}
          <div className="overflow-x-auto rounded-xl border border-[#232743]">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-[#0B0D17]/80 text-slate-300 text-xs uppercase tracking-wider border-b border-[#232743]">
                  <th className="px-6 py-5 font-semibold">Service</th>
                  <th className="px-6 py-5 font-semibold text-right">Checks</th>
                  <th className="px-6 py-5 font-semibold text-right">Failed</th>
                  <th className="px-6 py-5 font-semibold text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232743]/60 bg-[#131627]">
                {data.perServiceStats.map((service) => (
                  <tr key={service.serviceName} className="hover:bg-[#1A1E36] transition-colors">
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="font-medium text-slate-200">{service.serviceName}</div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right font-mono text-slate-400 text-sm">
                      {service.totalChecks.toLocaleString()}
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right font-mono text-sm">
                      <span className={service.failedChecks > 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {service.failedChecks.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap text-right font-mono font-semibold">
                      <span className={service.availabilityPercentage >= 99 ? 'text-emerald-400' : service.availabilityPercentage >= 95 ? 'text-yellow-400' : 'text-red-400'}>
                        {service.availabilityPercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
