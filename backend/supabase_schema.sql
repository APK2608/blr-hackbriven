-- Intent Firewall — Supabase Schema
-- Run this in your Supabase SQL Editor to create the audit_events table
-- (plans, executions, blocked_actions, approvals tables already exist)

-- ── New: audit_events (unified audit trail for /verify-action) ───────────────
create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  intent_id   text,
  plan_id     text,
  tool_name   text not null,
  action      text,
  status      text not null check (status in ('allowed', 'pending_review', 'blocked', 'pending_approval')),
  risk_score  integer default 0,
  drift_score numeric(5,2) default 0,
  reason      text,
  arguments   jsonb,
  timestamp   timestamptz default now()
);

-- Index for fast dashboard queries
create index if not exists idx_audit_events_intent_id on public.audit_events(intent_id);
create index if not exists idx_audit_events_timestamp on public.audit_events(timestamp desc);
create index if not exists idx_audit_events_status on public.audit_events(status);

-- Row Level Security (optional — enable for production)
alter table public.audit_events enable row level security;

-- Allow anon read/write for demo (tighten for production)
create policy "allow_all_audit" on public.audit_events
  for all using (true) with check (true);

-- ── Verify existing tables have drift_score column ────────────────────────────
-- Add drift_score to executions table if missing
alter table public.executions 
  add column if not exists drift_score numeric(5,2) default null;

-- Add drift_score to blocked_actions table if missing  
alter table public.blocked_actions
  add column if not exists drift_score numeric(5,2) default null;
