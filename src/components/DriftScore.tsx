/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DriftScore — circular SVG gauge showing semantic alignment percentage.
 */

import React from 'react';
import { motion } from 'motion/react';

interface DriftScoreProps {
  score: number;           // 0–100
  goal?: string;
  action?: string;
  reason?: string;
  size?: 'sm' | 'md' | 'lg';
}

function getColor(score: number) {
  if (score >= 70) return { stroke: '#10b981', text: 'text-emerald-400', label: 'Aligned', bg: 'bg-emerald-950/30 border-emerald-800/30' };
  if (score >= 30) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Review', bg: 'bg-amber-950/30 border-amber-800/30' };
  return { stroke: '#ef4444', text: 'text-rose-400', label: 'Drifted', bg: 'bg-rose-950/30 border-rose-800/30' };
}

export default function DriftScore({ score, goal, action, reason, size = 'md' }: DriftScoreProps) {
  const color = getColor(score);

  const dim = size === 'sm' ? 48 : size === 'lg' ? 80 : 64;
  const strokeW = size === 'sm' ? 4 : 5;
  const r = (dim / 2) - strokeW;
  const circumference = 2 * Math.PI * r;
  const fillArc = (score / 100) * circumference;
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-sm' : 'text-xs';
  const numSize = size === 'sm' ? 10 : size === 'lg' ? 16 : 13;

  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${color.bg}`} title={reason}>
      {/* SVG Gauge */}
      <div className="relative flex-shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} className="-rotate-90">
          {/* Track */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeW}
          />
          {/* Progress arc */}
          <motion.circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke={color.stroke}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - fillArc }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-mono font-bold ${color.text}`} style={{ fontSize: numSize }}>
            {Math.round(score)}
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`font-mono font-bold uppercase tracking-wider ${color.text} ${textSize}`}>
            {color.label}
          </span>
          <span className={`font-mono ${textSize} text-zinc-500`}>{Math.round(score)}%</span>
        </div>
        {action && (
          <p className="font-mono text-[10px] text-zinc-400 truncate max-w-[140px]">
            {action.replace(/_/g, ' ')}
          </p>
        )}
        {reason && (
          <p className="font-mono text-[9px] text-zinc-600 truncate max-w-[180px] mt-0.5" title={reason}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

/** Compact inline badge version */
export function DriftBadge({ score }: { score: number }) {
  const color = getColor(score);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border ${color.bg} ${color.text}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color.stroke }} />
      {Math.round(score)}%
    </span>
  );
}
