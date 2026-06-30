/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed API client for the Intent Firewall backend.
 * All agent-facing calls (capture-intent, verify-action) go through here.
 */

import { BACKEND_BASE_URL } from './constants';
import type {
  CaptureIntentRequest,
  CaptureIntentResponse,
  VerifyActionRequest,
  VerifyActionResponse,
} from '../types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`POST ${path} failed ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed ${res.status}`);
  return res.json() as Promise<T>;
}

// ── Intent Capture ────────────────────────────────────────────────────────────

/** Signs an agent's intent with ArmorIQ. Returns intent_id + signature. */
export async function captureIntent(req: CaptureIntentRequest): Promise<CaptureIntentResponse> {
  return post<CaptureIntentResponse>('/capture-intent', req);
}

// ── Action Verification ───────────────────────────────────────────────────────

/**
 * Verify a single tool call against a signed intent.
 * Returns allowed | pending_review | blocked with risk + drift scores.
 */
export async function verifyAction(req: VerifyActionRequest): Promise<VerifyActionResponse> {
  return post<VerifyActionResponse>('/verify-action', req);
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  intent_id?: string;
  plan_id?: string;
  tool_name: string;
  action?: string;
  status: string;
  risk_score: number;
  drift_score?: number;
  reason?: string;
  timestamp: string;
}

export async function getAuditLogs(limit = 50, offset = 0): Promise<{ logs: AuditLogEntry[]; total: number }> {
  return get<{ logs: AuditLogEntry[]; total: number }>(
    `/audit-logs?limit=${limit}&offset=${offset}`
  );
}

// ── SDK Info ─────────────────────────────────────────────────────────────────

export async function getSdkInfo(): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>('/sdk-info');
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_BASE_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
