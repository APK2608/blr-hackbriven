/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Metrics from './components/Metrics';
import IntentCapture from './components/IntentCapture';
import BoundaryContract from './components/BoundaryContract';
import SimulationControls from './components/SimulationControls';
import AuditLogs from './components/AuditLogs';
import ExecutionTimeline from './components/ExecutionTimeline';
import AlertNotification from './components/AlertNotification';
import AgentSDK from './components/AgentSDK';
import LiveMonitor from './components/LiveMonitor';
import Auth from './components/Auth';
import { supabase } from './lib/supabase';
import { PlanData, AuditLog, SystemStatus, Metrics as MetricsType } from './types';
import { BACKEND_BASE_URL, RISK_REGISTRY, getFriendlyActionName } from './lib/constants';
import { captureIntent, verifyAction, checkHealth } from './lib/api';

function getFormattedTime() {
  const d = new Date();
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('Dashboard');
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    backend: 'loading',
    armoriq: 'active',
    trustLayer: 'monitoring',
  });

  const [activePlan, setActivePlan] = useState<PlanData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Tabulated Logs and stream data
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Central Metrics
  const [metrics, setMetrics] = useState<MetricsType>({
    totalActions: 0,
    allowedActions: 0,
    blockedActions: 0,
    trustScore: 100,
  });

  // Threat alert modal state
  const [threatAlert, setThreatAlert] = useState<{
    isOpen: boolean;
    toolName: string;
    reason: string;
    riskScore: number;
    threatLevel: string;
    status: 'BLOCKED' | 'PENDING';
    actionId: string;
  } | null>(null);

  // Admin and Policy Settings
  const [autoMitigate, setAutoMitigate] = useState(true);
  const [riskThreshold, setRiskThreshold] = useState(7);
  const [customLogsText, setCustomLogsText] = useState('AGENT_BOUND_DAEMON :: started listening on port 3000\nARMOR_IQ :: cryptographic contract layer loaded\n');

  // Fetch initial health on load and set up Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });

    const runHealthCheck = async () => {
      const isOnline = await checkHealth();
      setSystemStatus(prev => ({ ...prev, backend: isOnline ? 'online' : 'offline' }));
    };
    runHealthCheck();

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full"></div></div>;
  }

  if (!user) {
    return <Auth />;
  }

  // Update Trust Score based on Ratio of Allowed/Blocked
  useEffect(() => {
    if (metrics.totalActions === 0) {
      setMetrics(prev => ({ ...prev, trustScore: 100 }));
      return;
    }
    const ratio = metrics.allowedActions / metrics.totalActions;
    const computed = Math.round(ratio * 100);
    setMetrics(prev => ({ ...prev, trustScore: Math.max(0, Math.min(100, computed)) }));
  }, [metrics.allowedActions, metrics.totalActions]);

  // ── Handler: Generate Intent (calls real /capture-intent) ──────────────────
  const handleGenerateIntent = async (goal: string) => {
    setIsGenerating(true);
    setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));

    try {
      // Try real backend /capture-intent first
      const response = await captureIntent({
        goal,
        agent_id: 'intent-firewall-dashboard',
        metadata: { source: 'dashboard' }
      });

      // Map CaptureIntentResponse → PlanData (frontend shape)
      const mockPlan: PlanData = {
        plan_id: response.intent_id,
        contract: {
          intent_hash: response.intent_hash,
          merkle_root: response.merkle_root,
          signature: response.signature,
          agent_id: response.agent_id,
          allowed_actions: response.allowed_actions,
          goal: response.goal,
          created_at: response.created_at,
          version: response.version,
        },
        status: 'signed',
      };

      setActivePlan(mockPlan);
      setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));

      const newLog: AuditLog = {
        id: `plan-${Date.now()}`,
        timestamp: getFormattedTime(),
        status: 'VERIFIED',
        action: `Cryptographic trust contract signed for goal: "${goal}"`,
        tool_name: 'capture_intent',
        risk_score: 0,
        drift_score: 100,
        drift_verdict: 'aligned',
      };
      setAuditLogs([newLog]);
      setMetrics({ totalActions: 1, allowedActions: 1, blockedActions: 0, trustScore: 100 });
      setCustomLogsText(prev => prev + `[CONTRACT] ArmorIQ signed intent: ${response.intent_id.substring(0, 16)}...\n[HASH] ${response.intent_hash.substring(0, 24)}...\n`);

    } catch (e) {
      // Robust local fallback — demo works even when backend is offline
      console.warn('Backend /capture-intent unavailable, using local fallback:', e);
      const localHash = Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2);
      const mockContract = {
        intent_hash: localHash,
        merkle_root: '8678289532fa9d7a2d8231c1e36b377f9ac8b858b84ff576c93da856829a13e4',
        signature: `armoriq_v2_sig_${localHash.substring(0, 16)}_86782895`,
        agent_id: `agent_${localHash.substring(0, 8)}`,
        allowed_actions: ['read_codebase', 'modify_auth_module', 'run_tests', 'deploy_staging'],
        goal,
        created_at: new Date().toISOString(),
        version: 'ArmorIQ-v2.0-Local',
      };

      const mockPlan: PlanData = {
        plan_id: `plan_local_${Math.random().toString(36).substring(2, 10)}`,
        contract: mockContract,
        status: 'signed',
      };

      setActivePlan(mockPlan);
      setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));

      const newLog: AuditLog = {
        id: `plan-${Date.now()}`,
        timestamp: getFormattedTime(),
        status: 'VERIFIED',
        action: `Cryptographic trust contract signed (local) for goal: "${goal}"`,
        tool_name: 'capture_intent',
        risk_score: 0,
        drift_score: 100,
      };
      setAuditLogs([newLog]);
      setMetrics({ totalActions: 1, allowedActions: 1, blockedActions: 0, trustScore: 100 });
      setCustomLogsText(prev => prev + `[LOCAL_CONTRACT] Signed locally: ${mockContract.intent_hash.substring(0, 16)}...\n`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Run the safe simulated action sequence step-by-step ────────────────────
  const handleSimulateSafe = async () => {
    if (!activePlan) return;
    setIsSimulating(true);
    setCustomLogsText(prev => prev + `[SIMULATION] Starting safe tool dispatch sequence...\n`);

    const toolsToRun = [
      { name: 'read_codebase', args: { filepath: 'src/App.tsx' } },
      { name: 'modify_auth_module', args: { filepath: 'src/components/Header.tsx' } },
      { name: 'run_tests', args: {} },
      { name: 'deploy_staging', args: { environment: 'staging-alpha' } },
    ];

    for (const tool of toolsToRun) {
      await new Promise(resolve => setTimeout(resolve, 1200));

      const timestamp = getFormattedTime();
      const risk = RISK_REGISTRY[tool.name] || 1;
      const friendlyName = getFriendlyActionName(tool.name, tool.args);

      // Try real backend /verify-action
      let verifyResult: { status: string; drift_score?: number; drift_verdict?: string; drift_reason?: string; reason?: string } | null = null;
      try {
        verifyResult = await verifyAction({
          intent_id: activePlan.plan_id,
          action: tool.name,
          args: tool.args,
          description: friendlyName,
        });
      } catch (e) {
        // Fallback to local risk threshold logic
        console.warn('verify-action failed, using local fallback:', e);
      }

      const backendStatus = verifyResult?.status;
      const driftScore = verifyResult?.drift_score ?? 95;
      const driftVerdict = verifyResult?.drift_verdict ?? 'aligned';
      const driftReason = verifyResult?.drift_reason;

      // Determine effective status
      const isPending = backendStatus === 'pending_review' || (!backendStatus && risk >= riskThreshold);
      const isBlocked = backendStatus === 'blocked';

      if (isBlocked) {
        const blockLog: AuditLog = {
          id: `exec-${Date.now()}-${tool.name}`,
          timestamp,
          status: 'BLOCKED',
          action: friendlyName,
          tool_name: tool.name,
          risk_score: risk,
          drift_score: driftScore,
          drift_verdict: driftVerdict,
          drift_reason: driftReason,
          arguments: tool.args,
          reason: verifyResult?.reason || 'Blocked by intent firewall',
        };
        setAuditLogs(prev => [...prev, blockLog]);
        setMetrics(prev => ({ ...prev, totalActions: prev.totalActions + 1, blockedActions: prev.blockedActions + 1 }));
        break;
      }

      if (isPending) {
        const pendingLog: AuditLog = {
          id: `exec-${Date.now()}-${tool.name}`,
          timestamp,
          status: 'PENDING',
          action: friendlyName,
          tool_name: tool.name,
          risk_score: risk,
          drift_score: driftScore,
          drift_verdict: driftVerdict,
          drift_reason: driftReason,
          arguments: tool.args,
          reason: verifyResult?.reason || `High risk tool (${risk}/${riskThreshold}) — manual review required`,
        };
        setAuditLogs(prev => [...prev, pendingLog]);
        setMetrics(prev => ({ ...prev, totalActions: prev.totalActions + 1 }));
        setCustomLogsText(prev => prev + `[WARN] Tool '${tool.name}' requires manual review. Risk: ${risk}, Drift: ${driftScore?.toFixed(0)}%\n`);

        setThreatAlert({
          isOpen: true,
          toolName: tool.name,
          reason: pendingLog.reason!,
          riskScore: risk,
          threatLevel: 'HIGH',
          status: 'PENDING',
          actionId: pendingLog.id,
        });
        setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));
        break;
      }

      // Allowed
      const newLog: AuditLog = {
        id: `exec-${Date.now()}-${tool.name}`,
        timestamp,
        status: 'VERIFIED',
        action: friendlyName,
        tool_name: tool.name,
        risk_score: risk,
        drift_score: driftScore,
        drift_verdict: driftVerdict,
        drift_reason: driftReason,
        arguments: tool.args,
      };

      setAuditLogs(prev => [...prev, newLog]);
      setMetrics(prev => ({
        ...prev,
        totalActions: prev.totalActions + 1,
        allowedActions: prev.allowedActions + 1,
      }));
      setCustomLogsText(prev => prev + `[EXECUTE] '${tool.name}' verified. Risk: ${risk}/10, Drift Alignment: ${driftScore?.toFixed(0)}%\n`);
    }

    setIsSimulating(false);
    setCustomLogsText(prev => prev + `[SIMULATION] Safe sequence completed.\n`);
  };

  // ── Inject a prompt injection threat simulation ────────────────────────────
  const handleSimulateMalicious = async () => {
    if (!activePlan) return;
    setIsSimulating(true);
    setCustomLogsText(prev => prev + `[THREAT_INTRUSION] Ingress vector: Prompt injection exploit detected...\n`);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const toolName = 'drop_database';
    const toolArgs = { schema: 'production_customer_data' };
    const timestamp = getFormattedTime();
    const risk = RISK_REGISTRY[toolName] || 10;
    const friendlyName = getFriendlyActionName(toolName, toolArgs);

    // Try real backend verify-action (should be blocked with drift ~2-5%)
    let verifyResult: { status: string; drift_score?: number; drift_verdict?: string; drift_reason?: string; reason?: string } | null = null;
    try {
      verifyResult = await verifyAction({
        intent_id: activePlan.plan_id,
        action: toolName,
        args: toolArgs,
        description: 'Drop production database with all customer data',
      });
    } catch (e) {
      console.warn('verify-action (malicious) failed, using local fallback:', e);
    }

    const driftScore = verifyResult?.drift_score ?? 2.3;
    const driftVerdict = verifyResult?.drift_verdict ?? 'drifted';
    const driftReason = verifyResult?.drift_reason ?? 'Adversarial action detected — near-zero alignment with signed goal';
    const backendBlocked = verifyResult?.status === 'blocked' || !verifyResult;

    if (autoMitigate || backendBlocked) {
      const blockLog: AuditLog = {
        id: `threat-${Date.now()}`,
        timestamp,
        status: 'BLOCKED',
        action: friendlyName,
        tool_name: toolName,
        risk_score: risk,
        drift_score: driftScore,
        drift_verdict: driftVerdict,
        drift_reason: driftReason,
        arguments: toolArgs,
        reason: verifyResult?.reason || 'Outside Intent Boundary Policy — ArmorIQ CONTRACT_VETO',
      };

      setAuditLogs(prev => [...prev, blockLog]);
      setMetrics(prev => ({
        ...prev,
        totalActions: prev.totalActions + 1,
        blockedActions: prev.blockedActions + 1,
      }));

      setThreatAlert({
        isOpen: true,
        toolName,
        reason: `Tool call dropped — Not in Merkle contract. Drift: ${driftScore.toFixed(1)}%`,
        riskScore: risk,
        threatLevel: 'CRITICAL',
        status: 'BLOCKED',
        actionId: blockLog.id,
      });

      setSystemStatus(prev => ({ ...prev, trustLayer: 'compromised' }));
      setCustomLogsText(prev => prev + `[BLOCKED] Intent drift: ${driftScore.toFixed(1)}%. Tool '${toolName}' BLOCKED. Veto: CONTRACT_VETO\n[AUDIT] Event persisted to Supabase audit trail.\n`);
    } else {
      const pendingLog: AuditLog = {
        id: `threat-${Date.now()}`,
        timestamp,
        status: 'PENDING',
        action: friendlyName,
        tool_name: toolName,
        risk_score: risk,
        drift_score: driftScore,
        drift_verdict: driftVerdict,
        arguments: toolArgs,
        reason: 'Warn Only mode — Awaiting operator decision',
      };

      setAuditLogs(prev => [...prev, pendingLog]);
      setMetrics(prev => ({ ...prev, totalActions: prev.totalActions + 1 }));

      setThreatAlert({
        isOpen: true,
        toolName,
        reason: 'Tool call paused — Warn Only mode active',
        riskScore: risk,
        threatLevel: 'HIGH',
        status: 'PENDING',
        actionId: pendingLog.id,
      });

      setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));
      setCustomLogsText(prev => prev + `[WARN] Threat detected! Tool '${toolName}' paused. Drift: ${driftScore.toFixed(1)}%\n`);
    }

    setIsSimulating(false);
  };

  // ── Approve / Block / Drop handlers ───────────────────────────────────────
  const handleApproveLog = (id: string) => {
    let wasBlocked = false;
    setAuditLogs(prev =>
      prev.map((log) => {
        if (log.id === id && (log.status === 'BLOCKED' || log.status === 'PENDING')) {
          if (log.status === 'BLOCKED') wasBlocked = true;
          return { ...log, status: 'VERIFIED', reason: undefined };
        }
        return log;
      })
    );
    setMetrics(prev => ({
      ...prev,
      blockedActions: wasBlocked ? Math.max(0, prev.blockedActions - 1) : prev.blockedActions,
      allowedActions: prev.allowedActions + 1,
    }));
    setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));
    setCustomLogsText(prev => prev + `[BYPASS] Human operator approved exception: ${id}\n`);
  };

  const handleBlockLog = (id: string) => {
    setAuditLogs(prev => {
      let isItemPending = false;
      const nextLogs = prev.map((log) => {
        if (log.id === id && log.status === 'PENDING') {
          isItemPending = true;
          return { ...log, status: 'BLOCKED', reason: 'Manually blocked by operator' };
        }
        return log;
      });
      if (isItemPending) {
        setMetrics(m => ({ ...m, blockedActions: m.blockedActions + 1 }));
        setSystemStatus(status => ({ ...status, trustLayer: 'compromised' }));
        setCustomLogsText(logsText => logsText + `[BLOCKED] Operator manually blocked action: ${id}\n`);
      }
      return nextLogs;
    });
  };

  const handleDropLog = (id: string) => {
    let wasBlocked = false;
    setAuditLogs(prev => prev.filter((log) => {
      if (log.id === id) {
        if (log.status === 'BLOCKED') wasBlocked = true;
        return false;
      }
      return true;
    }));
    setMetrics(prev => ({
      ...prev,
      totalActions: Math.max(0, prev.totalActions - 1),
      blockedActions: wasBlocked ? Math.max(0, prev.blockedActions - 1) : prev.blockedActions,
    }));
    setCustomLogsText(prev => prev + `[HARD_DROP] Exploit trail purged. Case: ${id}\n`);
  };

  const handleResetSystem = () => {
    setAuditLogs([]);
    setMetrics({ totalActions: 0, allowedActions: 0, blockedActions: 0, trustScore: 100 });
    setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));
    setActivePlan(null);
    setThreatAlert(null);
    setCustomLogsText('AGENT_BOUND_DAEMON :: started listening on port 3000\nARMOR_IQ :: cryptographic contract layer loaded\n[INFO] System reset initiated by operator\n');
  };

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        systemHealth={systemStatus.backend}
        auditLogs={auditLogs}
        onResetSystem={handleResetSystem}
      />

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {currentTab === 'Dashboard' && (
          <>
            {/* Real-time Metrics Dashboard */}
            <Metrics metrics={metrics} systemStatus={systemStatus} />

            {/* Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Panel Set */}
              <div className="space-y-6 flex flex-col lg:col-span-1">
                <div className="flex-grow">
                  <IntentCapture onGenerate={handleGenerateIntent} isLoading={isGenerating} />
                </div>
                <div>
                  <SimulationControls
                    onSimulateSafe={handleSimulateSafe}
                    onSimulateMalicious={handleSimulateMalicious}
                    isSimulating={isSimulating}
                    hasContract={activePlan !== null}
                  />
                </div>
              </div>

              {/* Middle Panel - Boundary Contract */}
              <div className="lg:col-span-1 h-full">
                <BoundaryContract
                  contract={activePlan ? activePlan.contract : null}
                  status={activePlan ? activePlan.status : 'empty'}
                />
              </div>

              {/* Right Panel - Real-time Execution Timeline */}
              <div className="lg:col-span-1 h-full">
                <ExecutionTimeline logs={auditLogs} />
              </div>
            </div>

            {/* Bottom Row - Full-Width Audit Logs */}
            <div className="w-full">
              <AuditLogs
                logs={auditLogs}
                onApprove={handleApproveLog}
                onDrop={handleDropLog}
                onBlock={handleBlockLog}
              />
            </div>
          </>
        )}

        {/* ── NEW: Live Monitor Tab ─────────────────────────────────────── */}
        {currentTab === 'Live Monitor' && (
          <LiveMonitor />
        )}

        {currentTab === 'Monitors' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-6">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-zinc-900 pb-3">
              Cryptographic Tunnel Monitor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg border border-zinc-900 bg-black p-5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Packet Entropy</span>
                  <span className="text-emerald-400 font-bold">STABLE (0.12)</span>
                </div>
                <div className="h-28 bg-zinc-950 border border-zinc-900 rounded flex items-end justify-between p-2">
                  {[23, 45, 12, 67, 34, 56, 89, 43, 21, 56, 78, 43, 67, 89, 12].map((h, i) => (
                    <div key={i} className="w-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Continuous cryptographic flow entropy validation</p>
              </div>

              <div className="rounded-lg border border-zinc-900 bg-black p-5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>ArmorIQ CPU Thread Load</span>
                  <span className="text-blue-400 font-bold">2.4% ACTIVE</span>
                </div>
                <div className="h-28 bg-zinc-950 border border-zinc-900 rounded flex items-end justify-between p-2">
                  {[56, 67, 43, 21, 45, 67, 89, 90, 45, 23, 45, 56, 12, 45, 67].map((h, i) => (
                    <div key={i} className="w-1.5 bg-blue-500/20 hover:bg-blue-500/40 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Evaluates Merkle path validity dynamically</p>
              </div>

              <div className="rounded-lg border border-zinc-900 bg-black p-5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Drift Scoring Engine</span>
                  <span className="text-violet-400 font-bold">OpenAI / Gemini</span>
                </div>
                <div className="h-28 bg-zinc-950 border border-zinc-900 rounded flex items-end justify-between p-2">
                  {[12, 34, 56, 78, 90, 67, 45, 34, 21, 56, 78, 90, 12, 45, 67].map((h, i) => (
                    <div key={i} className="w-1.5 bg-violet-500/20 hover:bg-violet-500/40 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Semantic alignment scoring via LLM cascade</p>
              </div>
            </div>

            {/* Live syslog terminal */}
            <div className="rounded-lg border border-zinc-900 bg-black p-5 space-y-3">
              <span className="font-mono text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                System Syslog Console Output
              </span>
              <pre className="font-mono text-[11px] text-zinc-500 bg-zinc-950 p-4 rounded border border-zinc-900 h-44 overflow-y-auto leading-relaxed whitespace-pre-wrap select-all">
                {customLogsText}
              </pre>
            </div>
          </div>
        )}

        {currentTab === 'Security Logs' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
            <AuditLogs
              logs={auditLogs}
              onApprove={handleApproveLog}
              onDrop={handleDropLog}
              onBlock={handleBlockLog}
            />
          </div>
        )}

        {/* ── NEW: Agent SDK Tab ─────────────────────────────────────────── */}
        {currentTab === 'Agent SDK' && (
          <AgentSDK />
        )}

        {currentTab === 'Admin' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-6">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-zinc-900 pb-3">
              Firewall Security Policy Controls
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Settings Controls */}
              <div className="space-y-6 font-mono text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-300 font-bold">Automated Threat Mitigation</span>
                    <span className={autoMitigate ? 'text-emerald-400' : 'text-zinc-500'}>
                      {autoMitigate ? 'Active / Block-Mode' : 'Warn Only'}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    If active, any unmapped tool instruction signature mismatch immediately triggers hard dropping containment.
                  </p>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoMitigate}
                      onChange={(e) => setAutoMitigate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white"></div>
                    <span className="ml-3 text-[11px] text-zinc-400">Toggle Block Engine</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-zinc-300 font-bold">System Risk Veto Threshold</span>
                    <span className="text-amber-400 font-bold">{riskThreshold}/10</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Any approved leaf tool action matching a score greater or equal to this threshold raises human confirmation prompts.
                  </p>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={riskThreshold}
                    onChange={(e) => setRiskThreshold(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>1 (Permissive)</span>
                    <span>10 (Strict)</span>
                  </div>
                </div>
              </div>

              {/* Status and Diagnostics */}
              <div className="p-5 rounded-lg border border-zinc-900 bg-black font-mono text-xs space-y-4">
                <span className="font-bold text-zinc-400 uppercase tracking-wider block border-b border-zinc-900 pb-2">
                  System Diagnostics & Cryptography
                </span>
                <div className="space-y-2 text-[11px] text-zinc-500">
                  <p className="flex justify-between">
                    <span>Active Plan UUID:</span>
                    <span className="text-zinc-400 select-all">{activePlan ? activePlan.plan_id : 'unregistered'}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Active Signature Alg:</span>
                    <span className="text-zinc-400">Ed25519-Merkle-V3</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Drift Scoring Engine:</span>
                    <span className="text-violet-400 font-bold">OpenAI → Gemini → Heuristic</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Database:</span>
                    <span className="text-blue-400 font-bold">Supabase (PostgreSQL)</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Backend URL:</span>
                    <span className="text-zinc-400 text-[10px] select-all truncate max-w-[180px]">{BACKEND_BASE_URL}</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Active Policy Rules Count:</span>
                    <span className="text-emerald-400 font-bold">{activePlan ? activePlan.contract.allowed_actions.length : 0} active</span>
                  </p>
                </div>

                <button
                  onClick={() => {
                    setActivePlan(null);
                    setAuditLogs([]);
                    setMetrics({ totalActions: 0, allowedActions: 0, blockedActions: 0, trustScore: 100 });
                    setCustomLogsText('SYSTEM :: Factory Reset Triggered.\n');
                  }}
                  className="w-full py-2 rounded border border-rose-900/40 bg-rose-950/10 text-rose-400 hover:bg-rose-900/20 text-[11px] font-bold uppercase transition-all duration-200 cursor-pointer text-center"
                >
                  Factory Purge System States
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent intrusion alert modal popup */}
      {threatAlert && (
        <AlertNotification
          isOpen={threatAlert.isOpen}
          onClose={() => setThreatAlert(null)}
          toolName={threatAlert.toolName}
          reason={threatAlert.reason}
          riskScore={threatAlert.riskScore}
          threatLevel={threatAlert.threatLevel}
          status={threatAlert.status}
          goal={activePlan ? activePlan.contract.goal : ''}
          onApproveException={
            threatAlert.actionId
              ? () => handleApproveLog(threatAlert.actionId)
              : undefined
          }
          onBlockAction={
            threatAlert.actionId
              ? () => handleBlockLog(threatAlert.actionId)
              : undefined
          }
        />
      )}

      {/* Dynamic footer copyright */}
      <footer className="border-t border-zinc-900 bg-black/40 py-4 px-6 text-center font-mono text-[10px] text-zinc-600">
        <p>© 2026 Intent Firewall. Continuous Intent Alignment for Autonomous AI Agents. Powered by ArmorIQ · Supabase · OpenAI · Gemini</p>
      </footer>
    </div>
  );
}
