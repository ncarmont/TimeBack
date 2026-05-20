// gmail.js — runs on Gmail, auto-unsubscribes on the #sub page
// Selectors derived from the real Gmail subscription management DOM.

(() => {
  'use strict';

  let isProcessing = false;
  let isPaused = false;
  let overlay = null;
  let aiSessionInitialized = false;

  const AI_SESSION_CAP = 3;
  const AI_DAY_CAP = 3;
  const AI_MODEL = 'openai/gpt-4.1-mini';

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function formatMinutesImpact(minutes) {
    const value = Number(minutes || 0);
    if (value >= 24 * 60) return `${(value / (24 * 60)).toFixed(1)} days`;
    if (value >= 60) return `${(value / 60).toFixed(1)} hrs`;
    return `${Math.round(value)} min`;
  }

  function formatHoursImpact(hours) {
    const value = Number(hours || 0);
    if (value >= 24) return `${(value / 24).toFixed(1)} days`;
    if (value >= 1) return `${value.toFixed(1)} hrs`;
    return `${Math.round(value * 60)} min`;
  }

  function dayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  async function ensureAiSession() {
    if (aiSessionInitialized) return;

    const currentDay = dayKey();
    const nextUsage = await new Promise(resolve => {
      chrome.storage.local.get(['timebackAiUsage'], (result) => {
        const usage = result.timebackAiUsage || {};
        const sameDay = usage.dayKey === currentDay;
        resolve({
          dayKey: currentDay,
          daySpent: sameDay ? Number(usage.daySpent || 0) : 0,
          callsToday: sameDay ? Number(usage.callsToday || 0) : 0,
          sessionId: `tb-${Date.now()}`,
          sessionSpent: 0,
          sessionCalls: 0,
          lastModel: usage.lastModel || AI_MODEL,
          lastCost: 0,
          sessionCap: AI_SESSION_CAP,
          dayCap: AI_DAY_CAP,
        });
      });
    });

    await new Promise(resolve => {
      chrome.storage.local.set({ timebackAiUsage: nextUsage }, resolve);
    });
    aiSessionInitialized = true;
  }

  function reportStatus(extra = {}) {
    chrome.runtime.sendMessage({
      action: 'gmailStatus',
      status: { processing: isProcessing, paused: isPaused, ...extra },
    }).catch(() => {});
  }

  async function waitWhilePaused() {
    while (isPaused && isProcessing) {
      await sleep(300);
    }
  }

  function isSubPage() {
    return location.hash === '#sub' || location.hash.startsWith('#sub/');
  }

  // ── Wait for the subscription table to render (Gmail loads it async) ──────

  async function waitForTable(timeout = 60000) {
    const start = Date.now();
    let dotCount = 0;
    while (Date.now() - start < timeout) {
      // Update overlay with waiting status
      if (overlay) {
        dotCount = (dotCount + 1) % 4;
        const dots = '.'.repeat(dotCount + 1);
        const elapsed = Math.round((Date.now() - start) / 1000);
        overlay.querySelector('.tb-scan-text').textContent =
          `Waiting for Gmail to load${dots} (${elapsed}s)`;
      }

      const table = document.querySelector('table[aria-label="subscriptions"]');
      if (table) {
        const rows = table.querySelectorAll('tr[data-row-id]');
        if (rows.length > 0) return table;
      }

      // Also check for buttons directly (in case table structure differs)
      const btns = document.querySelectorAll('div[data-email] button[aria-label="Unsubscribe"]');
      if (btns.length > 0) return true;

      await sleep(800);
    }
    return null;
  }

  // ── Find the next available subscription row fresh from the DOM ───────────

  function findNextEntry() {
    const rows = document.querySelectorAll('tr[data-row-id]');

    for (const row of rows) {
      // Skip rows we already processed (faded out)
      if (row.dataset.tbDone) continue;

      const email = row.getAttribute('data-row-id');
      const nameCell = row.querySelector('td.l5H9Ne');
      const name = nameCell ? nameCell.textContent.trim() : email;

      const container = row.querySelector('div[data-email]');
      if (!container) continue;

      const textBtn = container.querySelector('button.UQAa1c');
      const iconBtn = container.querySelector('button.cQ1xCc');
      const button = textBtn || iconBtn;
      if (!button) continue;

      return { email, name, button, row };
    }

    return null;
  }

  function countTotalEntries() {
    let count = 0;
    const rows = document.querySelectorAll('tr[data-row-id]');
    for (const row of rows) {
      const container = row.querySelector('div[data-email]');
      if (!container) continue;
      const btn = container.querySelector('button.UQAa1c') || container.querySelector('button.cQ1xCc');
      if (btn) count++;
    }
    return count;
  }

  // ── Confirmation dialog handling ──────────────────────────────────────────

  async function confirmDialog() {
    // Poll for the alertdialog to appear
    const start = Date.now();
    while (Date.now() - start < 5000) {
      const dialog = document.querySelector('div[role="alertdialog"]');
      if (dialog) {
        const okBtn = dialog.querySelector('button[data-mdc-dialog-action="ok"]');
        if (okBtn) {
          okBtn.click();
          // Wait for dialog to close
          while (Date.now() - start < 8000) {
            if (!document.querySelector('div[role="alertdialog"]')) return true;
            await sleep(150);
          }
          return true;
        }
      }
      await sleep(200);
    }
    return false;
  }

  // ── Process rows one at a time, re-querying DOM each iteration ────────────

  async function processAll(total) {
    isProcessing = true;
    isPaused = false;
    let completed = 0;
    const failed = [];

    while (isProcessing) {
      // Wait if paused
      await waitWhilePaused();
      if (!isProcessing) break;

      // Re-query the DOM fresh every iteration to avoid stale references
      const entry = findNextEntry();
      if (!entry) break;

      updateOverlay('progress', {
        current: completed,
        total,
        currentName: entry.name,
      });

      // Report to background so popup can show tab + progress
      reportStatus({ current: completed, total, currentName: entry.name });

      try {
        // Highlight current row
        entry.row.style.outline = '2px solid #667eea';
        entry.row.style.outlineOffset = '-2px';
        entry.row.style.borderRadius = '8px';

        entry.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(500);

        // Check pause again before clicking
        await waitWhilePaused();
        if (!isProcessing) break;

        entry.button.click();

        const ok = await confirmDialog();

        // Remove highlight
        entry.row.style.outline = '';
        entry.row.style.outlineOffset = '';

        if (ok) {
          completed++;
          entry.row.dataset.tbDone = '1';
          entry.row.style.transition = 'opacity 0.4s';
          entry.row.style.opacity = '0.25';
        } else {
          entry.row.dataset.tbDone = '1';
          failed.push(entry.email);
        }

        // Wait for Gmail to settle after the action
        await sleep(800);
      } catch (_) {
        entry.row.dataset.tbDone = '1';
        failed.push(entry.email);
        entry.row.style.outline = '';
      }
    }

    isProcessing = false;
    isPaused = false;
    reportStatus();
    return { completed, total, failed };
  }

  // ── Overlay UI (floating card in bottom-right of Gmail) ───────────────────

  function injectStyles() {
    if (document.getElementById('timeback-styles')) return;
    const s = document.createElement('style');
    s.id = 'timeback-styles';
    s.textContent = `
      #timeback-overlay {
        position: fixed; bottom: 24px; right: 24px; width: 370px;
        background: #1a1a2e; color: #e0e0e0; border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.45);
        font-family: 'Google Sans', Roboto, Arial, sans-serif;
        z-index: 2147483647; overflow: hidden;
        transition: opacity 0.3s;
      }
      #timeback-overlay * { box-sizing: border-box; }

      .tb-header {
        background: linear-gradient(135deg, #667eea, #764ba2);
        padding: 14px 18px; display: flex; align-items: center;
        justify-content: space-between;
      }
      .tb-header h2 { margin:0; font-size:17px; font-weight:700; color:#fff; }
      .tb-close {
        background:none; border:none; color:rgba(255,255,255,.8);
        font-size:20px; cursor:pointer; padding:4px 8px; border-radius:6px;
      }
      .tb-close:hover { background:rgba(255,255,255,.15); }

      .tb-body { padding: 18px; }

      /* Scanning */
      .tb-scan { display:flex; align-items:center; gap:10px; }
      .tb-spinner {
        width:20px; height:20px; border:2.5px solid #3a3a4e;
        border-top-color:#667eea; border-radius:50%;
        animation: tb-spin .7s linear infinite;
      }
      @keyframes tb-spin { to { transform:rotate(360deg); } }
      .tb-scan-text { font-size:13px; color:#aaa; }

      /* Progress */
      .tb-prog { display:none; }
      .tb-prog-status { font-size:13px; color:#b0b0c0; margin-bottom:10px;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .tb-prog-track { width:100%; height:6px; background:#252540;
        border-radius:3px; overflow:hidden; margin-bottom:8px; }
      .tb-prog-bar { height:100%; border-radius:3px;
        background:linear-gradient(90deg,#667eea,#764ba2);
        transition:width .4s ease; width:0%; }
      .tb-prog-count { font-size:12px; color:#666; text-align:right; }

      /* Done */
      .tb-done { display:none; text-align:center; }
      .tb-done-big { font-size:46px; font-weight:800; line-height:1;
        background:linear-gradient(135deg,#667eea,#a78bfa);
        -webkit-background-clip:text; -webkit-text-fill-color:transparent;
        background-clip:text; }
      .tb-done-label { font-size:13px; color:#888; margin-top:4px; }
      .tb-time-card { background:#252540; border-radius:12px; padding:14px;
        margin-top:14px; }
      .tb-time-big { font-size:26px; font-weight:700; color:#4ade80; }
      .tb-time-sub { font-size:11px; color:#666; margin-top:2px; }
      .tb-time-row { display:flex; justify-content:space-around; margin-top:10px;
        padding-top:10px; border-top:1px solid #333; }
      .tb-time-row div { text-align:center; }
      .tb-time-row .n { font-size:16px; font-weight:600; color:#ddd; }
      .tb-time-row .l { font-size:10px; color:#555; margin-top:2px; }

      /* Retry */
      .tb-retry { display:none; text-align:center; }
      .tb-retry-text { font-size:13px; color:#888; margin-bottom:12px; }
      .tb-retry-btn {
        background:linear-gradient(135deg,#667eea,#764ba2);
        color:#fff; border:none; padding:10px 28px; border-radius:10px;
        font-size:14px; font-weight:600; cursor:pointer;
        font-family:inherit; transition: transform .15s;
      }
      .tb-retry-btn:hover { transform:translateY(-1px); }
      .tb-retry-btn:active { transform:scale(.97); }

      /* Pause button in overlay */
      .tb-pause-btn {
        display:none; margin-top:12px;
        background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
        color:#ccc; padding:8px 20px; border-radius:8px; font-size:12px;
        font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s;
      }
      .tb-pause-btn:hover { background:rgba(255,255,255,0.12); color:#fff; }
      .tb-pause-btn:active { transform:scale(.97); }
      .tb-paused-banner {
        display:none; text-align:center; padding:8px; margin-top:8px;
        background:rgba(255,180,50,0.1); border:1px solid rgba(255,180,50,0.25);
        border-radius:8px; font-size:12px; color:#ffb432; font-weight:600;
      }
    `;
    document.head.appendChild(s);
  }

  function createOverlay() {
    if (overlay) return;
    injectStyles();
    overlay = document.createElement('div');
    overlay.id = 'timeback-overlay';
    overlay.innerHTML = `
      <div class="tb-header">
        <h2>TimeBack</h2>
        <button class="tb-close" id="tb-close">&times;</button>
      </div>
      <div class="tb-body">
        <div class="tb-scan" id="tb-scan">
          <div class="tb-spinner"></div>
          <span class="tb-scan-text">Scanning subscriptions...</span>
        </div>
        <div class="tb-prog" id="tb-prog">
          <div class="tb-prog-status" id="tb-prog-status">Starting...</div>
          <div class="tb-prog-track"><div class="tb-prog-bar" id="tb-prog-bar"></div></div>
          <div class="tb-prog-count" id="tb-prog-count">0 / 0</div>
          <div class="tb-paused-banner" id="tb-paused-banner">⏸ Paused</div>
          <button class="tb-pause-btn" id="tb-pause-btn">Pause</button>
        </div>
        <div class="tb-retry" id="tb-retry">
          <div class="tb-retry-text">Gmail is still loading. Click retry once the subscription list is visible.</div>
          <button class="tb-retry-btn" id="tb-retry-btn">Retry</button>
        </div>
        <div class="tb-done" id="tb-done">
          <div class="tb-done-big" id="tb-done-num">0</div>
          <div class="tb-done-label" id="tb-done-label">subscriptions removed</div>
          <div class="tb-time-card">
            <div class="tb-time-big" id="tb-time-big">0 hrs</div>
            <div class="tb-time-sub">estimated time saved per year</div>
            <div class="tb-time-row">
              <div><div class="n" id="tb-tw">0</div><div class="l">per week</div></div>
              <div><div class="n" id="tb-tm">0</div><div class="l">per month</div></div>
              <div><div class="n" id="tb-ty">0</div><div class="l">per year</div></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#tb-close').addEventListener('click', () => {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.remove(); overlay = null; }, 300);
    });
    overlay.querySelector('#tb-retry-btn').addEventListener('click', () => {
      isProcessing = false;
      run();
    });
    overlay.querySelector('#tb-pause-btn').addEventListener('click', () => {
      isPaused = !isPaused;
      updatePauseUI();
      reportStatus({ paused: isPaused });
    });
  }

  function updatePauseUI() {
    if (!overlay) return;
    const btn = overlay.querySelector('#tb-pause-btn');
    const banner = overlay.querySelector('#tb-paused-banner');
    if (btn) {
      btn.textContent = isPaused ? 'Resume' : 'Pause';
      btn.style.display = isProcessing ? 'block' : 'none';
    }
    if (banner) {
      banner.style.display = isPaused ? 'block' : 'none';
    }
  }

  function updateOverlay(phase, d = {}) {
    if (!overlay) return;
    const scan = overlay.querySelector('#tb-scan');
    const prog = overlay.querySelector('#tb-prog');
    const done = overlay.querySelector('#tb-done');
    const retry = overlay.querySelector('#tb-retry');

    if (phase === 'scanning') {
      scan.style.display = 'flex';
      prog.style.display = 'none';
      done.style.display = 'none';
      retry.style.display = 'none';
    }

    if (phase === 'retry') {
      scan.style.display = 'none';
      prog.style.display = 'none';
      done.style.display = 'none';
      retry.style.display = 'block';
    }

    if (phase === 'found') {
      scan.style.display = 'flex';
      retry.style.display = 'none';
      overlay.querySelector('.tb-scan-text').textContent =
        `Found ${d.count} subscriptions — unsubscribing...`;
    }

    if (phase === 'progress') {
      scan.style.display = 'none';
      prog.style.display = 'block';
      done.style.display = 'none';
      retry.style.display = 'none';
      const pct = d.total > 0 ? Math.round((d.current / d.total) * 100) : 0;
      overlay.querySelector('#tb-prog-bar').style.width = pct + '%';
      overlay.querySelector('#tb-prog-status').textContent =
        isPaused ? `Paused — ${d.currentName}` : `Unsubscribing from ${d.currentName}...`;
      overlay.querySelector('#tb-prog-count').textContent =
        `${d.current} / ${d.total}`;
      updatePauseUI();
    }

    if (phase === 'done') {
      scan.style.display = 'none';
      prog.style.display = 'none';
      retry.style.display = 'none';
      done.style.display = 'block';

      const n = d.completed || 0;
      overlay.querySelector('#tb-done-num').textContent = n;

      if (n === 0) {
        overlay.querySelector('#tb-done-label').textContent = 'No subscriptions found';
      }

      const mw = n * 6;                          // ~6 min/week per sub
      const mm = Math.round(mw * 4.33);
      const hy = Math.round((mw * 52) / 60);

      overlay.querySelector('#tb-tw').textContent = formatMinutesImpact(mw);
      overlay.querySelector('#tb-tm').textContent = formatMinutesImpact(mm);
      overlay.querySelector('#tb-ty').textContent = formatHoursImpact(hy);
      overlay.querySelector('#tb-time-big').textContent = formatMinutesImpact(mw * 52);

      chrome.storage.local.set({
        timebackResults: {
          completed: n, total: d.total, failed: d.failed,
          minPerWeek: mw, hrsPerYear: hy,
          date: new Date().toISOString(),
        },
      });
    }
  }

  // ── Main flow ─────────────────────────────────────────────────────────────

  async function run() {
    if (!isSubPage() || isProcessing) return;

    await ensureAiSession();

    // Show overlay immediately so user sees activity
    createOverlay();
    updateOverlay('scanning');
    reportStatus();

    // Wait for the subscription table to actually render
    const table = await waitForTable();
    if (!table) {
      updateOverlay('retry');
      return;
    }

    const total = countTotalEntries();
    if (total === 0) {
      updateOverlay('done', { completed: 0, total: 0, failed: [] });
      aiSessionInitialized = false;
      return;
    }

    updateOverlay('found', { count: total });
    await sleep(800);

    const result = await processAll(total);
    updateOverlay('done', result);
    aiSessionInitialized = false;
  }

  // ── Listeners ─────────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.action === 'start') { run(); sendResponse({ ok: true }); return true; }
    if (msg.action === 'getStatus') {
      sendResponse({ processing: isProcessing, paused: isPaused, onSubPage: isSubPage() });
      return true;
    }
    if (msg.action === 'pauseGmail') {
      isPaused = true;
      updatePauseUI();
      reportStatus({ paused: true });
      sendResponse({ ok: true });
      return true;
    }
    if (msg.action === 'resumeGmail') {
      isPaused = false;
      updatePauseUI();
      reportStatus({ paused: false });
      sendResponse({ ok: true });
      return true;
    }
  });

  // Gmail SPA hash-change detection
  window.addEventListener('hashchange', () => {
    if (isSubPage() && !isProcessing) run();
  });

  // Run on initial load if already on #sub
  if (isSubPage()) run();
})();
