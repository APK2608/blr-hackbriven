/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveMonitor — Real-time browser activity stream via SSE.
 * Connects to GET /events/stream and renders every verified browser action.
 * Used when the Chrome extension is active monitoring an autonomous agent.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Shield, Wifi, WifiOff, Activity, AlertTriangle,
  CheckCircle, XCircle, Clock, RefreshCw, Eye, Trash2, Download
} from 'lucide-react';
import { BACKEND_BASE_URL } from '../lib/constants';
import { DriftBadge } from './DriftScore';

interface LiveEvent {
  id: string;
  intent_id?: string;
  tool_name?: string;
  action?: string;
  url?: string;
  hostname?: string;
  source?: string;      // "browser_extension" | "agent" | "dashboard"
  status: string;
  risk_score?: number;
  drift_score?: number;
  drift_verdict?: string;
  reason?: string;
  timestamp: string;
  type?: string;        // "heartbeat" | "history"
}

const STATUS_CONFIG = {
  allowed:        { color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/30', dot: 'bg-emerald-500', glow: 'shadow-[0_0_8px_#10b981]', label: 'ALLOWED' },
  blocked:        { color: 'text-rose-400',    bg: 'bg-rose-950/30 border-rose-800/30',       dot: 'bg-rose-500',    glow: 'shadow-[0_0_8px_#ef4444]',  label: 'BLOCKED' },
  pending_review: { color: 'text-amber-400',   bg: 'bg-amber-950/30 border-amber-800/30',     dot: 'bg-amber-500',   glow: 'shadow-[0_0_8px_#f59e0b]',  label: 'PENDING' },
  unmonitored:    { color: 'text-zinc-500',    bg: 'bg-zinc-900/20 border-zinc-800/20',       dot: 'bg-zinc-600',    glow: '',                           label: 'UNMON' },
};

const SOURCE_ICON: Record<string, string> = {
  browser_extension: '🌐',
  agent: '🤖',
  dashboard: '🖥️',
};

function getRiskColor(score?: number) {
  if (!score) return 'text-zinc-600';
  if (score >= 8) return 'text-rose-400';
  if (score >= 5) return 'text-amber-400';
  return 'text-emerald-400';
}

function downloadJSON(data: LiveEvent[], filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function LiveMonitor() {
  const [events, setEvents]           = useState<LiveEvent[]>([]);
  const [connected, setConnected]     = useState(false);
  const [connecting, setConnecting]   = useState(false);
  const [filter, setFilter]           = useState<'ALL' | 'allowed' | 'blocked' | 'pending_review'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'browser_extension' | 'agent'>('ALL');
  const [paused, setPaused]           = useState(false);
  const [stats, setStats]             = useState({ total: 0, allowed: 0, blocked: 0, pending: 0 });
  const [lastHeartbeat, setLastHeartbeat] = useState<string>('');
  const [activeIntents, setActiveIntents] = useState<Set<string>>(new Set());

  const esRef   = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  pausedRef.current = paused;

  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setConnecting(true);

    const es = new EventSource(`${BACKEND_BASE_URL}/events/stream`);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setConnecting(false);
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        // Heartbeat — just update timestamp
        if (data.type === 'heartbeat') {
          setLastHeartbeat(data.timestamp);
          return;
        }

        // History batch on connect
        if (data.type === 'history' && Array.isArray(data.events)) {
          if (!pausedRef.current) {
            setEvents(prev => {
              const combined = [...data.events, ...prev];
              return combined.slice(0, 300);
            });
            data.events.forEach((ev: LiveEvent) => updateStats(ev));
          }
          return;
        }

        // Live single event
        if (!pausedRef.current) {
          setEvents(prev => [data, ...prev].slice(0, 300));
          updateStats(data);
          if (data.intent_id) {
            setActiveIntents(prev => new Set([...prev, data.intent_id!]));
          }
        }
      } catch (_) {}
    };

    es.onerror = () => {
      setConnected(false);
      setConnecting(false);
      es.close();
      esRef.current = null;
      // Auto-reconnect after 5s
      setTimeout(() => { if (!esRef.current) connect(); }, 5000);
    };
  }, []);

  function updateStats(ev: LiveEvent) {
    setStats(prev => ({
      total: prev.total + 1,
      allowed: prev.allowed + (ev.status === 'allowed' ? 1 : 0),
      blocked: prev.blocked + (ev.status === 'blocked' ? 1 : 0),
      pending: prev.pending + (ev.status === 'pending_review' ? 1 : 0),
    }));
  }

  useEffect(() => { connect(); return () => { esRef.current?.close(); }; }, [connect]);

  // Auto-scroll to top when new events arrive (feed is newest-first)
  useEffect(() => {
    if (!paused && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  const filtered = events.filter(ev => {
    if (filter !== 'ALL' && ev.status !== filter) return false;
    if (sourceFilter !== 'ALL' && ev.source !== sourceFilter) return false;
    return true;
  });

  function formatTime(ts: string) {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts?.slice(11, 19) || ''; }
  }

  return (
    <div className="space-y-4">
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-300">
              Live Browser Monitor
            </h2>
            {/* Connection indicator */}
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold border ${
              connected
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-400'
                : connecting
                ? 'bg-zinc-900 border-zinc-700 text-zinc-400'
                : 'bg-rose-950/40 border-rose-800/40 text-rose-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-emerald-400 animate-pulse' : connecting ? 'bg-zinc-500 animate-pulse' : 'bg-rose-400'
              }`} />
              {connected ? 'SSE Connected' : connecting ? 'Connecting…' : 'Disconnected'}
            </span>
            {lastHeartbeat && (
              <span className="font-mono text-[10px] text-zinc-600 hidden sm:block">
                ♥ {formatTime(lastHeartbeat)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pause toggle */}
            <button
              onClick={() => setPaused(p => !p)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-[11px] font-semibold transition-all ${
                paused
                  ? 'border-amber-700/60 bg-amber-950/20 text-amber-400'
                  : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {paused ? <RefreshCw className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              {paused ? 'Resume' : 'Pause'}
            </button>
            {/* Clear */}
            <button
              onClick={() => { setEvents([]); setStats({ total: 0, allowed: 0, blocked: 0, pending: 0 }); }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-mono text-[11px] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
            {/* Export */}
            <button
              onClick={() => downloadJSON(events, `intent-firewall-live-${Date.now()}.json`)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 font-mono text-[11px] text-zinc-500 hover:text-zinc-200 hover:border-zinc-600 transition-all"
            >
              <Download className="h-3 w-3" />
              Export
            </button>
            {/* Reconnect */}
            {!connected && !connecting && (
              <button
                onClick={connect}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/20 px-3 py-1.5 font-mono text-[11px] text-emerald-400 hover:bg-emerald-900/30 transition-all"
              >
                <Wifi className="h-3 w-3" />
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Total Events', value: stats.total, color: 'text-zinc-300' },
            { label: 'Allowed',      value: stats.allowed, color: 'text-emerald-400' },
            { label: 'Blocked',      value: stats.blocked, color: 'text-rose-400' },
            { label: 'Pending',      value: stats.pending, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-zinc-900 bg-black/40 p-2 text-center">
              <div className={`font-mono text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="font-mono text-[9px] text-zinc-600 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Setup instructions (no events yet) ──────────────────────── */}
      {events.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-8 text-center space-y-4">
          <div className="text-4xl">🛡️</div>
          <h3 className="font-mono text-sm font-bold text-zinc-300">Waiting for Browser Activity</h3>
          <p className="font-mono text-[11px] text-zinc-500 max-w-md mx-auto leading-relaxed">
            Install the Intent Firewall Chrome Extension and activate it with a goal.
            Every browser action across all monitored tabs will appear here in real-time.
          </p>
          <div className="inline-flex flex-col gap-2 text-left font-mono text-[11px] bg-black border border-zinc-900 rounded-lg p-4 mt-2 max-w-sm">
            <span className="text-zinc-500">1. Load <code className="text-emerald-400">browser-extension/</code> in Chrome</span>
            <span className="text-zinc-500">2. Click the 🛡️ icon and enter your agent goal</span>
            <span className="text-zinc-500">3. Click <strong className="text-emerald-400">Activate Firewall</strong></span>
            <span className="text-zinc-500">4. All browser actions stream here in real-time</span>
          </div>
        </div>
      )}

      {/* ── Active Intents pill row ──────────────────────────────────── */}
      {activeIntents.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest">Active Intents:</span>
          {[...activeIntents].map(id => (
            <span key={id} className="font-mono text-[10px] bg-emerald-950/30 border border-emerald-800/30 text-emerald-400 rounded px-2 py-0.5">
              {id.slice(0, 12)}…
            </span>
          ))}
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status filter */}
          <div className="flex bg-black rounded-lg border border-zinc-800 p-0.5">
            {(['ALL', 'allowed', 'blocked', 'pending_review'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider rounded transition-all uppercase ${
                  filter === f ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'pending_review' ? 'pending' : f}
              </button>
            ))}
          </div>
          {/* Source filter */}
          <div className="flex bg-black rounded-lg border border-zinc-800 p-0.5">
            {(['ALL', 'browser_extension', 'agent'] as const).map(f => (
              <button
                key={f}
                onClick={() => setSourceFilter(f)}
                className={`px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider rounded transition-all uppercase ${
                  sourceFilter === f ? 'bg-zinc-800 text-violet-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {f === 'browser_extension' ? '🌐 Extension' : f === 'agent' ? '🤖 Agent' : 'All Sources'}
              </button>
            ))}
          </div>
          <span className="font-mono text-[10px] text-zinc-600">{filtered.length} events</span>
        </div>
      )}

      {/* ── Live Event Feed ──────────────────────────────────────────── */}
      {events.length > 0 && (
        <div
          ref={feedRef}
          className="rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-y-auto shadow-xl"
          style={{ maxHeight: '520px' }}
        >
          <AnimatePresence initial={false}>
            {filtered.map((ev, idx) => {
              const cfg = STATUS_CONFIG[ev.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.unmonitored;
              const isBrowser = ev.source === 'browser_extension';

              return (
                <motion.div
                  key={ev.id + idx}
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-zinc-900 hover:bg-zinc-900/30 transition-colors group ${
                    ev.status === 'blocked' ? 'bg-rose-950/5' : ''
                  }`}
                >
                  {/* Status dot */}
                  <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.glow}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Source icon */}
                      <span className="text-xs" title={ev.source}>{SOURCE_ICON[ev.source || ''] || '⚙️'}</span>
                      {/* Action name */}
                      <span className="font-mono text-[12px] font-bold text-zinc-200">
                        {(ev.tool_name || ev.action || 'action').replace(/_/g, ' ')}
                      </span>
                      {/* Status badge */}
                      <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {isBrowser && (
                        <span className="font-mono text-[9px] text-violet-400 border border-violet-800/30 rounded px-1.5 py-0.5 bg-violet-950/20">
                          Extension
                        </span>
                      )}
                    </div>

                    {/* URL */}
                    {ev.url && (
                      <div className="font-mono text-[10px] text-zinc-500 truncate max-w-[480px]" title={ev.url}>
                        {ev.hostname || ev.url}
                      </div>
                    )}

                    {/* Reason (for blocked/pending) */}
                    {ev.reason && ev.status !== 'allowed' && (
                      <div className={`font-mono text-[10px] ${cfg.color} opacity-80`}>{ev.reason}</div>
                    )}

                    {/* Badges row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {ev.drift_score !== undefined && <DriftBadge score={ev.drift_score} />}
                      {ev.risk_score !== undefined && (
                        <span className={`font-mono text-[10px] ${getRiskColor(ev.risk_score)}`}>
                          Risk: {ev.risk_score}/10
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-zinc-700">
                        {formatTime(ev.timestamp)}
                      </span>
                      {ev.intent_id && (
                        <span className="font-mono text-[9px] text-zinc-700" title={ev.intent_id}>
                          intent:{ev.intent_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right-side icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {ev.status === 'allowed' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500/60" />}
                    {ev.status === 'blocked' && <XCircle className="h-3.5 w-3.5 text-rose-500/80" />}
                    {ev.status === 'pending_review' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500/80" />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {filtered.length === 0 && events.length > 0 && (
            <div className="py-12 text-center font-mono text-xs text-zinc-600">
              No events match current filters
            </div>
          )}
        </div>
      )}

      {/* ── Extension install card ───────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5">
        <div className="flex items-center gap-2 mb-3 border-b border-zinc-900 pb-3">
          <Globe className="h-4 w-4 text-violet-400" />
          <h3 className="font-mono text-sm font-bold text-zinc-300 uppercase tracking-wider">
            Chrome Extension Setup
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-[11px]">
          {[
            { step: '1', title: 'Load Extension', desc: 'Go to chrome://extensions → Enable Developer Mode → Load Unpacked → select browser-extension/ folder', icon: '📂' },
            { step: '2', title: 'Activate Session', desc: 'Click the 🛡️ icon in Chrome toolbar → enter your agent goal → click Activate Firewall', icon: '🔐' },
            { step: '3', title: 'Watch Live', desc: 'Every navigation, click, and form submit across all tabs streams here in real-time with drift scoring', icon: '📡' },
          ].map(s => (
            <div key={s.step} className="rounded-lg border border-zinc-900 bg-black/30 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{s.icon}</span>
                <span className="font-bold text-zinc-300">Step {s.step}: {s.title}</span>
              </div>
              <p className="text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
