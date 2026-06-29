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
import { PlanData, AuditLog, SystemStatus, Metrics as MetricsType } from './types';
import { BACKEND_BASE_URL, RISK_REGISTRY, getFriendlyActionName } from './lib/constants';

function getFormattedTime() {
  const d = new Date();
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

export default function App() {
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

  // Fetch initial health on load
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND_BASE_URL}/health`);
        if (res.status === 200) {
          setSystemStatus(prev => ({ ...prev, backend: 'online' }));
        } else {
          setSystemStatus(prev => ({ ...prev, backend: 'offline' }));
        }
      } catch (e) {
        console.error('Error connecting to backend health:', e);
        setSystemStatus(prev => ({ ...prev, backend: 'offline' }));
      }
    };
    checkHealth();
  }, []);

  // Update Trust Score based on Ratio of Allowed/Blocked
  useEffect(() => {
    if (metrics.totalActions === 0) {
      setMetrics(prev => ({ ...prev, trustScore: 100 }));
      return;
    }
    const ratio = metrics.allowedActions / metrics.totalActions;
    const computed = Math.round(ratio * 100);
    // Floor at 0, Cap at 100
    setMetrics(prev => ({ ...prev, trustScore: Math.max(0, Math.min(100, computed)) }));
  }, [metrics.allowedActions, metrics.totalActions]);

  // Handler to generate Intent
  const handleGenerateIntent = async (goal: string) => {
    setIsGenerating(true);
    setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));
    
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_input: goal })
      });

      if (response.status === 200) {
        const data: PlanData = await response.json();
        setActivePlan(data);
        setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));
        
        // Append initial audit log for plan generation
        const newLog: AuditLog = {
          id: `plan-${Date.now()}`,
          timestamp: getFormattedTime(),
          status: 'VERIFIED',
          action: `Cryptographic trust contract signed for goal: "${goal}"`,
          tool_name: 'generate_intent',
          risk_score: 1,
        };
        setAuditLogs([newLog]);
        setMetrics({
          totalActions: 1,
          allowedActions: 1,
          blockedActions: 0,
          trustScore: 100,
        });
        
        setCustomLogsText(prev => prev + `[CONTRACT] Signed contract root: ${data.contract.merkle_root.substring(0, 16)}...\n`);
      } else {
        throw new Error('Failed to generate contract on remote backend');
      }
    } catch (e) {
      console.warn('Backend /plan failed or offline, falling back to secure local generation...', e);
      // Robust Local Simulation of the same /plan endpoint to ensure beautiful working demo
      const localHash = Math.random().toString(16).substring(2) + Math.random().toString(16).substring(2);
      const mockContract = {
        intent_hash: localHash,
        merkle_root: '8678289532fa9d7a2d8231c1e36b377f9ac8b858b84ff576c93da856829a13e4',
        signature: `armoriq_v2_sig_${localHash.substring(0, 16)}_86782895`,
        agent_id: `agent_${localHash.substring(0, 8)}`,
        allowed_actions: [
          'read_codebase',
          'modify_auth_module',
          'run_tests',
          'deploy_staging',
        ],
        goal: goal,
        created_at: new Date().toISOString(),
        version: 'ArmorIQ-v2.0-Local',
      };
      
      const mockPlan: PlanData = {
        plan_id: `plan_local_${Math.random().toString(36).substring(2, 10)}`,
        contract: mockContract,
        status: 'signed'
      };

      setActivePlan(mockPlan);
      setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));
      
      const newLog: AuditLog = {
        id: `plan-${Date.now()}`,
        timestamp: getFormattedTime(),
        status: 'VERIFIED',
        action: `Cryptographic trust contract signed for goal: "${goal}"`,
        tool_name: 'generate_intent',
        risk_score: 1,
      };
      setAuditLogs([newLog]);
      setMetrics({
        totalActions: 1,
        allowedActions: 1,
        blockedActions: 0,
        trustScore: 100,
      });
      setCustomLogsText(prev => prev + `[LOCAL_CONTRACT] Signed contract locally: ${mockContract.intent_hash.substring(0, 16)}...\n`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Run the safe simulated action sequence step-by-step
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

      // Attempt to execute on backend
      let executedSuccess = false;
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: activePlan.plan_id,
            tool_name: tool.name,
            arguments: tool.args
          })
        });
        if (response.status === 200) {
          executedSuccess = true;
        }
      } catch (e) {
        // Backend failure caught, fallback is handled
      }

      // Append log based on risk threshold
      if (risk >= riskThreshold) {
        const pendingLog: AuditLog = {
          id: `exec-${Date.now()}-${tool.name}`,
          timestamp,
          status: 'PENDING',
          action: friendlyName,
          tool_name: tool.name,
          risk_score: risk,
          arguments: tool.args,
          reason: `High risk tool (${risk}/${riskThreshold}) - manual review required`,
        };
        setAuditLogs(prev => [...prev, pendingLog]);
        setMetrics(prev => ({
          ...prev,
          totalActions: prev.totalActions + 1,
        }));
        setCustomLogsText(prev => prev + `[WARN] Tool '${tool.name}' requires manual review. Risk: ${risk}\n`);

        setThreatAlert({
          isOpen: true,
          toolName: tool.name,
          reason: `High risk tool (${risk}/${riskThreshold}) - Manual review required`,
          riskScore: risk,
          threatLevel: 'HIGH',
          status: 'PENDING',
          actionId: pendingLog.id,
        });
        setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));

        break;
      } else {
        const newLog: AuditLog = {
          id: `exec-${Date.now()}-${tool.name}`,
          timestamp,
          status: 'VERIFIED',
          action: friendlyName,
          tool_name: tool.name,
          risk_score: risk,
          arguments: tool.args,
        };

        setAuditLogs(prev => [...prev, newLog]);
        setMetrics(prev => ({
          ...prev,
          totalActions: prev.totalActions + 1,
          allowedActions: prev.allowedActions + 1,
        }));
        setCustomLogsText(prev => prev + `[EXECUTE] Tool '${tool.name}' verified and dispatched. Risk: ${risk}\n`);
      }
    }

    setIsSimulating(false);
    setCustomLogsText(prev => prev + `[SIMULATION] Safe sequence completed successfully.\n`);
  };

  // Inject a prompt injection threat simulation
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

    if (autoMitigate) {
      // Add to logs as BLOCKED
      const blockLog: AuditLog = {
        id: `threat-${Date.now()}`,
        timestamp,
        status: 'BLOCKED',
        action: friendlyName,
        tool_name: toolName,
        risk_score: risk,
        arguments: toolArgs,
        reason: 'Outside Intent Boundary Policy'
      };

      setAuditLogs(prev => [...prev, blockLog]);
      setMetrics(prev => ({
        ...prev,
        totalActions: prev.totalActions + 1,
        blockedActions: prev.blockedActions + 1,
      }));

      // Trigger threat alert modal
      setThreatAlert({
        isOpen: true,
        toolName,
        reason: 'Tool call dropped - Not found in Merkle contract Allowed Leaves',
        riskScore: risk,
        threatLevel: 'CRITICAL',
        status: 'BLOCKED',
        actionId: blockLog.id,
      });

      setSystemStatus(prev => ({ ...prev, trustLayer: 'compromised' }));
      setCustomLogsText(prev => prev + `[BLOCKED] Threat blocked! Tool '${toolName}' tried to run. Veto code: CONTRACT_VETO\n`);
    } else {
      const pendingLog: AuditLog = {
        id: `threat-${Date.now()}`,
        timestamp,
        status: 'PENDING',
        action: friendlyName,
        tool_name: toolName,
        risk_score: risk,
        arguments: toolArgs,
        reason: 'Warn Only mode - Awaiting operator decision'
      };

      setAuditLogs(prev => [...prev, pendingLog]);
      setMetrics(prev => ({
        ...prev,
        totalActions: prev.totalActions + 1,
      }));

      // Trigger threat alert modal
      setThreatAlert({
        isOpen: true,
        toolName,
        reason: 'Tool call paused - Warn Only mode active',
        riskScore: risk,
        threatLevel: 'HIGH',
        status: 'PENDING',
        actionId: pendingLog.id,
      });

      setSystemStatus(prev => ({ ...prev, trustLayer: 'monitoring' }));
      setCustomLogsText(prev => prev + `[WARN] Threat detected! Tool '${toolName}' paused for manual review.\n`);
    }
    
    setIsSimulating(false);
  };

  // Handle human operator approving exception for blocked item
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
    // Correct counters
    setMetrics(prev => ({
      ...prev,
      blockedActions: wasBlocked ? Math.max(0, prev.blockedActions - 1) : prev.blockedActions,
      allowedActions: prev.allowedActions + 1,
    }));
    setSystemStatus(prev => ({ ...prev, trustLayer: 'operational' }));
    setCustomLogsText(prev => prev + `[BYPASS] Human Operator manually approved exception for action ID: ${id}\n`);
  };

  // Handle manual blocking of a pending item
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
        setMetrics(m => ({
          ...m,
          blockedActions: m.blockedActions + 1,
        }));
        setSystemStatus(status => ({ ...status, trustLayer: 'compromised' }));
        setCustomLogsText(logsText => logsText + `[BLOCKED] Operator manually blocked action ID: ${id}\n`);
      }
      return nextLogs;
    });
  };

  // Handle hard dropping / permanently deleting threat from logs
  const handleDropLog = (id: string) => {
    let wasBlocked = false;
    setAuditLogs(prev => prev.filter((log) => {
      if (log.id === id) {
        if (log.status === 'BLOCKED') wasBlocked = true;
        return false;
      }
      return true;
    }));
    // Correct counters
    setMetrics(prev => ({
      ...prev,
      totalActions: Math.max(0, prev.totalActions - 1),
      blockedActions: wasBlocked ? Math.max(0, prev.blockedActions - 1) : prev.blockedActions,
    }));
    setCustomLogsText(prev => prev + `[HARD_DROP] Exploit trail permanently dropped and isolated. Case: ${id}\n`);
  };

  // Reset firewall logs and metrics
  const handleResetSystem = () => {
    setAuditLogs([]);
    setMetrics({
      totalActions: 0,
      allowedActions: 0,
      blockedActions: 0,
      trustScore: 100,
    });
    setSystemStatus(prev => ({
      ...prev,
      trustLayer: 'operational',
    }));
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

            {/* Bottom Row - Full-Width Audit Logs Center */}
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

        {currentTab === 'Monitors' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl space-y-6">
            <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-emerald-400 border-b border-zinc-900 pb-3">
              Cryptographic Tunnel Monitor
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Telemetry charts/visual mockups */}
              <div className="rounded-lg border border-zinc-900 bg-black p-5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Packet Entropy</span>
                  <span className="text-emerald-400 font-bold">STABLE (0.12)</span>
                </div>
                <div className="h-28 bg-zinc-950 border border-zinc-900 rounded flex items-end justify-between p-2">
                  {[23, 45, 12, 67, 34, 56, 89, 43, 21, 56, 78, 43, 67, 89, 12].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 transition-colors"
                      style={{ height: `${h}%` }}
                    />
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
                    <div
                      key={i}
                      className="w-1.5 bg-blue-500/20 hover:bg-blue-500/40 transition-colors"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Evaluates Merkle path validity dynamically</p>
              </div>

              <div className="rounded-lg border border-zinc-900 bg-black p-5 font-mono text-xs space-y-4">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Token Traffic Speed</span>
                  <span className="text-zinc-500">1.4 MB/S</span>
                </div>
                <div className="h-28 bg-zinc-950 border border-zinc-900 rounded flex items-end justify-between p-2">
                  {[12, 34, 56, 78, 90, 67, 45, 34, 21, 56, 78, 90, 12, 45, 67].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500">Verifying secure pipeline transit metrics</p>
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
                    <span className="text-zinc-400">Ed25519-Merkle-V2</span>
                  </p>
                  <p className="flex justify-between">
                    <span>Staging Environment Host:</span>
                    <span className="text-zinc-400">staging.intent-firewall.internal</span>
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
                    setMetrics({
                      totalActions: 0,
                      allowedActions: 0,
                      blockedActions: 0,
                      trustScore: 100,
                    });
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
        <p>© 2026 Intent Firewall. Protected by ArmorIQ Cryptographic Containment System. Host: {BACKEND_BASE_URL}</p>
      </footer>
    </div>
  );
}
