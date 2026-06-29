/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert, XCircle, AlertOctagon, Terminal, Flame, ArrowRight, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AlertNotificationProps {
  isOpen: boolean;
  onClose: () => void;
  toolName: string;
  reason: string;
  riskScore: number;
  threatLevel: string;
  goal: string;
  status: 'BLOCKED' | 'PENDING';
  onApproveException?: () => void;
  onBlockAction?: () => void;
}

export default function AlertNotification({
  isOpen,
  onClose,
  toolName,
  reason,
  riskScore,
  threatLevel,
  goal,
  status,
  onApproveException,
  onBlockAction,
}: AlertNotificationProps) {
  if (!isOpen) return null;

  const isBlocked = status === 'BLOCKED';
  const colorBase = isBlocked ? 'rose' : 'amber';
  const borderColor = isBlocked ? 'border-rose-500' : 'border-amber-500';
  const bgColor = isBlocked ? 'bg-rose-500' : 'bg-amber-500';
  const textColor = isBlocked ? 'text-rose-500' : 'text-amber-500';
  const textColorMuted = isBlocked ? 'text-rose-400' : 'text-amber-400';
  const bgSubtle = isBlocked ? 'bg-rose-950/50' : 'bg-amber-950/50';
  const borderSubtle = isBlocked ? 'border-rose-500/30' : 'border-amber-500/30';
  const shadowColor = isBlocked ? 'shadow-rose-950/40' : 'shadow-amber-950/40';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        {/* Animated pulsing border and background overlay */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className={`relative w-full max-w-lg overflow-hidden rounded-xl border ${borderColor} bg-zinc-950 p-6 shadow-2xl ${shadowColor}`}
          id="alert-threat-modal"
        >
          {/* Glowing background scanner line */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] ${bgColor} animate-bounce`} />

          {/* Strobe emergency glow */}
          <div className={`absolute inset-0 ${bgColor}/[0.02] pointer-events-none animate-pulse`} />

          <div className="flex items-start space-x-4">
            <div className={`rounded-lg ${bgSubtle} border ${borderSubtle} p-2.5 ${textColorMuted}`}>
              <AlertOctagon className="h-6 w-6 animate-spin-slow" />
            </div>
            <div className="flex-grow">
              <h3 className={`font-mono text-base font-bold ${textColor} tracking-wider uppercase`}>
                {isBlocked ? 'Intrusion Attempt Blocked' : 'Suspicious Action Paused'}
              </h3>
              <p className="font-mono text-[10px] text-zinc-500 uppercase mt-0.5">
                {isBlocked ? 'ArmorIQ Containment Active' : 'ArmorIQ Warn-Only Mode Active'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300 transition-colors"
              id="btn-close-alert-modal"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Threat Metric Grid */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-black border border-zinc-900 p-2.5 text-center font-mono">
              <span className="block text-[9px] text-zinc-500 uppercase tracking-widest">Decision</span>
              <span className={`block text-sm font-bold ${textColor} mt-1 uppercase tracking-wider animate-pulse`}>
                {isBlocked ? 'Blocked' : 'Paused'}
              </span>
            </div>
            <div className="rounded-lg bg-black border border-zinc-900 p-2.5 text-center font-mono">
              <span className="block text-[9px] text-zinc-500 uppercase tracking-widest">Risk Index</span>
              <span className={`block text-sm font-bold ${textColorMuted} mt-1`}>
                {riskScore}/10
              </span>
            </div>
            <div className="rounded-lg bg-black border border-zinc-900 p-2.5 text-center font-mono">
              <span className="block text-[9px] text-zinc-500 uppercase tracking-widest">Threat Level</span>
              <span className={`block text-sm font-bold ${textColor} mt-1 uppercase tracking-wider`}>
                {threatLevel}
              </span>
            </div>
          </div>

          {/* Threat analysis description */}
          <div className="mt-5 space-y-3.5 font-mono text-xs">
            <div className={`rounded-lg border ${borderSubtle} ${bgSubtle} p-3.5 space-y-2`}>
              <div className={`flex items-center space-x-1.5 ${textColorMuted} font-semibold uppercase text-[10px] tracking-wider`}>
                <Flame className="h-3.5 w-3.5 shrink-0" />
                <span>Exploit Vector Analysis</span>
              </div>
              <div className="space-y-1 text-[11px] text-zinc-400">
                <p>
                  <strong className="text-zinc-300">Goal Scope:</strong> "{goal}"
                </p>
                <p>
                  <strong className="text-zinc-300">Attempted Tool:</strong> <code className={`px-1.5 py-0.5 rounded bg-black/60 border border-zinc-900 ${textColorMuted} text-[10px]`}>{toolName}()</code>
                </p>
                <p>
                  <strong className="text-zinc-300">Mitigation:</strong> {reason}
                </p>
              </div>
            </div>

            {/* Terminal log trace */}
            <div className="rounded-lg bg-black border border-zinc-900 p-3 text-[10px] text-zinc-500 space-y-1 select-none font-mono">
              <div className="flex items-center space-x-1 text-emerald-500">
                <Terminal className="h-3 w-3" />
                <span>syslog_monitor_node_01:</span>
              </div>
              <p className="text-zinc-400 font-semibold">[CRITICAL] 09:05:22 - OUT-OF-BOUNDS INSTRUCTION INJECTED</p>
              <p>[INFO] 09:05:22 - Matching call '{toolName}' against verified Merkle leaves...</p>
              <p className={isBlocked ? "text-rose-500/80" : "text-amber-500/80"}>[FAIL] 09:05:22 - leaf cryptographic validation failure (signature mismatch)</p>
              <p className="text-emerald-500/80">[ACTION] 09:05:22 - {isBlocked ? 'Dispatched system isolation protocol. Call vetoed.' : 'Paused instruction. Awaiting operator review.'}</p>
            </div>
          </div>

          {/* Controls Footer */}
          <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 font-mono text-xs font-semibold uppercase hover:bg-zinc-800 hover:text-zinc-200 transition-all cursor-pointer"
              id="btn-alert-acknowledge"
            >
              Acknowledge Alert
            </button>
            
            {status === 'PENDING' && onBlockAction && (
              <button
                onClick={() => {
                  onBlockAction();
                  onClose();
                }}
                className="px-4 py-2.5 rounded-lg border border-rose-600 bg-rose-950/40 text-rose-300 font-mono text-xs font-semibold uppercase hover:bg-rose-900/40 hover:border-rose-500 transition-all cursor-pointer flex items-center justify-center space-x-1"
                id="btn-alert-execute-block"
              >
                <XCircle className="h-4 w-4" />
                <span>Execute Block</span>
              </button>
            )}

            {onApproveException && (
              <button
                onClick={() => {
                  onApproveException();
                  onClose();
                }}
                className={`px-4 py-2.5 rounded-lg border ${borderColor} ${bgSubtle} ${textColorMuted} font-mono text-xs font-semibold uppercase hover:${bgSubtle} hover:${borderColor} transition-all cursor-pointer flex items-center justify-center space-x-1`}
                id="btn-alert-approve-exception"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Override & Approve Exception</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
