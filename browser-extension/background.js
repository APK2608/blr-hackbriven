/**
 * Intent Firewall — Background Service Worker
 * Intercepts ALL browser activity across ALL tabs.
 * Routes every significant action through /track-browser-action for real-time trust verification.
 */

const FIREWALL_URL = 'https://blr-hackbriven.onrender.com';
const FIREWALL_LOCAL = 'http://localhost:8000';

// Session state
let intentId = null;
let sessionGoal = '';
let isMonitoring = false;
let actionQueue = [];
let blockedCount = 0;
let allowedCount = 0;

// ── Utility ───────────────────────────────────────────────────────────────────

async function getActiveBackend() {
  try {
    const r = await fetch(`${FIREWALL_LOCAL}/health`, { signal: AbortSignal.timeout(1500) });
    if (r.ok) {
      const data = await r.json();
      // Make sure it's actually our Intent Firewall backend, not an unrelated local server
      if (data.armoriq_version || data.trust_layer || data.service?.includes?.('Intent Firewall')) {
        return FIREWALL_LOCAL;
      }
    }
  } catch (_) {}
  return FIREWALL_URL;
}

async function verifyBrowserAction(action, url, details = {}) {
  if (!intentId || !isMonitoring) return { status: 'unmonitored' };

  const backend = await getActiveBackend();
  try {
    const res = await fetch(`${backend}/track-browser-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent_id: intentId,
        action,
        url,
        details,
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn('[IntentFirewall] verification failed:', e);
    return { status: 'error', reason: e.message };
  }
}

function updateBadge(status) {
  const configs = {
    allowed:    { text: '✓', color: '#10b981' },
    blocked:    { text: '✗', color: '#ef4444' },
    pending_review: { text: '!', color: '#f59e0b' },
    monitoring: { text: '●', color: '#6366f1' },
    off:        { text: '',  color: '#71717a' },
  };
  const cfg = configs[status] || configs.off;
  chrome.action.setBadgeText({ text: cfg.text });
  chrome.action.setBadgeBackgroundColor({ color: cfg.color });
}

function notifyBlocked(action, url, reason, driftScore) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: '🔒 Intent Firewall — Action Blocked',
    message: `${action} on ${new URL(url).hostname}\nDrift: ${driftScore?.toFixed?.(1) ?? '?'}% | ${reason}`,
    priority: 2,
  });
  blockedCount++;
  chrome.storage.session.set({ blockedCount, allowedCount });
}

function broadcastToPopup(event) {
  chrome.runtime.sendMessage({ type: 'FIREWALL_EVENT', event }).catch(() => {});
}

async function blockUrlDNR(urlToBlock) {
  try {
    const ruleId = Math.floor(Math.random() * 100000) + 1;
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [{
        id: ruleId,
        priority: 1,
        action: { type: 'block' },
        condition: {
          urlFilter: urlToBlock,
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'ping', 'script', 'image', 'other']
        }
      }]
    });
    console.log('[IntentFirewall] DNR Rule added to block:', urlToBlock);
  } catch (e) {
    console.warn('[IntentFirewall] Failed to add DNR rule:', e);
  }
}

// ── Navigation Monitoring ─────────────────────────────────────────────────────

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (!isMonitoring || details.frameId !== 0) return;
  if (details.url.startsWith('chrome://') || details.url.startsWith('chrome-extension://')) return;

  const tab = await chrome.tabs.get(details.tabId).catch(() => null);
  const url = details.url;
  const hostname = new URL(url).hostname;

  const result = await verifyBrowserAction('navigate_url', url, {
    hostname,
    tab_title: tab?.title || '',
    transition_type: details.transitionType,
  });

  const event = {
    id: `nav-${Date.now()}`,
    type: 'navigation',
    action: 'navigate_url',
    url,
    hostname,
    status: result.status,
    risk_score: result.risk_score ?? 1,
    drift_score: result.drift_score,
    reason: result.reason,
    timestamp: new Date().toISOString(),
  };

  actionQueue.unshift(event);
  if (actionQueue.length > 100) actionQueue.pop();

  chrome.storage.session.set({ actionQueue: actionQueue.slice(0, 50) });

  updateBadge(result.status);
  broadcastToPopup(event);

  if (result.status === 'blocked') {
    notifyBlocked('Navigate', url, result.reason, result.drift_score);
    blockUrlDNR(url); // Add DNR rule to block further requests
    // Redirect to blocked page or close tab
    chrome.tabs.update(details.tabId, { url: `chrome-extension://${chrome.runtime.id}/blocked.html?url=${encodeURIComponent(url)}&reason=${encodeURIComponent(result.reason)}` });
  } else if (result.status !== 'unmonitored') {
    allowedCount++;
    chrome.storage.session.set({ allowedCount });
  }
});

// ── Web Request Monitoring (form submissions, XHR, API calls) ─────────────────

chrome.webRequest.onBeforeRequest.addListener(
  async (details) => {
    if (!isMonitoring) return {};
    if (details.method !== 'POST' && details.method !== 'PUT' && details.method !== 'DELETE') return {};
    
    const url = details.url;
    if (url.includes('intent-firewall') || url.includes('localhost:8000')) return {};

    const action = details.method === 'DELETE' ? 'delete_request'
                  : url.includes('/payment') || url.includes('/checkout') || url.includes('/order') ? 'submit_payment'
                  : url.includes('/cart') || url.includes('/add-to-cart') ? 'add_to_cart'
                  : 'submit_form';

    const result = await verifyBrowserAction(action, url, {
      method: details.method,
      type: details.type,
      initiator: details.initiator,
    });

    const event = {
      id: `req-${Date.now()}`,
      type: 'request',
      action,
      url,
      hostname: new URL(url).hostname,
      status: result.status,
      risk_score: result.risk_score ?? 3,
      drift_score: result.drift_score,
      reason: result.reason,
      timestamp: new Date().toISOString(),
    };

    actionQueue.unshift(event);
    if (actionQueue.length > 100) actionQueue.pop();
    chrome.storage.session.set({ actionQueue: actionQueue.slice(0, 50) });

    broadcastToPopup(event);
    updateBadge(result.status);

    if (result.status === 'blocked') {
      notifyBlocked(action, url, result.reason, result.drift_score);
      blockUrlDNR(url); // Add DNR rule to block further requests
      // Note: In MV3, we cannot block HTTP requests synchronously here without declarativeNetRequest.
      // We rely on the content script to prevent form submissions and clicks.
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

// ── Content Script Messages ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === 'CONTENT_ACTION') {
    const result = await verifyBrowserAction(msg.action, msg.url, msg.details);

    const event = {
      id: `dom-${Date.now()}`,
      type: 'dom_interaction',
      action: msg.action,
      url: msg.url,
      hostname: msg.hostname,
      label: msg.label,
      status: result.status,
      risk_score: result.risk_score ?? 2,
      drift_score: result.drift_score,
      reason: result.reason,
      timestamp: new Date().toISOString(),
    };

    actionQueue.unshift(event);
    chrome.storage.session.set({ actionQueue: actionQueue.slice(0, 50) });
    broadcastToPopup(event);
    updateBadge(result.status);

    if (result.status === 'blocked') {
      notifyBlocked(msg.action, msg.url, result.reason, result.drift_score);
      blockUrlDNR(msg.url); // Dynamically block any further requests
    }

    sendResponse({ status: result.status, reason: result.reason });
    return true;
  }

  if (msg.type === 'SET_INTENT') {
    intentId = msg.intentId;
    sessionGoal = msg.goal;
    isMonitoring = true;
    blockedCount = 0;
    allowedCount = 0;
    actionQueue = [];
    chrome.storage.session.set({ intentId, sessionGoal, isMonitoring, blockedCount: 0, allowedCount: 0, actionQueue: [] });
    updateBadge('monitoring');
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'STOP_MONITORING') {
    isMonitoring = false;
    intentId = null;
    updateBadge('off');
    chrome.storage.session.set({ isMonitoring: false, intentId: null });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === 'GET_STATE') {
    sendResponse({
      intentId, sessionGoal, isMonitoring, blockedCount, allowedCount,
      events: actionQueue.slice(0, 20),
    });
    return true;
  }
});

// ── Init: restore session state ───────────────────────────────────────────────
chrome.storage.session.get(['intentId', 'sessionGoal', 'isMonitoring', 'blockedCount', 'allowedCount', 'actionQueue'], (data) => {
  if (data.intentId) {
    intentId = data.intentId;
    sessionGoal = data.sessionGoal || '';
    isMonitoring = data.isMonitoring || false;
    blockedCount = data.blockedCount || 0;
    allowedCount = data.allowedCount || 0;
    actionQueue = data.actionQueue || [];
    updateBadge(isMonitoring ? 'monitoring' : 'off');
  }
});

console.log('[IntentFirewall] Background service worker initialized.');
