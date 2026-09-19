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
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    <div className="w-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 md:px-8 py-5 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white">Monitoring Statistics</h2>
        </div>
        <svg 
          className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-6 md:p-8 border-t border-gray-800/50 animate-fade-in-up">
          {/* Top Level KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
            <div className="bg-gray-800/30 rounded-2xl p-5 border border-gray-700/50 flex flex-col justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Overall Availability</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold tracking-tight ${data.overallAvailabilityPercentage >= 99 ? 'text-emerald-400' : data.overallAvailabilityPercentage >= 95 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {data.overallAvailabilityPercentage}%
                </span>
              </div>
            </div>
            
            <div className="bg-gray-800/30 rounded-2xl p-5 border border-gray-700/50 flex flex-col justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Total Checks</span>
              <span className="text-3xl font-bold text-white tracking-tight">{data.totalHealthChecks.toLocaleString()}</span>
            </div>

            <div className="bg-gray-800/30 rounded-2xl p-5 border border-gray-700/50 flex flex-col justify-center">
              <span className="text-gray-400 text-sm font-medium mb-1 uppercase tracking-wider">Failed Checks</span>
              <span className={`text-3xl font-bold tracking-tight ${data.failedChecks > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {data.failedChecks.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm text-gray-400 mb-4 px-2">
            <p>Services: <span className="text-gray-200 font-semibold">{data.servicesMonitored}</span></p>
            <p>Period: <span className="text-gray-200 font-medium">{formatDate(data.monitoringStart)}</span> – <span className="text-gray-200 font-medium">{formatDate(data.monitoringEnd)}</span></p>
          </div>

          {/* Per-Service Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/60 text-gray-300 text-xs uppercase tracking-wider border-b border-gray-700">
                  <th className="px-6 py-4 font-semibold">Service</th>
                  <th className="px-6 py-4 font-semibold text-right">Checks</th>
                  <th className="px-6 py-4 font-semibold text-right">Failed</th>
                  <th className="px-6 py-4 font-semibold text-right">Availability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 bg-gray-900/20">
                {data.perServiceStats.map((service) => (
                  <tr key={service.serviceName} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-200">{service.serviceName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-gray-400 text-sm">
                      {service.totalChecks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm">
                      <span className={service.failedChecks > 0 ? 'text-red-400 bg-red-400/10 px-2 py-1 rounded-md' : 'text-gray-500'}>
                        {service.failedChecks.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className={`font-semibold ${
                        service.availabilityPercentage >= 99 ? 'text-emerald-400' : 
                        service.availabilityPercentage >= 95 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
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
