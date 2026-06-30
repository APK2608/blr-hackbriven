/**
 * Intent Firewall — Popup Script
 * Handles the extension popup UI: goal entry, intent capture, live feed.
 */

const FIREWALL_URL = 'https://intent-firewall.onrender.com';
const FIREWALL_LOCAL = 'http://localhost:8000';

let pendingCount = 0;

async function getBackend() {
  try {
    const r = await fetch(`${FIREWALL_LOCAL}/health`, { signal: AbortSignal.timeout(1200) });
    if (r.ok) return FIREWALL_LOCAL;
  } catch (_) {}
  return FIREWALL_URL;
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const setupSection    = document.getElementById('setup-section');
const monitorSection  = document.getElementById('monitoring-section');
const goalInput       = document.getElementById('goal-input');
const btnStart        = document.getElementById('btn-start');
const btnStop         = document.getElementById('btn-stop');
const statusDot       = document.getElementById('status-dot');
const intentIdDisplay = document.getElementById('intent-id-display');
const eventsList      = document.getElementById('events-list');
const eventsEmpty     = document.getElementById('events-empty');
const statAllowed     = document.getElementById('stat-allowed');
const statBlocked     = document.getElementById('stat-blocked');
const statPending     = document.getElementById('stat-pending');

// ── Restore state ─────────────────────────────────────────────────────────────
chrome.storage.session.get(
  ['intentId', 'sessionGoal', 'isMonitoring', 'blockedCount', 'allowedCount', 'actionQueue'],
  (data) => {
    if (data.isMonitoring && data.intentId) {
      showMonitoringUI(data.intentId, data.sessionGoal);
      statAllowed.textContent = data.allowedCount || 0;
      statBlocked.textContent = data.blockedCount || 0;
      (data.actionQueue || []).forEach(addEventRow);
    } else {
      // Fallback: check chrome.storage.local for a saved intent
      chrome.storage.local.get('intent_firewall_active', (localData) => {
        if (localData.intent_firewall_active) {
          try {
            const parsed = JSON.parse(localData.intent_firewall_active);
            if (parsed.intent_id) {
              showMonitoringUI(parsed.intent_id, parsed.goal);
            }
          } catch (_) {}
        }
      });
    }
  }
);

// ── Activate Firewall ─────────────────────────────────────────────────────────
btnStart.addEventListener('click', async () => {
  const goal = goalInput.value.trim();
  if (!goal) { goalInput.focus(); goalInput.style.borderColor = '#ef4444'; return; }
  goalInput.style.borderColor = '';

  btnStart.disabled = true;
  btnStart.innerHTML = '<span class="spinner"></span> Signing Intent...';

  try {
    const backend = await getBackend();
    const res = await fetch(`${backend}/capture-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal, agent_id: 'intent-firewall-extension' }),
    });

    if (!res.ok) {
      throw new Error(`Backend error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();

    // Save full intent payload in chrome.storage.local (persistent, readable by extension)
    const intentPayload = JSON.stringify({
      intent_id: data.intent_id,
      intent_hash: data.intent_hash,
      signature: data.signature,
      merkle_root: data.merkle_root,
      agent_id: data.agent_id,
      allowed_actions: data.allowed_actions,
      goal: data.goal,
      created_at: data.created_at,
      version: data.version,
      activated_at: new Date().toISOString(),
    });
    chrome.storage.local.set({ intent_firewall_active: intentPayload });

    // Tell background service worker to start monitoring
    chrome.runtime.sendMessage({
      type: 'SET_INTENT',
      intentId: data.intent_id,
      goal: data.goal,
    });

    showMonitoringUI(data.intent_id, data.goal);

  } catch (e) {
    btnStart.disabled = false;
    btnStart.innerHTML = '🔐 Activate Firewall';
    alert('Could not connect to Intent Firewall backend: ' + e.message);
  }
});

// ── Stop monitoring ───────────────────────────────────────────────────────────
btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_MONITORING' });
  chrome.storage.local.remove('intent_firewall_active');
  setupSection.style.display = 'block';
  monitorSection.style.display = 'none';
  statusDot.className = 'status-dot';
  goalInput.value = '';
  eventsList.innerHTML = '';
  pendingCount = 0;
});

// ── Copy intent ID on click ───────────────────────────────────────────────────
intentIdDisplay.addEventListener('click', () => {
  navigator.clipboard.writeText(intentIdDisplay.textContent).then(() => {
    const old = intentIdDisplay.textContent;
    intentIdDisplay.textContent = '✓ Copied!';
    setTimeout(() => { intentIdDisplay.textContent = old; }, 1500);
  });
});

// ── Show monitoring UI ────────────────────────────────────────────────────────
function showMonitoringUI(intentId, goal) {
  setupSection.style.display = 'none';
  monitorSection.style.display = 'block';
  statusDot.className = 'status-dot active';
  intentIdDisplay.textContent = intentId;
  intentIdDisplay.title = `Goal: ${goal}\nClick to copy intent ID`;
  btnStart.innerHTML = '🔐 Activate Firewall';
  btnStart.disabled = false;
}

// ── Add event row to live feed ────────────────────────────────────────────────
function addEventRow(event) {
  eventsEmpty.style.display = 'none';

  const row = document.createElement('div');
  row.className = 'event-item';

  const driftText = event.drift_score !== undefined
    ? `Drift: ${event.drift_score.toFixed?.(1) ?? event.drift_score}%`
    : '';

  const hostText = event.hostname
    ? event.hostname.replace('www.', '')
    : (event.url ? new URL(event.url).hostname : '');

  row.innerHTML = `
    <div class="event-dot ${event.status || 'unmonitored'}"></div>
    <div class="event-content">
      <div class="event-action">${event.action?.replace(/_/g, ' ') || event.type || 'Action'}</div>
      <div class="event-url" title="${event.url || ''}">${hostText}</div>
      <div class="event-meta">
        <span class="badge ${event.status || 'unmonitored'}">${event.status || '—'}</span>
        ${driftText ? `<span class="drift-badge">${driftText}</span>` : ''}
        ${event.risk_score ? `<span class="drift-badge">Risk: ${event.risk_score}/10</span>` : ''}
      </div>
    </div>
  `;

  // Insert at top
  const firstChild = eventsList.querySelector('.event-item');
  if (firstChild) {
    eventsList.insertBefore(row, firstChild);
  } else {
    eventsList.appendChild(row);
  }

  // Keep max 30 items
  const items = eventsList.querySelectorAll('.event-item');
  if (items.length > 30) items[items.length - 1].remove();

  // Update stats
  if (event.status === 'allowed') statAllowed.textContent = parseInt(statAllowed.textContent || 0) + 1;
  if (event.status === 'blocked') statBlocked.textContent = parseInt(statBlocked.textContent || 0) + 1;
  if (event.status === 'pending_review') {
    pendingCount++;
    statPending.textContent = pendingCount;
  }
}

// ── Listen for live events from background ────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FIREWALL_EVENT') {
    addEventRow(msg.event);
  }
});
