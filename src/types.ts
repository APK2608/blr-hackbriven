/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Contract {
  intent_hash: string;
  merkle_root: string;
  signature: string;
  agent_id: string;
  allowed_actions: string[];
  goal: string;
  created_at: string;
  version: string;
}

export interface PlanData {
  plan_id: string;
  contract: Contract;
  status: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  status: 'VERIFIED' | 'BLOCKED' | 'PENDING';
  action: string;
  tool_name: string;
  risk_score: number;
  reason?: string;
  arguments?: Record<string, any>;
}

export interface SystemStatus {
  backend: 'online' | 'offline' | 'loading';
  armoriq: 'active' | 'inactive';
  trustLayer: 'operational' | 'compromised' | 'monitoring';
}

export interface Metrics {
  totalActions: number;
  allowedActions: number;
  blockedActions: number;
  trustScore: number;
}
