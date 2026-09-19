"use client";

import { useEffect, useState, useCallback } from "react";

interface HealthCheckLog {
  id: string;
  timestampUtc: string;
  serviceName: string;
  statusCode: number;
  latencyMs: number | null;
  agent: string;
  region: string;
  isAvailable: boolean;
}

interface LogsPagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface LogsResponse {
  data: HealthCheckLog[];
  pagination: LogsPagination;
}

interface LogsSectionProps {
  refreshTrigger: number;
}

const COMMON_SERVICES = [
  "auth-api",
  "notify-worker",
  "payments-api",
  "reports-api",
  "search-api",
];

const COMMON_STATUSES = [200, 201, 400, 401, 403, 404, 500, 502, 503, 504];

export function LogsSection({ refreshTrigger }: LogsSectionProps) {
  const [data, setData] = useState<HealthCheckLog[]>([]);
  const [pagination, setPagination] = useState<LogsPagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [availability, setAvailability] = useState("");

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", "20"); // hardcode page size to 20 for UI
      if (startDate) params.append("startDate", new Date(startDate).toISOString());
      if (endDate) params.append("endDate", new Date(endDate).toISOString());
      if (service) params.append("service", service);
      if (status) params.append("status", status);
      if (availability) params.append("availability", availability);

      const res = await fetch(`/api/logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      
      const json: LogsResponse = await res.json();
      setData(json.data);
      setPagination(json.pagination);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, startDate, endDate, service, status, availability, refreshTrigger]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, service, status, availability]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", { 
      month: "short", 
      day: "numeric", 
      hour: "2-digit", 
      minute: "2-digit",
      second: "2-digit"
    });
  };

  return (
    <div className="w-full bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-3xl overflow-hidden shadow-2xl transition-all duration-300">
      <div className="px-6 md:px-8 py-5 flex items-center gap-3 border-b border-gray-800/50">
        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white">System Logs</h2>
      </div>

      <div className="p-6 md:p-8">
        {/* Filters */}
        <div className="bg-gray-800/20 rounded-2xl p-4 border border-gray-800/50 mb-6 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">From Date</label>
            <input 
              type="datetime-local" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">To Date</label>
            <input 
              type="datetime-local" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Service</label>
            <select 
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition-colors appearance-none"
            >
              <option value="">All Services</option>
              {COMMON_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[100px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</label>
            <select 
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition-colors appearance-none"
            >
              <option value="">All</option>
              {COMMON_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Availability</label>
            <select 
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="bg-gray-900/50 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2.5 transition-colors appearance-none"
            >
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Failed</option>
            </select>
          </div>
          <div className="flex-none">
            <button 
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setService("");
                setStatus("");
                setAvailability("");
              }}
              className="p-2.5 text-sm font-medium text-gray-400 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 hover:text-white transition-colors"
              title="Clear Filters"
            >
              Clear
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-red-400 text-sm">
            Failed to load logs: {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-900/20">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-800/60 text-gray-300 text-xs uppercase tracking-wider border-b border-gray-700">
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Service</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Latency</th>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Region</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {isLoading && data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <span>Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    No logs found matching your filters.
                  </td>
                </tr>
              ) : (
                data.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-800/40 transition-colors text-sm">
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">
                      {formatDate(log.timestampUtc)}
                    </td>
                    <td className="px-4 py-3 text-gray-200 font-medium">
                      {log.serviceName}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        log.statusCode >= 200 && log.statusCode < 300 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        log.statusCode >= 400 && log.statusCode < 500 ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                        log.statusCode >= 500 ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-gray-800 text-gray-300'
                      }`}>
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 font-mono">
                      {log.latencyMs ? `${log.latencyMs}ms` : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[150px]" title={log.agent}>
                      {log.agent}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {log.region}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Showing <span className="font-semibold text-gray-200">{(pagination.page - 1) * pagination.pageSize + 1}</span> to <span className="font-semibold text-gray-200">{Math.min(pagination.page * pagination.pageSize, pagination.total)}</span> of <span className="font-semibold text-gray-200">{pagination.total.toLocaleString()}</span> entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
                className="px-4 py-2 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                ← Previous
              </button>
              <div className="px-4 py-2 border border-gray-700 bg-gray-900/50 text-gray-300 rounded-lg text-sm font-medium">
                Page {page} of {pagination.totalPages}
              </div>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages || isLoading}
                className="px-4 py-2 border border-gray-700 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
