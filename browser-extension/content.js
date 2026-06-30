/**
 * Intent Firewall — Content Script
 * Injected into EVERY page. Monitors DOM interactions:
 * - Button/link clicks (especially checkout, buy, confirm, delete)
 * - Form submissions (search queries, payment forms, login)
 * - Clipboard access
 * - Download attempts
 * Sends events to background.js for trust verification.
 */

(function () {
  'use strict';

  const HIGH_RISK_KEYWORDS = ['delete', 'remove', 'drop', 'destroy', 'purge', 'wipe', 'cancel account', 'api key', 'secret key', 'access token', 'password'];
  const PAYMENT_KEYWORDS = ['pay', 'checkout', 'buy now', 'place order', 'purchase', 'confirm order', 'submit payment', 'card details', 'credit card', 'cvv', 'ssn'];
  const SEARCH_KEYWORDS = ['search', 'find', 'query', 'look up'];

  function classifyClick(el) {
    const text = (el.innerText || el.value || el.title || el.ariaLabel || '').toLowerCase().trim();
    const href = el.href || '';

    if (PAYMENT_KEYWORDS.some(k => text.includes(k))) return 'click_place_order';
    if (HIGH_RISK_KEYWORDS.some(k => text.includes(k))) return 'click_destructive';
    if (href.includes('/checkout') || href.includes('/order') || href.includes('/pay')) return 'navigate_checkout';
    if (href.includes('/cart') || text.includes('add to cart') || text.includes('add to bag')) return 'add_to_cart';
    if (text.includes('login') || text.includes('sign in')) return 'click_login';
    if (el.type === 'submit') return 'submit_form';
    return 'click_element';
  }

  function getLabel(el) {
    return (el.innerText || el.value || el.title || el.ariaLabel || el.name || '').substring(0, 80).trim();
  }

  // ── Intercept all clicks ───────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, input[type="submit"], input[type="button"], [role="button"]');
    if (!el) return;

    const action = classifyClick(el);
    const label = getLabel(el);

    // Only report meaningful actions (skip trivial navigation)
    if (action === 'click_element' && !label) return;

    chrome.runtime.sendMessage({
      type: 'CONTENT_ACTION',
      action,
      url: window.location.href,
      hostname: window.location.hostname,
      label,
      details: {
        element_tag: el.tagName,
        element_text: label,
        page_title: document.title,
      },
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.status === 'blocked') {
        e.preventDefault();
        e.stopPropagation();
        showBlockOverlay(action, response.reason);
      }
    });
  }, true); // capture phase = intercept before element handlers

  // ── Intercept form submissions ─────────────────────────────────────────────
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const action = form.action || window.location.href;
    const isPayment = action.includes('payment') || action.includes('checkout') || action.includes('order');
    const isSearch = form.querySelector('input[type="search"], input[name="q"], input[name="s"]');

    const firewallAction = isPayment ? 'submit_payment'
                         : isSearch ? 'search_product'
                         : 'submit_form';

    chrome.runtime.sendMessage({
      type: 'CONTENT_ACTION',
      action: firewallAction,
      url: window.location.href,
      hostname: window.location.hostname,
      label: form.id || form.name || 'form',
      details: {
        form_action: action,
        form_method: form.method,
        page_title: document.title,
      },
    }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.status === 'blocked') {
        e.preventDefault();
        e.stopPropagation();
        showBlockOverlay(firewallAction, response.reason);
      }
    });
  }, true);

  // ── Visual Block Overlay ───────────────────────────────────────────────────
  function showBlockOverlay(action, reason) {
    const existing = document.getElementById('intent-firewall-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'intent-firewall-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: linear-gradient(135deg, #0c0a0a 0%, #1a0505 100%);
      border-bottom: 3px solid #ef4444;
      padding: 12px 20px; display: flex; align-items: center; gap: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px;
      color: #fef2f2; box-shadow: 0 4px 24px rgba(239,68,68,0.4);
      animation: slideDown 0.3s ease;
    `;

    overlay.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <span style="font-size:20px">🔒</span>
        <div>
          <div style="color:#ef4444;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:1px">
            INTENT FIREWALL — ACTION BLOCKED
          </div>
          <div style="color:#fca5a5;font-size:11px;margin-top:2px">
            <strong>${action}</strong> — ${reason || 'Outside signed intent boundary'}
          </div>
        </div>
      </div>
      <button id="ifw-dismiss" style="
        background:#7f1d1d;border:1px solid #ef4444;color:#fca5a5;
        padding:4px 12px;border-radius:4px;cursor:pointer;font-size:11px;
        font-family:inherit;white-space:nowrap;
      ">Dismiss</button>
    `;

    // Add animation style
    const style = document.createElement('style');
    style.textContent = `@keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`;
    document.head.appendChild(style);
    document.body.insertBefore(overlay, document.body.firstChild);

    document.getElementById('ifw-dismiss')?.addEventListener('click', () => overlay.remove());
    setTimeout(() => overlay?.remove(), 8000);
  }

  // ── postMessage bridge: Dashboard requests active intent from extension ────────
  // The dashboard (blr-hackbriven.vercel.app) sends INTENT_FIREWALL_REQUEST
  // and this content script replies with INTENT_FIREWALL_RESPONSE from chrome.storage.local
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data?.type === 'INTENT_FIREWALL_REQUEST') {
      chrome.storage.local.get('intent_firewall_active', (data) => {
        if (data.intent_firewall_active) {
          try {
            const payload = typeof data.intent_firewall_active === 'string'
              ? JSON.parse(data.intent_firewall_active)
              : data.intent_firewall_active;
            window.postMessage({ type: 'INTENT_FIREWALL_RESPONSE', payload }, '*');
          } catch (_) {}
        }
      });
    }
  });

})();
