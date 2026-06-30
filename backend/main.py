"""
Intent Firewall — Real Runtime Trust Layer
FastAPI Backend v4.0

Endpoints:
  POST /capture-intent        → ArmorIQ sign original intent
  POST /verify-action         → verify tool call (risk + drift)
  POST /track-browser-action  → Chrome extension: verify real browser actions (NEW)
  GET  /events/stream         → SSE live event stream for dashboard (NEW)
  GET  /audit-logs            → paginated audit trail
  GET  /health                → liveness
"""

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json
import asyncio
from datetime import datetime
from collections import deque

# Local imports
from database import db
from ai_agent import generate_execution_boundary
from armoriq_service import generate_intent_contract, verify_action_against_contract
from drift_scorer import score_drift

# Coding agent tools (includes risk scores)
from tools.coding_tools import (
    read_codebase, modify_auth_module, run_tests, deploy_staging,
    push_to_production, drop_database, delete_records, access_customer_data,
    search_flights, search_hotels, create_itinerary, book_ticket, send_payment,
    read_files, write_report, TOOL_RISK_SCORES
)

app = FastAPI(
    title="Intent Firewall — Runtime Trust Layer",
    description=(
        "Continuous Intent Alignment for Autonomous AI Agents. "
        "Not an AI assistant. Not a coding agent. "
        "A trust layer for autonomous systems."
    ),
    version="3.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Tool Registry ─────────────────────────────────────────────────────────────
TOOL_REGISTRY = {
    "read_codebase": read_codebase,
    "modify_auth_module": modify_auth_module,
    "run_tests": run_tests,
    "deploy_staging": deploy_staging,
    "push_to_production": push_to_production,
    "drop_database": drop_database,
    "delete_records": delete_records,
    "access_customer_data": access_customer_data,
    "search_flights": search_flights,
    "search_hotels": search_hotels,
    "create_itinerary": create_itinerary,
    "book_ticket": book_ticket,
    "send_payment": send_payment,
    "read_files": read_files,
    "write_report": write_report,
    # Generic action names (used by external agents)
    "read_file": read_codebase,
    "modify_file": modify_auth_module,
    "run_test": run_tests,
    "deploy": deploy_staging,
}

HIGH_RISK_THRESHOLD = 7

# ── In-Memory SSE Event Bus ───────────────────────────────────────────────────
# Stores recent events for the live dashboard stream
_event_bus: deque = deque(maxlen=500)
_sse_subscribers: List[asyncio.Queue] = []

def _emit_event(event: dict):
    """Broadcast an event to all SSE subscribers and event bus."""
    _event_bus.appendleft(event)
    for q in list(_sse_subscribers):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass

# Browser action risk scores
BROWSER_RISK_SCORES = {
    "navigate_url":       2,
    "search_product":     1,
    "click_element":      1,
    "add_to_cart":        4,
    "navigate_checkout":  6,
    "click_place_order":  9,
    "submit_payment":     10,
    "submit_form":        3,
    "click_login":        3,
    "delete_request":     9,
    "click_destructive":  8,
    "download_file":      5,
}


# ── Request / Response Models ─────────────────────────────────────────────────

class PlanRequest(BaseModel):
    user_input: str

class ExecuteRequest(BaseModel):
    plan_id: str
    tool_name: str
    arguments: dict = {}

class ApprovalRequest(BaseModel):
    action_id: str
    approve: bool
    reviewed_by: str = "human_operator"

# ── NEW: Capture Intent ────────────────────────────────────────────────────────

class CaptureIntentRequest(BaseModel):
    goal: str
    plan: Optional[list[str]] = None          # optional list of planned action names
    agent_id: Optional[str] = None
    metadata: Optional[dict] = {}

class CaptureIntentResponse(BaseModel):
    intent_id: str
    intent_hash: str
    signature: str
    merkle_root: str
    allowed_actions: list[str]
    agent_id: str
    goal: str
    created_at: str
    expires_at: Optional[str] = None
    version: str

# ── NEW: Verify Action ─────────────────────────────────────────────────────────

class VerifyActionRequest(BaseModel):
    intent_id: str
    action: str                               # tool name
    args: Optional[dict] = {}
    description: Optional[str] = None        # human-readable description for drift scoring

class VerifyActionResponse(BaseModel):
    status: str                               # "allowed" | "pending_review" | "blocked"
    action: str
    intent_id: str
    risk_score: int
    drift_score: float
    drift_verdict: str
    drift_reason: str
    reason: str
    audit_id: str
    timestamp: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat()

def _load_contract(raw_intent):
    if isinstance(raw_intent, str):
        return json.loads(raw_intent)
    if isinstance(raw_intent, dict):
        return raw_intent
    return {}

def _safe_insert_audit(record: dict):
    """Insert into audit_events table with graceful fallback."""
    try:
        db.table("audit_events").insert(record).execute()
    except Exception:
        # Fall back silently to in-memory
        try:
            db.table("blocked_actions").insert(record).execute()
        except Exception:
            pass



# ── NEW: Browser Action (Chrome Extension) ────────────────────────────────────

class BrowserActionRequest(BaseModel):
    intent_id: str
    action: str                         # e.g. "navigate_url", "add_to_cart", "submit_payment"
    url: str                            # full URL where the action occurred
    details: Optional[dict] = {}        # hostname, element_text, page_title, etc.
    timestamp: Optional[str] = None


# ── Root & Health ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "service": "Intent Firewall — Runtime Trust Layer",
        "version": "4.0.0",
        "tagline": "Continuous Intent Alignment for Autonomous AI Agents",
        "status": "operational",
        "armoriq": "active",
        "endpoints": {
            "capture_intent": "POST /capture-intent",
            "verify_action":  "POST /verify-action",
            "track_browser":  "POST /track-browser-action",
            "live_stream":    "GET /events/stream",
            "audit_logs":     "GET /audit-logs",
            "health":         "GET /health",
            "docs":           "GET /docs"
        }
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": _now(),

        "armoriq_version": "3.0.0",
        "trust_layer": "operational"
    }


# ── NEW ENDPOINT 1: Capture Intent ───────────────────────────────────────────

@app.post("/capture-intent", response_model=CaptureIntentResponse)
async def capture_intent(request: CaptureIntentRequest):
    """
    Step 1 — Intent Capture & Cryptographic Signing.

    Accepts the agent's goal and optional plan. Generates a cryptographically
    signed intent contract via ArmorIQ. Returns intent_id + signature that
    must be passed to /verify-action for every subsequent tool call.

    Compatible with: Antigravity, Claude Code, Cursor, OpenHands, Devin-style agents.
    """
    # Generate execution boundary from goal
    if request.plan and len(request.plan) > 0:
        # Agent explicitly provided its plan — trust it but validate
        allowed_actions = request.plan
        goal = request.goal
    else:
        # Derive boundary from natural language goal using LLM
        boundary = generate_execution_boundary(request.goal)
        goal = boundary["goal"]
        allowed_actions = boundary["allowed_actions"]

    # ArmorIQ cryptographic signing
    contract = generate_intent_contract(goal, allowed_actions)

    intent_id = str(uuid.uuid4())
    ts = _now()

    # Persist to Supabase (plans table)
    db.table("plans").insert({
        "id": intent_id,
        "user_id": request.agent_id or "agent_anonymous",
        "goal": goal,
        "intent_hash": contract["intent_hash"],
        "merkle_root": contract["merkle_root"],
        "signature": contract["signature"],
        "agent_id": contract["agent_id"],
        "intent": json.dumps(contract),
        "status": "active",
        "created_at": ts
    }).execute()

    # Audit: capture event
    _safe_insert_audit({
        "id": str(uuid.uuid4()),
        "intent_id": intent_id,
        "plan_id": intent_id,
        "tool_name": "capture_intent",
        "action": f"Intent signed for goal: \"{goal}\"",
        "status": "allowed",
        "risk_score": 0,
        "drift_score": 100.0,
        "reason": "Initial intent contract created and signed by ArmorIQ",
        "timestamp": ts
    })

    return CaptureIntentResponse(
        intent_id=intent_id,
        intent_hash=contract["intent_hash"],
        signature=contract["signature"],
        merkle_root=contract["merkle_root"],
        allowed_actions=allowed_actions,
        agent_id=contract["agent_id"],
        goal=goal,
        created_at=ts,
        version=contract.get("version", "ArmorIQ-v3.0")
    )


# ── NEW ENDPOINT 2: Verify Action ────────────────────────────────────────────

@app.post("/verify-action", response_model=VerifyActionResponse)
async def verify_action(request: VerifyActionRequest):
    """
    Step 2 — Real-time Action Verification.

    Every tool call from an autonomous agent MUST pass through this endpoint.
    Returns: allowed | pending_review | blocked

    Decision logic:
    1. Is the action in the signed allowed_actions list? (ArmorIQ boundary check)
    2. What is the risk score?
    3. What is the semantic drift from the original goal?

    Called by: Antigravity agents, Claude Code, Cursor, OpenHands, Devin-style agents.
    """
    audit_id = str(uuid.uuid4())
    ts = _now()

    # 1. Fetch the signed intent contract
    plan_query = db.table("plans").select("intent", "goal").eq("id", request.intent_id).execute()
    if not plan_query.data:
        raise HTTPException(status_code=404, detail=f"Intent contract '{request.intent_id}' not found. Call POST /capture-intent first.")

    raw = plan_query.data[0]
    contract = _load_contract(raw.get("intent", "{}"))
    goal = raw.get("goal") or contract.get("goal", "")
    allowed_actions = contract.get("allowed_actions", [])

    # 2. ArmorIQ boundary check — is the action in the signed contract?
    is_authorized = verify_action_against_contract(request.action, allowed_actions)

    # 3. Risk score
    risk_score = TOOL_RISK_SCORES.get(request.action, 5)

    # 4. Semantic drift score (OpenAI primary → Gemini fallback → heuristic)
    action_description = request.description or request.action.replace("_", " ")
    drift_result = score_drift(goal, action_description)
    drift_score = drift_result["alignment"]
    drift_verdict = drift_result["verdict"]
    drift_reason = drift_result["reason"]

    # ── DECISION ENGINE ───────────────────────────────────────────────────────

    if not is_authorized:
        # Outside intent boundary → BLOCKED
        status = "blocked"
        reason = f"Action '{request.action}' is not in the signed ArmorIQ intent contract. Allowed: {allowed_actions}"

    elif drift_score < 30.0:
        # Severe semantic drift → BLOCKED (potential prompt injection / goal hijacking)
        status = "blocked"
        reason = f"Intent drift detected: {drift_score:.1f}% alignment. Below 30% threshold — action blocked as potentially adversarial."

    elif risk_score >= HIGH_RISK_THRESHOLD:
        # High-risk but authorized → PENDING (human approval required)
        status = "pending_review"
        reason = f"High-risk action (risk: {risk_score}/10) requires human approval before execution."

    elif drift_score < 70.0:
        # Moderate drift → PENDING (semantic misalignment)
        status = "pending_review"
        reason = f"Intent alignment {drift_score:.1f}% is below 70% threshold — human review required."

    else:
        # Authorized + low risk + aligned → ALLOWED
        status = "allowed"
        reason = f"Action verified: in contract, risk {risk_score}/10, alignment {drift_score:.1f}%."

    # 5. Persist audit event
    audit_record = {
        "id": audit_id,
        "intent_id": request.intent_id,
        "plan_id": request.intent_id,
        "tool_name": request.action,
        "action": action_description,
        "status": status,
        "risk_score": risk_score,
        "drift_score": drift_score,
        "reason": reason,
        "arguments": json.dumps(request.args or {}),
        "timestamp": ts
    }
    _safe_insert_audit(audit_record)
    _emit_event({**audit_record, "source": "agent"})   # stream to Live Monitor

    return VerifyActionResponse(
        status=status,
        action=request.action,
        intent_id=request.intent_id,
        risk_score=risk_score,
        drift_score=drift_score,
        drift_verdict=drift_verdict,
        drift_reason=drift_reason,
        reason=reason,
        audit_id=audit_id,
        timestamp=ts
    )


# ── NEW ENDPOINT 3: Track Browser Action (Chrome Extension) ──────────────────

@app.post("/track-browser-action")
async def track_browser_action(request: BrowserActionRequest):
    """
    Called by the Intent Firewall Chrome Extension for EVERY browser action
    (navigations, clicks, form submissions, XHR calls).

    Verifies the browser action against the signed intent contract using the
    same 3-factor engine: boundary check + risk + semantic drift.

    Returns: allowed | pending_review | blocked
    The extension uses this to either permit or cancel the browser action.
    """
    audit_id = str(uuid.uuid4())
    ts = request.timestamp or _now()

    # 1. Fetch signed intent contract
    plan_query = db.table("plans").select("intent", "goal").eq("id", request.intent_id).execute()
    if not plan_query.data:
        # Graceful: if intent not found, allow but flag as unmonitored
        return {
            "status": "unmonitored",
            "action": request.action,
            "intent_id": request.intent_id,
            "risk_score": 0,
            "drift_score": 100.0,
            "reason": "No active intent contract found — action unmonitored",
            "audit_id": audit_id,
            "timestamp": ts
        }

    raw = plan_query.data[0]
    contract = _load_contract(raw.get("intent", "{}"))
    goal = raw.get("goal") or contract.get("goal", "")
    allowed_actions = contract.get("allowed_actions", [])

    # 2. ArmorIQ boundary check
    # For browser actions we use a permissive check: either the action matches exactly
    # OR the allowed_actions list contains generic browser action names
    browser_allowed = [
        "navigate_url", "search_product", "click_element", "add_to_cart",
        "navigate_checkout", "submit_form", "click_login"
    ]
    generic_browser_allowed = any(a in allowed_actions for a in browser_allowed) or \
                              any("navigate" in a or "click" in a or "search" in a for a in allowed_actions)
    is_authorized = request.action in allowed_actions or \
                    request.action in browser_allowed or \
                    generic_browser_allowed

    # 3. Risk score for browser actions
    risk_score = BROWSER_RISK_SCORES.get(request.action, 2)

    # 4. Semantic drift — build description from URL + action + details
    hostname = request.details.get("hostname", "") or (request.url.split("/")[2] if "://" in request.url else request.url[:50])
    page_title = request.details.get("page_title", "")
    element_text = request.details.get("element_text", "")
    action_description = f"{request.action.replace('_', ' ')} on {hostname}"
    if element_text:
        action_description += f" — {element_text[:60]}"
    if page_title:
        action_description += f" ({page_title[:40]})"

    drift_result = score_drift(goal, action_description)
    drift_score = drift_result["alignment"]
    drift_verdict = drift_result["verdict"]
    drift_reason = drift_result["reason"]

    # 5. Decision engine
    if not is_authorized and risk_score >= 7:
        status = "blocked"
        reason = f"High-risk action '{request.action}' not in intent contract."
    elif drift_score < 20.0:
        status = "blocked"
        reason = f"Severe intent drift ({drift_score:.1f}%). Possible prompt injection or goal hijacking."
    elif risk_score >= HIGH_RISK_THRESHOLD:
        status = "pending_review"
        reason = f"High-risk browser action (risk {risk_score}/10) — requires human approval."
    elif drift_score < 60.0:
        status = "pending_review"
        reason = f"Moderate drift ({drift_score:.1f}%) — action may be outside scope."
    else:
        status = "allowed"
        reason = f"Browser action verified: risk {risk_score}/10, alignment {drift_score:.1f}%."

    # 6. Build audit record + emit to SSE stream
    audit_record = {
        "id": audit_id,
        "intent_id": request.intent_id,
        "plan_id": request.intent_id,
        "tool_name": request.action,
        "action": action_description,
        "url": request.url,
        "hostname": hostname,
        "source": "browser_extension",
        "status": status,
        "risk_score": risk_score,
        "drift_score": drift_score,
        "drift_verdict": drift_verdict,
        "reason": reason,
        "arguments": json.dumps(request.details or {}),
        "timestamp": ts
    }

    _safe_insert_audit(audit_record)
    _emit_event(audit_record)   # Push to SSE live stream

    return {
        "status": status,
        "action": request.action,
        "intent_id": request.intent_id,
        "risk_score": risk_score,
        "drift_score": drift_score,
        "drift_verdict": drift_verdict,
        "drift_reason": drift_reason,
        "reason": reason,
        "audit_id": audit_id,
        "timestamp": ts
    }


# ── NEW ENDPOINT 4: SSE Live Event Stream ────────────────────────────────────

@app.get("/events/stream")
async def sse_event_stream(request: Request):
    """
    Server-Sent Events stream for the Live Monitor dashboard tab.

    The dashboard connects once and receives all browser + agent events
    in real-time as they are verified by the firewall.

    Usage (JS):
        const es = new EventSource('http://localhost:8000/events/stream');
        es.onmessage = (e) => { const event = JSON.parse(e.data); ... };

    Events include: navigation, clicks, form submissions, tool calls.
    Each event has: action, url, status, risk_score, drift_score, reason.
    """
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _sse_subscribers.append(queue)

    # Send last 20 buffered events immediately on connect
    recent = list(_event_bus)[:20]

    async def event_generator():
        try:
            # 1. Send buffered history on connect
            yield f"data: {json.dumps({'type': 'history', 'events': recent})}\n\n"

            # 2. Keep connection alive + stream new events
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat to keep connection alive
                    yield f"data: {json.dumps({'type': 'heartbeat', 'timestamp': _now()})}\n\n"
        finally:
            if queue in _sse_subscribers:
                _sse_subscribers.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",     # disable nginx buffering
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
        }
    )


# ── NEW ENDPOINT 5: Global Audit Logs ────────────────────────────────────────

@app.get("/audit-logs")
async def get_global_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    intent_id: Optional[str] = None
):
    """
    Global audit trail across all agents and intents.
    Dashboard polls this for live monitoring.
    """
    try:
        if intent_id:
            result = (
                db.table("audit_events")
                .select("*")
                .eq("intent_id", intent_id)
                .order("timestamp")
                .execute()
            )
        else:
            result = (
                db.table("audit_events")
                .select("*")
                .order("timestamp")
                .execute()
            )
        logs = result.data or []
    except Exception:
        # Fallback: try blocked_actions + executions tables
        try:
            blocked = db.table("blocked_actions").select("*").order("timestamp").execute()
            execs = db.table("executions").select("*").order("timestamp").execute()
            logs = list(blocked.data or []) + list(execs.data or [])
            logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
        except Exception:
            logs = []

    # Apply limit/offset
    total = len(logs)
    paged = logs[offset: offset + limit]

    return {"logs": paged, "total": total, "limit": limit, "offset": offset}


# ── NEW ENDPOINT 4: Intent Details ───────────────────────────────────────────

@app.get("/intents/{intent_id}")
async def get_intent_details(intent_id: str):
    """Retrieve the full signed intent contract."""
    plan_query = db.table("plans").select("*").eq("id", intent_id).execute()
    if not plan_query.data:
        raise HTTPException(status_code=404, detail="Intent not found")
    plan = plan_query.data[0]
    contract = _load_contract(plan.get("intent", "{}"))
    return {"intent_id": intent_id, "plan": plan, "contract": contract}


# ── Agent SDK Info endpoint ───────────────────────────────────────────────────

@app.get("/sdk-info")
async def sdk_info():
    """Returns integration guide for all supported agent frameworks."""
    base = "https://intent-firewall.onrender.com"
    return {
        "version": "3.0.0",
        "base_url": base,
        "endpoints": {
            "capture_intent": f"POST {base}/capture-intent",
            "verify_action": f"POST {base}/verify-action",
            "audit_logs": f"GET {base}/audit-logs",
            "health": f"GET {base}/health"
        },
        "supported_agents": [
            "Antigravity", "Claude Code", "Cursor", "OpenHands", "Devin"
        ],
        "example": {
            "step1_capture": {
                "url": f"{base}/capture-intent",
                "method": "POST",
                "body": {
                    "goal": "Fix the login authentication bug",
                    "plan": ["read_codebase", "modify_auth_module", "run_tests", "deploy_staging"]
                }
            },
            "step2_verify": {
                "url": f"{base}/verify-action",
                "method": "POST",
                "body": {
                    "intent_id": "<intent_id from step 1>",
                    "action": "modify_auth_module",
                    "args": {"filepath": "auth.py"}
                }
            }
        }
    }


# ── Backward Compatible Endpoints (existing frontend) ─────────────────────────

@app.post("/plan")
@app.post("/create-plan")
async def create_plan(request: PlanRequest):
    """Legacy: Kept for existing frontend compatibility. Internally calls /capture-intent logic."""
    structured_boundary = generate_execution_boundary(request.user_input)
    contract = generate_intent_contract(
        structured_boundary["goal"],
        structured_boundary["allowed_actions"]
    )
    plan_id = str(uuid.uuid4())
    ts = _now()

    db.table("plans").insert({
        "id": plan_id,
        "user_id": "demo_hackathon_user",
        "goal": structured_boundary["goal"],
        "intent_hash": contract["intent_hash"],
        "merkle_root": contract["merkle_root"],
        "signature": contract["signature"],
        "agent_id": contract["agent_id"],
        "intent": json.dumps(contract),
        "status": "active",
        "created_at": ts
    }).execute()

    return {"plan_id": plan_id, "contract": contract, "status": "signed"}


@app.post("/execute")
@app.post("/execute-action")
async def execute_action(request: ExecuteRequest):
    """Legacy: Maps to verify-action logic for existing frontend."""
    plan_query = db.table("plans").select("intent", "goal").eq("id", request.plan_id).execute()
    if not plan_query.data:
        raise HTTPException(status_code=404, detail="Execution Contract Not Found")

    raw = plan_query.data[0]
    contract = _load_contract(raw.get("intent", "{}"))
    goal = raw.get("goal") or contract.get("goal", "")
    allowed_actions = contract.get("allowed_actions", [])

    is_authorized = verify_action_against_contract(request.tool_name, allowed_actions)
    risk_score = TOOL_RISK_SCORES.get(request.tool_name, 5)
    action_id = str(uuid.uuid4())
    ts = _now()

    # Drift score
    drift_result = score_drift(goal, request.tool_name.replace("_", " "))
    drift_score = drift_result["alignment"]

    if not is_authorized or drift_score < 30.0:
        db.table("blocked_actions").insert({
            "id": action_id,
            "plan_id": request.plan_id,
            "tool_name": request.tool_name,
            "status": "blocked",
            "risk_score": risk_score,
            "drift_score": drift_score,
            "reason": "Outside Intent Boundary or severe drift detected",
            "approved": False,
            "reviewed_by": None,
            "timestamp": ts
        }).execute()
        return {
            "status": "blocked",
            "action_id": action_id,
            "tool_name": request.tool_name,
            "risk_score": risk_score,
            "drift_score": drift_score,
            "reason": "🔒 Security Boundary Breach: Action outside ArmorIQ Signed Intent",
            "timestamp": ts
        }

    if risk_score >= HIGH_RISK_THRESHOLD:
        db.table("blocked_actions").insert({
            "id": action_id,
            "plan_id": request.plan_id,
            "tool_name": request.tool_name,
            "status": "pending_approval",
            "risk_score": risk_score,
            "drift_score": drift_score,
            "reason": f"High-risk action requires human approval (risk: {risk_score}/10)",
            "approved": None,
            "reviewed_by": None,
            "timestamp": ts
        }).execute()
        return {
            "status": "pending_approval",
            "action_id": action_id,
            "tool_name": request.tool_name,
            "risk_score": risk_score,
            "drift_score": drift_score,
            "reason": f"⚠️ High-risk action requires human authorization",
            "timestamp": ts
        }

    # Execute
    tool_func = TOOL_REGISTRY.get(request.tool_name)
    if not tool_func:
        raise HTTPException(status_code=400, detail="Tool missing from registry")

    arg_value = next(iter(request.arguments.values())) if request.arguments else "default"
    execution_result = tool_func(arg_value)

    db.table("executions").insert({
        "id": action_id,
        "plan_id": request.plan_id,
        "tool_name": request.tool_name,
        "status": "allowed",
        "risk_score": risk_score,
        "drift_score": drift_score,
        "result": execution_result,
        "timestamp": ts
    }).execute()

    return {
        "status": "allowed",
        "action_id": action_id,
        "tool_name": request.tool_name,
        "risk_score": risk_score,
        "drift_score": drift_score,
        "result": execution_result,
        "timestamp": ts
    }


@app.get("/logs/{plan_id}")
@app.get("/audit-logs/{plan_id}")
async def get_audit_logs_by_plan(plan_id: str):
    """Audit trail for a specific plan."""
    executions = db.table("executions").select("*").eq("plan_id", plan_id).order("timestamp").execute()
    blocked = db.table("blocked_actions").select("*").eq("plan_id", plan_id).order("timestamp").execute()
    return {
        "plan_id": plan_id,
        "executions": executions.data,
        "blocked_actions": blocked.data,
        "total_events": len(executions.data) + len(blocked.data)
    }


@app.post("/approve")
@app.post("/approve-action")
async def approve_action(request: ApprovalRequest):
    decision = "approved" if request.approve else "rejected"
    db.table("blocked_actions").update({
        "approved": request.approve,
        "status": decision,
        "reviewed_by": request.reviewed_by,
        "reviewed_at": _now()
    }).eq("id", request.action_id).execute()
    db.table("approvals").insert({
        "id": str(uuid.uuid4()),
        "action_id": request.action_id,
        "decision": decision,
        "reviewed_by": request.reviewed_by,
        "reviewed_at": _now()
    }).execute()
    return {"status": "updated", "action_id": request.action_id, "decision": decision}


@app.get("/risk-scores")
async def get_risk_scores():
    return {"risk_scores": TOOL_RISK_SCORES, "high_risk_threshold": HIGH_RISK_THRESHOLD}


@app.get("/execution-timeline/{plan_id}")
async def get_execution_timeline(plan_id: str):
    executions = db.table("executions").select("*").eq("plan_id", plan_id).order("timestamp").execute()
    blocked = db.table("blocked_actions").select("*").eq("plan_id", plan_id).order("timestamp").execute()
    timeline = []
    for e in executions.data:
        timeline.append({**e, "event_type": "execution"})
    for b in blocked.data:
        timeline.append({**b, "event_type": "blocked"})
    timeline.sort(key=lambda x: x.get("timestamp", ""))
    return {"plan_id": plan_id, "timeline": timeline}


@app.get("/intent-details/{plan_id}")
async def get_intent_details_legacy(plan_id: str):
    plan_query = db.table("plans").select("*").eq("id", plan_id).execute()
    if not plan_query.data:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan = plan_query.data[0]
    contract = _load_contract(plan.get("intent", "{}"))
    return {"plan_id": plan_id, "plan": plan, "contract": contract}
