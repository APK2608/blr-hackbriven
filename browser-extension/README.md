# Intent Firewall — Chrome Extension

Real-time browser activity monitor for autonomous agents.
Intercepts **every action** across all tabs and verifies it against
the signed ArmorIQ intent contract before allowing it to execute.

## Install in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select this folder: `intent-firewall/browser-extension/`
5. The 🛡️ icon appears in your Chrome toolbar

## Usage

1. Click the 🛡️ icon
2. Type your agent's goal (e.g. *"Order a Samsung watch under $200 on Amazon"*)
3. Click **Activate Firewall**
4. The extension signs an ArmorIQ intent contract with the backend
5. Open any tab — every navigation, click, form submit is now monitored

## What gets monitored

| Action | Risk | Notes |
|--------|------|-------|
| `navigate_url` | 2/10 | URL navigation |
| `search_product` | 1/10 | Search queries |
| `add_to_cart` | 4/10 | Cart actions |
| `navigate_checkout` | 6/10 | Checkout flows |
| `click_place_order` | 9/10 | **Paused for review** |
| `submit_payment` | 10/10 | **Paused for review** |
| `delete_request` | 9/10 | **Blocked if outside intent** |

## Live Monitor Dashboard

Open `http://localhost:3000` → **Live Monitor** tab to see all events streaming
in real-time from the extension via Server-Sent Events.

## How blocking works

- **Drift score < 20%** → Action **blocked** (possible prompt injection)
- **Risk score ≥ 7** → Action **paused** (human review required)
- **Outside intent boundary** → Action **blocked** immediately
- **Allowed** → Extension permits the browser action to proceed

When blocked, a red overlay banner appears on the page and the navigation
is redirected to a firewall-blocked page.

## Backend endpoints used

```
POST /capture-intent      → sign agent goal with ArmorIQ
POST /track-browser-action → verify each browser action
GET  /events/stream        → SSE stream to dashboard
```
