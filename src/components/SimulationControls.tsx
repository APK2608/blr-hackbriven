/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';

interface SimulationControlsProps {
  onSimulateSafe: () => void;
  onSimulateMalicious: () => void;
  isSimulating: boolean;
  hasContract: boolean;
}

export default function SimulationControls({
  onSimulateSafe,
  onSimulateMalicious,
  isSimulating,
  hasContract,
}: SimulationControlsProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-sm shadow-xl" id="panel-simulation-controls">
      <div className="flex items-center space-x-2 border-b border-zinc-900 pb-3.5">
        <Zap className="h-4 w-4 text-emerald-400" />
        <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
          Simulation Laboratory
        </h2>
      </div>

      <div className="mt-4 space-y-3.5">
        <p className="font-mono text-[11px] text-zinc-500 leading-relaxed">
          Verify containment capabilities by executing simulated agent workflows. Observe how the firewall evaluates actions against the Merkle root contract.
        </p>

        <div className="grid grid-cols-1 gap-3">
          {/* Safe Simulation Button */}
          <button
            onClick={onSimulateSafe}
            disabled={isSimulating || !hasContract}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
              !hasContract
                ? 'border-zinc-900 bg-zinc-950/20 text-zinc-600 cursor-not-allowed'
                : isSimulating
                ? 'border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
                : 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-emerald-400 hover:border-emerald-500/30 cursor-pointer active:scale-[0.98]'
            }`}
            id="btn-simulate-safe-action"
          >
            <Play className="h-4 w-4" />
            <span>Simulate Safe Action</span>
          </button>

          {/* Malicious Injection Button */}
          <button
            onClick={onSimulateMalicious}
            disabled={isSimulating || !hasContract}
            className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border font-mono text-xs font-semibold uppercase tracking-wider transition-all duration-300 ${
              !hasContract
                ? 'border-zinc-900 bg-zinc-950/20 text-zinc-600 cursor-not-allowed'
                : isSimulating
                ? 'border-zinc-800 bg-zinc-900 text-zinc-500 cursor-not-allowed'
                : 'border-rose-900/30 bg-rose-950/25 text-rose-400 border-rose-800/40 hover:bg-rose-900/20 hover:border-rose-500 cursor-pointer active:scale-[0.98] shadow-lg shadow-rose-950/20 animate-pulse'
            }`}
            id="btn-inject-malicious-action"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Inject Malicious Action</span>
          </button>
        </div>

        {!hasContract && (
          <div className="p-3 rounded-lg border border-amber-950/20 bg-amber-950/5 text-amber-500/80 font-mono text-[10px] flex items-start gap-2 leading-normal">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
            <span>
              <strong>Containment status inactive.</strong> You must generate a cryptographic intent contract above before initiating a simulation run.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
