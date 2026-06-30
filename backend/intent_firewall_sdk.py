"""
Intent Firewall SDK — Python Client
Compatible with: Antigravity, Claude Code, OpenHands, Cursor, Devin-style agents.

Usage:
    from intent_firewall_sdk import IntentFirewall, SecurityBoundaryViolation

    fw = IntentFirewall()
    intent = fw.capture("Fix the login authentication bug")

    # Before every tool call:
    fw.verify(intent.intent_id, "read_codebase")        # ✓ allowed
    fw.verify(intent.intent_id, "drop_database")        # ✗ raises SecurityBoundaryViolation
"""

import os
import requests
from dataclasses import dataclass
from typing import Optional


BASE_URL = os.getenv("INTENT_FIREWALL_URL", "https://intent-firewall.onrender.com")


# ── Exceptions ────────────────────────────────────────────────────────────────

class SecurityBoundaryViolation(Exception):
    """Raised when an action is blocked by the Intent Firewall."""
    def __init__(self, action: str, reason: str, risk_score: int, drift_score: float):
        self.action = action
        self.reason = reason
        self.risk_score = risk_score
        self.drift_score = drift_score
        super().__init__(
            f"[IntentFirewall] BLOCKED: '{action}' | Drift: {drift_score:.1f}% | {reason}"
        )


class PendingApprovalRequired(Exception):
    """Raised when an action needs human review before proceeding."""
    def __init__(self, action: str, reason: str, risk_score: int, drift_score: float, audit_id: str):
        self.action = action
        self.reason = reason
        self.risk_score = risk_score
        self.drift_score = drift_score
        self.audit_id = audit_id
        super().__init__(
            f"[IntentFirewall] PENDING: '{action}' | Risk: {risk_score}/10 | Drift: {drift_score:.1f}% | {reason}"
        )


# ── Data Classes ──────────────────────────────────────────────────────────────

@dataclass
class CapturedIntent:
    intent_id: str
    intent_hash: str
    signature: str
    merkle_root: str
    allowed_actions: list
    goal: str
    agent_id: str
    version: str

    def __repr__(self):
        return f"CapturedIntent(id={self.intent_id[:12]}..., goal='{self.goal}', actions={self.allowed_actions})"


@dataclass
class VerifyResult:
    status: str          # "allowed" | "pending_review" | "blocked"
    action: str
    risk_score: int
    drift_score: float
    drift_verdict: str
    reason: str
    audit_id: str


# ── Main Client ───────────────────────────────────────────────────────────────

class IntentFirewall:
    """
    Runtime trust layer for autonomous AI agents.
    
    Place this middleware between your agent and its tool calls.
    Every action is verified against a cryptographically signed intent contract.
    
    Example (Antigravity agent pattern):
        fw = IntentFirewall()
        intent = fw.capture("Fix the login authentication bug")
        
        def safe_tool_call(tool_name: str, **args):
            fw.verify(intent.intent_id, tool_name, args=args)
            return actual_tool_call(tool_name, **args)
    """

    def __init__(self, base_url: str = BASE_URL, timeout: int = 10):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._session = requests.Session()

    # ── Intent Capture ────────────────────────────────────────────────────────

    def capture(
        self,
        goal: str,
        plan: Optional[list] = None,
        agent_id: Optional[str] = None,
    ) -> CapturedIntent:
        """
        Sign the agent's intent with ArmorIQ.
        
        Args:
            goal: Natural language description of what the agent should accomplish.
            plan: Optional explicit list of allowed tool names.
            agent_id: Optional identifier for this agent instance.
            
        Returns:
            CapturedIntent with intent_id, signature, and allowed_actions.
        """
        payload = {"goal": goal}
        if plan:
            payload["plan"] = plan
        if agent_id:
            payload["agent_id"] = agent_id

        resp = self._session.post(
            f"{self.base_url}/capture-intent",
            json=payload,
            timeout=self.timeout
        )
        resp.raise_for_status()
        data = resp.json()

        return CapturedIntent(
            intent_id=data["intent_id"],
            intent_hash=data["intent_hash"],
            signature=data["signature"],
            merkle_root=data["merkle_root"],
            allowed_actions=data["allowed_actions"],
            goal=data["goal"],
            agent_id=data["agent_id"],
            version=data["version"],
        )

    # ── Action Verification ───────────────────────────────────────────────────

    def verify(
        self,
        intent_id: str,
        action: str,
        args: Optional[dict] = None,
        description: Optional[str] = None,
        raise_on_block: bool = True,
        raise_on_pending: bool = False,
    ) -> VerifyResult:
        """
        Verify a tool call against the signed intent contract.
        
        Args:
            intent_id: The intent_id returned by capture().
            action: Tool name to verify (e.g., "read_codebase", "drop_database").
            args: Optional tool arguments for audit trail.
            description: Human-readable description of the action for drift scoring.
            raise_on_block: If True (default), raise SecurityBoundaryViolation on blocked.
            raise_on_pending: If True, raise PendingApprovalRequired on pending_review.
            
        Returns:
            VerifyResult with status, risk_score, drift_score.
            
        Raises:
            SecurityBoundaryViolation: If the action is blocked.
            PendingApprovalRequired: If the action needs human approval (and raise_on_pending=True).
        """
        payload = {
            "intent_id": intent_id,
            "action": action,
        }
        if args:
            payload["args"] = args
        if description:
            payload["description"] = description

        resp = self._session.post(
            f"{self.base_url}/verify-action",
            json=payload,
            timeout=self.timeout
        )
        resp.raise_for_status()
        data = resp.json()

        result = VerifyResult(
            status=data["status"],
            action=data["action"],
            risk_score=data["risk_score"],
            drift_score=data["drift_score"],
            drift_verdict=data["drift_verdict"],
            reason=data["reason"],
            audit_id=data["audit_id"],
        )

        if result.status == "blocked" and raise_on_block:
            raise SecurityBoundaryViolation(
                action=action,
                reason=result.reason,
                risk_score=result.risk_score,
                drift_score=result.drift_score,
            )

        if result.status == "pending_review" and raise_on_pending:
            raise PendingApprovalRequired(
                action=action,
                reason=result.reason,
                risk_score=result.risk_score,
                drift_score=result.drift_score,
                audit_id=result.audit_id,
            )

        return result

    # ── Convenience: Guarded Tool Call ───────────────────────────────────────

    def guarded(self, intent_id: str, action: str, func, *args, fw_args: dict = None, **kwargs):
        """
        Convenience wrapper: verify then call func if allowed.
        
        Example:
            result = fw.guarded(intent.intent_id, "read_codebase", read_codebase_fn, "auth.py")
        """
        self.verify(intent_id, action, args=fw_args or {})
        return func(*args, **kwargs)

    # ── Health Check ─────────────────────────────────────────────────────────

    def health(self) -> bool:
        """Returns True if the Intent Firewall backend is reachable."""
        try:
            r = self._session.get(f"{self.base_url}/health", timeout=5)
            return r.ok
        except Exception:
            return False

    # ── Audit Trail ──────────────────────────────────────────────────────────

    def get_audit_logs(self, limit: int = 50) -> list:
        """Fetch recent audit events from Supabase."""
        resp = self._session.get(
            f"{self.base_url}/audit-logs?limit={limit}",
            timeout=self.timeout
        )
        resp.raise_for_status()
        return resp.json().get("logs", [])


# ── Demo / Test script ────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Intent Firewall SDK — Demo ===\n")
    
    fw = IntentFirewall()
    
    print(f"Backend health: {fw.health()}\n")
    
    # Step 1: Capture intent
    print("Step 1: Capturing intent...")
    intent = fw.capture(
        goal="Fix the login authentication bug",
        plan=["read_codebase", "modify_auth_module", "run_tests", "deploy_staging"]
    )
    print(f"  Intent ID: {intent.intent_id}")
    print(f"  Signature: {intent.signature[:40]}...")
    print(f"  Allowed: {intent.allowed_actions}\n")
    
    # Step 2: Verify safe actions
    print("Step 2: Verifying safe actions...")
    for action in ["read_codebase", "modify_auth_module", "run_tests"]:
        result = fw.verify(intent.intent_id, action)
        print(f"  {action}: {result.status} | Risk: {result.risk_score}/10 | Drift: {result.drift_score:.1f}%")
    
    # Step 3: Attack simulation
    print("\nStep 3: Attack simulation...")
    try:
        fw.verify(intent.intent_id, "drop_database", args={"schema": "production_customer_data"})
    except SecurityBoundaryViolation as e:
        print(f"  BLOCKED: {e}")
