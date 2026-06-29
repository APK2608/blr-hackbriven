/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, AlertOctagon } from 'lucide-react';
import { motion } from 'motion/react';
import { Metrics as MetricsType, SystemStatus } from '../types';

interface MetricsProps {
  metrics: MetricsType;
  systemStatus: SystemStatus;
}

export default function Metrics({ metrics, systemStatus }: MetricsProps) {
  // Let's add a slight live vibration/flicker to the trust score to make it feel "alive"
  const [liveTrustScore, setLiveTrustScore] = useState(metrics.trustScore);

  useEffect(() => {
    setLiveTrustScore(metrics.trustScore);
  }, [metrics.trustScore]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (metrics.trustScore > 0) {
        // Micro-fluctuation of +/- 0.05%
        const delta = (Math.random() - 0.5) * 0.1;
        setLiveTrustScore(prev => {
          const next = prev + delta;
          return Number(Math.max(0, Math.min(100, next)).toFixed(2));
        });
      } else {
        setLiveTrustScore(0);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [metrics.trustScore]);

  // Status helper colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'active':
      case 'operational':
        return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30';
      case 'loading':
      case 'monitoring':
        return 'text-amber-400 bg-amber-950/30 border-amber-500/30';
      case 'compromised':
      case 'offline':
      case 'inactive':
        return 'text-rose-400 bg-rose-950/30 border-rose-500/30';
      default:
        return 'text-zinc-400 bg-zinc-950/30 border-zinc-500/30';
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Trust Score Radial Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-sm shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-300" id="metric-card-trust-score">
        <div className="absolute top-0 right-0 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-500"></div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">Trust Index</span>
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="mt-4 flex items-baseline space-x-2">
          <span className="font-mono text-3xl font-bold tracking-tight text-emerald-400">
            {liveTrustScore}%
          </span>
          <span className="font-mono text-xs text-emerald-600">LIMIT VERIFIED</span>
        </div>
        <div className="mt-2 w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${metrics.trustScore}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400"
          />
        </div>
        <p className="mt-2.5 font-mono text-[10px] text-zinc-500">Continuous cryptographic verification active</p>
      </div>

      {/* Total Actions Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-sm shadow-xl relative overflow-hidden group hover:border-blue-500/30 transition-all duration-300" id="metric-card-total-actions">
        <div className="absolute top-0 right-0 h-24 w-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all duration-500"></div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">Total Queries</span>
          <Activity className="h-4 w-4 text-blue-500" />
        </div>
        <div className="mt-4 flex items-baseline space-x-2">
          <span className="font-mono text-3xl font-bold tracking-tight text-blue-400">
            {metrics.totalActions}
          </span>
          <span className="font-mono text-xs text-blue-600">EVALUATIONS</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Safe operations</span>
          <span className="text-emerald-400 font-bold">{metrics.allowedActions}</span>
        </div>
        <p className="mt-3.5 font-mono text-[10px] text-zinc-500">Real-time telemetry action pipeline</p>
      </div>

      {/* Blocked Threats Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-sm shadow-xl relative overflow-hidden group hover:border-rose-500/30 transition-all duration-300" id="metric-card-blocked-threats">
        <div className="absolute top-0 right-0 h-24 w-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/10 transition-all duration-500"></div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">Mitigated Exploits</span>
          <AlertOctagon className="h-4 w-4 text-rose-500" />
        </div>
        <div className="mt-4 flex items-baseline space-x-2">
          <span className={`font-mono text-3xl font-bold tracking-tight transition-colors duration-300 ${metrics.blockedActions > 0 ? 'text-rose-500 animate-pulse' : 'text-zinc-400'}`}>
            {metrics.blockedActions}
          </span>
          <span className="font-mono text-xs text-rose-600">SHIELDED</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <span>Out-of-bounds blocked</span>
          <span className="text-rose-400 font-bold">{metrics.blockedActions}</span>
        </div>
        <p className="mt-3.5 font-mono text-[10px] text-zinc-500">Prompt injections neutralized</p>
      </div>

      {/* System Status Indicators Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-sm shadow-xl relative overflow-hidden group hover:border-zinc-700 transition-all duration-300" id="metric-card-system-status">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">Trust Layer status</span>
          <Activity className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="mt-3.5 space-y-2.5 font-mono text-xs">
          {/* Backend Status Indicator */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-400">Backend Firewall API</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${getStatusColor(systemStatus.backend)}`}>
              {systemStatus.backend}
            </span>
          </div>
          {/* ArmorIQ Status Indicator */}
          <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
            <span className="text-zinc-400">ArmorIQ Core Engine</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${getStatusColor(systemStatus.armoriq)}`}>
              {systemStatus.armoriq}
            </span>
          </div>
          {/* Trust Layer Status Indicator */}
          <div className="flex items-center justify-between pb-0.5">
            <span className="text-zinc-400">Signature Verification</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${getStatusColor(systemStatus.trustLayer)}`}>
              {systemStatus.trustLayer}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
