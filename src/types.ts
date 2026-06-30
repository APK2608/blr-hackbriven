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
  drift_score?: number;       // NEW: semantic drift 0–100
  drift_verdict?: string;     // NEW: "aligned" | "review_required" | "drifted"
  drift_reason?: string;      // NEW: explanation of drift
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

// ── NEW: Real API types ───────────────────────────────────────────────────────

export interface CaptureIntentRequest {
  goal: string;
  plan?: string[];
  agent_id?: string;
  metadata?: Record<string, any>;
}

export interface CaptureIntentResponse {
  intent_id: string;
  intent_hash: string;
  signature: string;
  merkle_root: string;
  allowed_actions: string[];
  agent_id: string;
  goal: string;
  created_at: string;
  version: string;
}

export interface VerifyActionRequest {
  intent_id: string;
  action: string;
  args?: Record<string, any>;
  description?: string;
}

export interface VerifyActionResponse {
  status: 'allowed' | 'pending_review' | 'blocked';
  action: string;
  intent_id: string;
  risk_score: number;
  drift_score: number;
  drift_verdict: string;
  drift_reason: string;
  reason: string;
  audit_id: string;
  timestamp: string;
}
