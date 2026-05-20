// YouTube Focus — content.js
// Uses CSS injection for hiding (no inline styles, no DOM mutation loops).
// MutationObserver is only used for: overlay injection, /shorts/ redirect, stats.

let settings = {
  enabled: true,
  blockShorts: true,
  blockHomeFeed: true,
};

let counts = { shorts: 0, videos: 0 };
let overlayInjected = false;
let lastPath = location.pathname;
let redirecting = false;

// ─── CSS Rules ────────────────────────────────────────────────────────────────

const SHORTS_CSS = `
/* === YouTube Focus: Hide Shorts === */

/* ── Shorts shelf / section (any page) ── */
ytd-reel-shelf-renderer,
ytd-rich-shelf-renderer:has(a[href*="/shorts/"]),
ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2),
ytd-rich-section-renderer:has(a[href*="/shorts/"]),

/* grid-shelf-view-model is YouTube's newer shorts grid (search, home) */
grid-shelf-view-model,

/* ── Individual shorts items in home grid ── */
ytd-rich-item-renderer:has(a[href*="/shorts/"]),
ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model-v2),

/* ── Watch-page sidebar recommendations ── */
ytd-compact-video-renderer:has(a[href*="/shorts/"]),

/* ── Search results: video with /shorts/ link ── */
ytd-video-renderer:has(a[href*="/shorts/"]),

/* ── Search results: video with SHORTS overlay badge ── */
ytd-video-renderer:has([overlay-style="SHORTS"]),
ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),

/* ── Shelf renderers containing shorts ── */
ytd-shelf-renderer:has(a[href*="/shorts/"]),

/* ── Sidebar / mini-guide navigation link ── */
ytd-guide-entry-renderer:has(a[href="/shorts"]),
ytd-mini-guide-entry-renderer:has(a[href="/shorts"]),

/* ── Channel page Shorts tab ── */
yt-tab-shape[tab-title="Shorts"],

/* ── Shorts player page (flash prevention before redirect) ── */
ytd-shorts,

/* ── Shorts lockup containers (catch-all) ── */
ytm-shorts-lockup-view-model-v2,
ytm-shorts-lockup-view-model,
[class*="shortsLockupViewModelHost"]
{
  display: none !important;
}
`;

const HOME_FEED_CSS = `
/* === YouTube Focus: Hide Home Feed === */

/* All video items in the home page grid */
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer,
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-grid-row,
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-section-renderer,
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-grid-media,
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #header,

/* Continuation / infinite-scroll loader on home */
ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #continuation
{
  display: none !important;
}
`;

// ─── Style Element Management ─────────────────────────────────────────────────

function ensureStyleEl(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    // Prepend to <head> (or documentElement if head isn't ready yet)
    const parent = document.head || document.documentElement;
    parent.insertBefore(el, parent.firstChild);
  }
  return el;
}

function applyCSSRules() {
  const shortsEl = ensureStyleEl('ytf-css-shorts');
  const homeEl = ensureStyleEl('ytf-css-home');

  const wantShorts = settings.enabled && settings.blockShorts;
  const wantHome = settings.enabled && settings.blockHomeFeed;

  if (wantShorts && !shortsEl.textContent) shortsEl.textContent = SHORTS_CSS;
  else if (!wantShorts && shortsEl.textContent) shortsEl.textContent = '';

  if (wantHome && !homeEl.textContent) homeEl.textContent = HOME_FEED_CSS;
  else if (!wantHome && homeEl.textContent) homeEl.textContent = '';
}

// ─── Home Page Helpers ────────────────────────────────────────────────────────

function isOnHomePage() {
  return !!document.querySelector('ytd-browse[page-subtype="home"]');
}

function tryInjectOverlay() {}
function removeOverlay() {}

// ─── Shorts Page Redirect ─────────────────────────────────────────────────────

function handleShortsRedirect() {
  if (redirecting) return;
  if (!settings.enabled || !settings.blockShorts) return;
  if (!location.pathname.startsWith('/shorts/')) return;

  const videoId = location.pathname.split('/shorts/')[1]?.split('?')[0]?.split('/')[0];
  if (videoId && videoId.length > 0) {
    redirecting = true;
    location.replace('https://www.youtube.com/watch?v=' + videoId);
  }
}

// ─── JS Fallback (catches what CSS :has() misses) ─────────────────────────────
// YouTube uses Polymer custom elements; :has() can't always see inside them.
// This runs on a debounced timer and only touches elements CSS didn't hide.

function jsFallbackHideShorts() {
  if (!settings.enabled || !settings.blockShorts) return;

  // 1. grid-shelf-view-model's parent section (search results shorts shelf)
  document.querySelectorAll('grid-shelf-view-model').forEach(el => {
    const section = el.closest('ytd-item-section-renderer');
    if (section && !section.dataset.ytfHid) {
      section.dataset.ytfHid = '1';
      section.style.setProperty('display', 'none', 'important');
    }
  });

  // 2. ytd-item-section-renderer that contains shorts lockups
  document.querySelectorAll('ytd-item-section-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    if (el.querySelector('ytm-shorts-lockup-view-model-v2, ytm-shorts-lockup-view-model, a[href*="/shorts/"], [class*="shortsLockup"]')) {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 3. ytd-video-renderer with SHORTS overlay badge attribute
  document.querySelectorAll('ytd-video-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    const badge = el.querySelector('ytd-thumbnail-overlay-time-status-renderer');
    if (badge && badge.getAttribute('overlay-style') === 'SHORTS') {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
    // Also catch by href
    if (el.querySelector('a[href*="/shorts/"]')) {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 4. ytd-rich-item-renderer containing shorts links/lockups
  document.querySelectorAll('ytd-rich-item-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    if (el.querySelector('a[href*="/shorts/"], ytm-shorts-lockup-view-model-v2, [class*="shortsLockup"]')) {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 5. Compact video renderer (watch page sidebar)
  document.querySelectorAll('ytd-compact-video-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    if (el.querySelector('a[href*="/shorts/"]')) {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 6. Sidebar nav items pointing to /shorts
  document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    if (el.querySelector('a[href="/shorts"]')) {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });

  // 7. "Shorts" filter chip in search bar (match by visible text)
  document.querySelectorAll('yt-chip-cloud-chip-renderer').forEach(el => {
    if (el.dataset.ytfHid) return;
    const text = el.textContent.trim();
    if (text === 'Shorts') {
      el.dataset.ytfHid = '1';
      el.style.setProperty('display', 'none', 'important');
    }
  });
}

function jsShowShorts() {
  document.querySelectorAll('[data-ytf-hid]').forEach(el => {
    el.style.removeProperty('display');
    delete el.dataset.ytfHid;
  });
}

// ─── Stats Counting ───────────────────────────────────────────────────────────

const SHORTS_COUNT_SELECTORS = [
  'ytd-reel-shelf-renderer',
  'ytd-rich-item-renderer:has(a[href*="/shorts/"])',
  'ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model-v2)',
  'ytd-compact-video-renderer:has(a[href*="/shorts/"])',
  'ytd-video-renderer:has(a[href*="/shorts/"])',
  'ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model-v2)',
].join(', ');

const HOME_COUNT_SELECTORS = [
  'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer',
  'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer > #contents > ytd-rich-grid-row',
].join(', ');

function updateStats() {
  let changed = false;

  if (settings.enabled && settings.blockShorts) {
    try {
      document.querySelectorAll(SHORTS_COUNT_SELECTORS).forEach(el => {
        if (!el.dataset.ytfCounted) {
          el.dataset.ytfCounted = '1';
          counts.shorts++;
          changed = true;
        }
      });
    } catch (_) {} // :has() selector may fail on very old Chrome
  }

  if (settings.enabled && settings.blockHomeFeed && isOnHomePage()) {
    try {
      document.querySelectorAll(HOME_COUNT_SELECTORS).forEach(el => {
        if (!el.dataset.ytfCounted) {
          el.dataset.ytfCounted = '1';
          counts.videos++;
          changed = true;
        }
      });
    } catch (_) {}
  }

  if (changed) {
    try { chrome.storage.local.set({ counts }); } catch (_) {}
  }
}

// ─── Main Apply ───────────────────────────────────────────────────────────────

function applyAll() {
  applyCSSRules();
  handleShortsRedirect();
  jsFallbackHideShorts();
  tryInjectOverlay();
  updateStats();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

// Inject CSS as early as possible (before DOM is built)
applyCSSRules();

try {
  chrome.storage.sync.get('settings', (result) => {
    if (result.settings) settings = { ...settings, ...result.settings };
    applyCSSRules();    // re-apply with loaded settings
    handleShortsRedirect();
  });
  chrome.storage.local.get('counts', (result) => {
    if (result.counts) counts = { ...counts, ...result.counts };
  });
} catch (_) {}

// ─── Message Listener ─────────────────────────────────────────────────────────

try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'SETTINGS_UPDATED') {
      const prevShorts = settings.blockShorts;
      settings = msg.settings;
      applyCSSRules();

      // If shorts were just disabled, un-hide JS-hidden elements
      if (prevShorts && !settings.blockShorts) jsShowShorts();
      else jsFallbackHideShorts();

      if (!settings.blockHomeFeed || !settings.enabled) {
        removeOverlay();
        if (!settings.enabled) jsShowShorts();
      } else {
        tryInjectOverlay();
      }

      sendResponse({ ok: true });
    }

    if (msg.type === 'GET_STATS') {
      sendResponse({ counts });
    }

    if (msg.type === 'RESET_STATS') {
      counts = { shorts: 0, videos: 0 };
      try { chrome.storage.local.set({ counts }); } catch (_) {}
      sendResponse({ ok: true });
    }
  });
} catch (_) {}

// ─── MutationObserver ─────────────────────────────────────────────────────────
// Only used for: overlay injection, /shorts/ redirect, stats counting.
// CSS handles all the actual hiding — no DOM manipulation feedback loops.

let tickTimer = null;

function onMutation() {
  // Detect SPA navigation
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    overlayInjected = false;
    redirecting = false;       // allow redirect check on new path
    clearTimeout(tickTimer);
    tickTimer = setTimeout(() => {
      applyAll();
      // YouTube may take a moment to set page-subtype, so retry
      setTimeout(tryInjectOverlay, 500);
      setTimeout(tryInjectOverlay, 1500);
    }, 100);
    return;
  }

  // Debounce for new content loaded (infinite scroll, lazy renders)
  clearTimeout(tickTimer);
  tickTimer = setTimeout(() => {
    jsFallbackHideShorts();
    tryInjectOverlay();
    updateStats();
  }, 300);
}

const mo = new MutationObserver(onMutation);

(function startObserver() {
  const target = document.documentElement || document.body;
  if (target) {
    mo.observe(target, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mo.observe(document.documentElement, { childList: true, subtree: true });
    });
  }
})();
