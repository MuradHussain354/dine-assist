"use client";

import React, { useState, useMemo } from "react";
import AdminNav from "@/components/admin/admin-nav";
import {
  DateRange,
  AnalyticsChatLog,
  calculateChatKPIs,
  filterAndPaginateLogs,
  getDateTimeParts,
} from "@/lib/analytics";

interface Props {
  initialLogs: AnalyticsChatLog[];
}

export default function LogsClient({ initialLogs }: Props) {
  // Filter state
  const [search, setSearch] = useState("");
  const [fallbackFilter, setFallbackFilter] = useState<"all" | "yes" | "no">("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [page, setPage] = useState(1);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Overall or filtered KPIs
  const kpis = useMemo(() => {
    return calculateChatKPIs(initialLogs);
  }, [initialLogs]);

  // Paginated logs
  const { logs, total, totalPages, page: currentPage } = useMemo(() => {
    return filterAndPaginateLogs(initialLogs, {
      search,
      fallback: fallbackFilter,
      reason: reasonFilter,
      dateRange,
      page,
      pageSize: 25,
    });
  }, [initialLogs, search, fallbackFilter, reasonFilter, dateRange, page]);

  // Reset page to 1 when filters change
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleFallbackChange = (val: "all" | "yes" | "no") => {
    setFallbackFilter(val);
    setPage(1);
  };

  const handleReasonChange = (val: string) => {
    setReasonFilter(val);
    setPage(1);
  };

  const handleDateRangeChange = (val: DateRange) => {
    setDateRange(val);
    setPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const formatTime = (isoString: string | Date) => {
    const parts = getDateTimeParts(isoString);
    return `${parts.dateString} ${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
  };

  const formatJson = (jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <AdminNav />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="pb-2 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Chat Logs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspection, latency percentiles, and fallback diagnostic analysis for assistant queries.
          </p>
        </div>

        {/* 5 KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* 1. Total Chats */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Total Queries
            </span>
            <div className="text-2xl font-bold text-white mt-1">{kpis.totalChats}</div>
            <span className="text-[11px] text-slate-500 mt-1 block">All recorded sessions</span>
          </div>

          {/* 2. Fallback Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Fallback Rate
            </span>
            <div className={`text-2xl font-bold mt-1 ${kpis.fallbackRate > 20 ? "text-amber-400" : "text-emerald-400"}`}>
              {kpis.fallbackRate}%
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              {kpis.fallbackCount} rule-based fallbacks
            </span>
          </div>

          {/* 3. Average Latency */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Average Latency
            </span>
            <div className="text-2xl font-bold text-blue-400 mt-1">
              {kpis.avgLatencyMs} <span className="text-sm font-normal text-slate-400">ms</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Mean response time</span>
          </div>

          {/* 4. 95th Percentile Latency */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              P95 Latency
            </span>
            <div className={`text-2xl font-bold mt-1 ${kpis.p95LatencyMs > 5000 ? "text-amber-400" : "text-purple-400"}`}>
              {kpis.p95LatencyMs} <span className="text-sm font-normal text-slate-400">ms</span>
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">95% of calls within</span>
          </div>

          {/* 5. Fallback Reasons Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
              Fallback Reasons
            </span>
            <div className="mt-2 space-y-1 max-h-16 overflow-y-auto pr-1">
              {Object.keys(kpis.reasonsBreakdown).length === 0 ? (
                <span className="text-xs text-slate-500">None</span>
              ) : (
                Object.entries(kpis.reasonsBreakdown).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-300 font-mono truncate max-w-[100px]">{reason}</span>
                    <span className="text-amber-400 font-semibold">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Search Query / Table</label>
              <input
                type="text"
                placeholder="Search user query text..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Fallback Used Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Execution Mode</label>
              <select
                value={fallbackFilter}
                onChange={(e) => handleFallbackChange(e.target.value as "all" | "yes" | "no")}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Modes</option>
                <option value="yes">Fallback Only</option>
                <option value="no">Direct LLM Only</option>
              </select>
            </div>

            {/* Fallback Reason Filter */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fallback Reason</label>
              <select
                value={reasonFilter}
                onChange={(e) => handleReasonChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Reasons</option>
                <option value="timeout">Timeout</option>
                <option value="invalid_json">Invalid JSON</option>
                <option value="schema_validation">Schema Validation</option>
                <option value="provider_error">Provider Error</option>
              </select>
            </div>

            {/* Date Range Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Date Range</label>
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { id: "today", label: "Today" },
                    { id: "7days", label: "7d" },
                    { id: "30days", label: "30d" },
                    { id: "all", label: "All" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleDateRangeChange(item.id)}
                    className={`py-1.5 text-xs font-medium rounded-lg transition-colors text-center ${
                      dateRange === item.id
                        ? "bg-amber-500 text-slate-950 font-bold"
                        : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Table</th>
                  <th className="py-3 px-4 min-w-[200px]">User Query</th>
                  <th className="py-3 px-4">Mode / Reason</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-4 text-center">Extracted Intent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      No chat logs match the current filters.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;

                    return (
                      <React.Fragment key={log.id}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                          {/* Timestamp */}
                          <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {formatTime(log.createdAt)}
                          </td>

                          {/* Table */}
                          <td className="py-3 px-4 font-medium text-slate-200 whitespace-nowrap">
                            {log.tableName || (log.tableNumber ? `Table ${log.tableNumber}` : "—")}
                          </td>

                          {/* User Query */}
                          <td className="py-3 px-4 text-white font-normal break-words">
                            &ldquo;{log.userQuery}&rdquo;
                          </td>

                          {/* Fallback Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {log.usedFallback ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <span>Fallback</span>
                                {log.fallbackReason && (
                                  <span className="text-amber-300 font-mono text-[10px]">
                                    ({log.fallbackReason})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Direct LLM
                              </span>
                            )}
                          </td>

                          {/* Latency */}
                          <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                            <span
                              className={
                                log.latencyMs > 5000
                                  ? "text-rose-400 font-semibold"
                                  : log.latencyMs > 2000
                                  ? "text-amber-400"
                                  : "text-slate-300"
                              }
                            >
                              {log.latencyMs} ms
                            </span>
                          </td>

                          {/* Expand Extracted JSON */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition"
                            >
                              {isExpanded ? "Hide JSON" : "View JSON"}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable JSON details row */}
                        {isExpanded && (
                          <tr className="bg-slate-950/80 border-b border-slate-800">
                            <td colSpan={6} className="p-4">
                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 max-w-3xl">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                                  <span>Structured Intent JSON (Validated Schema)</span>
                                  <span className="font-mono text-slate-500">{log.id}</span>
                                </div>
                                <pre className="font-mono text-emerald-400 text-xs overflow-x-auto p-2 bg-slate-950 rounded border border-slate-800/80">
                                  {formatJson(log.extractedJson)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {total > 0 && (
            <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing <span className="font-medium text-white">{logs.length > 0 ? (currentPage - 1) * 25 + 1 : 0}</span> to{" "}
                <span className="font-medium text-white">
                  {Math.min(currentPage * 25, total)}
                </span>{" "}
                of <span className="font-medium text-white">{total}</span> entries
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <span className="text-xs font-medium text-slate-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
