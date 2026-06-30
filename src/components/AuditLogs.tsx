/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, Filter, ArrowRight, ShieldCheck, Trash2, CheckCircle2, AlertOctagon, HelpCircle } from 'lucide-react';
import { AuditLog } from '../types';
import { DriftBadge } from './DriftScore';

interface AuditLogsProps {
  logs: AuditLog[];
  onApprove: (id: string) => void;
  onDrop: (id: string) => void;
  onBlock?: (id: string) => void;
}

export default function AuditLogs({ logs, onApprove, onDrop, onBlock }: AuditLogsProps) {
  const [filter, setFilter] = useState<'ALL' | 'VERIFIED' | 'BLOCKED' | 'PENDING'>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.status === filter;
  });

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-sm shadow-xl flex flex-col h-full" id="panel-audit-logs">
      {/* Table Header Controls */}
      <div className="flex flex-col gap-3 border-b border-zinc-900 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2">
          <Database className="h-4 w-4 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
            Audit Logs
          </h2>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto">
          <Filter className="h-3 w-3 text-zinc-500 hidden sm:inline" />
          <div className="flex bg-black rounded-lg border border-zinc-800 p-0.5">
            {(['ALL', 'VERIFIED', 'BLOCKED', 'PENDING'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider rounded transition-all uppercase ${
                  filter === tab
                    ? 'bg-zinc-800 text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
                id={`btn-filter-logs-${tab.toLowerCase()}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="mt-4 flex-grow overflow-x-auto min-h-[220px]">
        {filteredLogs.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center font-mono text-xs text-zinc-600 border border-dashed border-zinc-900 rounded-lg p-6">
            <span>No logged interactions recorded.</span>
            <span className="text-[10px] text-zinc-700 mt-1">Initiate a simulation sequence on the left.</span>
          </div>
        ) : (
          <table className="w-full text-left border-collapse" id="audit-logs-table">
            <thead>
              <tr className="border-b border-zinc-900 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3 hidden md:table-cell">Drift</th>
                <th className="py-2.5 px-3 text-right">Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 font-mono text-xs text-zinc-400">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-900/40 transition-colors group"
                  id={`log-row-${log.id}`}
                >
                  {/* Timestamp */}
                  <td className="py-3 px-3 text-[11px] text-zinc-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span className="flex items-center space-x-1.5">
                      <span className={`h-2 w-2 rounded-full ${
                        log.status === 'VERIFIED'
                          ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                          : log.status === 'BLOCKED'
                          ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                          : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'
                      }`} />
                      <span className={`text-[10px] font-bold ${
                        log.status === 'VERIFIED'
                          ? 'text-emerald-400'
                          : log.status === 'BLOCKED'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}>
                        {log.status}
                      </span>
                    </span>
                  </td>

                  {/* Action description */}
                  <td className="py-3 px-3 max-w-sm">
                    <div className="flex flex-col">
                      <span className="text-zinc-300 font-medium group-hover:text-white transition-colors">
                        {log.action}
                      </span>
                      {log.arguments && Object.keys(log.arguments).length > 0 && (
                        <span className="text-[10px] text-zinc-600 font-mono">
                          args: {JSON.stringify(log.arguments)}
                        </span>
                      )}
                      {log.reason && (log.status === 'BLOCKED' || log.status === 'PENDING') && (
                        <span className={`text-[10px] font-mono mt-0.5 font-semibold ${log.status === 'BLOCKED' ? 'text-rose-500/80' : 'text-amber-500/80'}`}>
                          Reason: {log.reason}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Drift Score badge */}
                  <td className="py-3 px-3 hidden md:table-cell whitespace-nowrap">
                    {log.drift_score !== undefined ? (
                      <DriftBadge score={log.drift_score} />
                    ) : (
                      <span className="font-mono text-[10px] text-zinc-700">—</span>
                    )}
                  </td>

                  {/* Action / Control buttons (matching the design image) */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      {log.status === 'BLOCKED' || log.status === 'PENDING' ? (
                        <>
                          <button
                            onClick={() => onApprove(log.id)}
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-emerald-400 hover:bg-emerald-950/20 hover:border-emerald-500/30 transition-all cursor-pointer"
                            title="Approve Exception / Mark as verified"
                            id={`btn-approve-log-${log.id}`}
                          >
                            Approve Exception
                          </button>
                          {log.status === 'PENDING' && onBlock && (
                            <button
                              onClick={() => onBlock(log.id)}
                              className="px-2 py-1 rounded bg-rose-950/25 border border-rose-900/40 text-[10px] font-bold text-rose-400 hover:bg-rose-900/30 hover:border-rose-500 transition-all cursor-pointer"
                              title="Execute Block / Mark as blocked"
                              id={`btn-block-log-${log.id}`}
                            >
                              Execute Block
                            </button>
                          )}
                          <button
                            onClick={() => onDrop(log.id)}
                            className="px-2 py-1 rounded bg-rose-950/25 border border-rose-900/40 text-[10px] font-bold text-rose-400 hover:bg-rose-900/30 hover:border-rose-500 transition-all cursor-pointer"
                            title="Hard Drop / Delete from logs"
                            id={`btn-drop-log-${log.id}`}
                          >
                            Hard Drop
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-zinc-600 px-2 select-none group-hover:text-zinc-400 transition-colors">
                          Details
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
