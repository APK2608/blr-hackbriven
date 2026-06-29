/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, CheckCircle2, XCircle, ChevronRight, Terminal } from 'lucide-react';
import { AuditLog } from '../types';

interface ExecutionTimelineProps {
  logs: AuditLog[];
}

export default function ExecutionTimeline({ logs }: ExecutionTimelineProps) {
  // We want to show a clean stream list of actions chronologically
  // If there are no logs, we show a nice waiting simulator state
  const timelineLogs = [...logs].reverse(); // reverse to put newest at the bottom or top?
  // Let's keep newest at top or bottom? The prompt has:
  // 09:01 Read Codebase ✓
  // 09:02 Modify Authentication Module ✓
  // 09:03 Run Tests ✓
  // 09:04 Deploy to Staging ✓
  // This looks like oldest at the top, newest at the bottom. Let's list chronologically (oldest first).
  const chronologicalLogs = [...logs].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-sm shadow-xl flex flex-col h-full" id="panel-execution-timeline">
      <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5">
        <div className="flex items-center space-x-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
            Execution Timeline
          </h2>
        </div>
        <div className="flex items-center space-x-1 font-mono text-[10px] text-zinc-500">
          <Clock className="h-3 w-3 animate-pulse text-emerald-400" />
          <span>REAL-TIME STREAM</span>
        </div>
      </div>

      <div className="mt-4 flex-grow flex flex-col justify-between">
        <div className="space-y-3 font-mono text-xs max-h-[280px] overflow-y-auto pr-1">
          {chronologicalLogs.length === 0 ? (
            <div className="flex h-36 flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-900 rounded-lg p-4 text-center">
              <span>Awaiting agent execution thread...</span>
              <span className="text-[10px] text-zinc-700 mt-1">Dispatched tools will trace here</span>
            </div>
          ) : (
            <div className="relative pl-4 border-l border-zinc-900 space-y-4">
              {chronologicalLogs.map((log, index) => {
                const isSuccess = log.status === 'VERIFIED';
                return (
                  <div key={log.id} className="relative group" id={`timeline-item-${log.id}`}>
                    {/* Pulsing state marker on line */}
                    <span className={`absolute left-[-21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-black ${
                      isSuccess
                        ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]'
                        : log.status === 'BLOCKED'
                        ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
                        : 'bg-amber-500 shadow-[0_0_6px_#f59e0b]'
                    }`} />

                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex items-start space-x-2.5">
                        <span className="text-zinc-500 text-[11px] select-none font-semibold">
                          {log.timestamp.split(' ')[0] || log.timestamp}
                        </span>
                        <div className="flex flex-col">
                          <span className={`font-semibold ${isSuccess ? 'text-zinc-300' : log.status === 'BLOCKED' ? 'text-rose-400 font-bold' : 'text-amber-400'}`}>
                            {log.tool_name}
                          </span>
                          <span className="text-[10px] text-zinc-500 mt-0.5">
                            {log.action}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        {isSuccess ? (
                          <span className="text-emerald-400 font-bold text-sm" title="Verified Safe">
                            ✓
                          </span>
                        ) : log.status === 'BLOCKED' ? (
                          <span className="text-rose-500 font-bold text-sm" title="Violation Blocked">
                            ✗
                          </span>
                        ) : (
                          <span className="text-amber-400 font-bold text-sm" title="Awaiting Approval">
                            ?
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footnote terminal status */}
        <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between font-mono text-[10px] text-zinc-600">
          <span>Active Tunnel: secure_websocket_821</span>
          <span className="flex items-center text-emerald-500 gap-1 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
          </span>
        </div>
      </div>
    </div>
  );
}
