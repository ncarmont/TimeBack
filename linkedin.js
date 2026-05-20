// LinkedIn Focus — linkedin.js
// Hides feed posts on the LinkedIn feed page.
// LinkedIn uses hashed/obfuscated class names, so we rely on
// structural markers: the "Feed post" h2 and data-view-name attributes.

let settings = {
  enabled: true,
  blockFeedPosts: true,
};

let counts = { posts: 0 };
let lastPath = location.pathname;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isFeedPage() {
  return location.pathname === '/feed' || location.pathname.startsWith('/feed/');
}

function saveStats() {
  try { chrome.storage.local.set({ liCounts: counts }); } catch (_) {}
}

// ─── Post Hiding ──────────────────────────────────────────────────────────────

function hideFeedPosts() {
  if (!settings.enabled || !settings.blockFeedPosts || !isFeedPage()) return;

  let n = 0;

  // Strategy 1: h2 elements with "Feed post" screen-reader text
  document.querySelectorAll('h2').forEach(h2 => {
    const parent = h2.parentElement;
    if (!parent || parent.dataset.lifHidden) return;
    const span = h2.querySelector('span');
    if (span && span.textContent.trim() === 'Feed post') {
      parent.dataset.lifHidden = '1';
      parent.style.setProperty('display', 'none', 'important');
      n++;
    }
  });

  // Strategy 2: data-view-name="feed-actor-image" → walk up to post container
  document.querySelectorAll('[data-view-name="feed-actor-image"]').forEach(el => {
    let container = el.parentElement;
    let depth = 0;
    while (container && depth < 6) {
      if (container.dataset.lifHidden) break;
      if (container.querySelector(':scope > h2')) {
        container.dataset.lifHidden = '1';
        container.style.setProperty('display', 'none', 'important');
        n++;
        break;
      }
      container = container.parentElement;
      depth++;
    }
  });

  // Strategy 3: data-view-name="feed-commentary" → walk up
  document.querySelectorAll('[data-view-name="feed-commentary"]').forEach(el => {
    let container = el.parentElement;
    let depth = 0;
    while (container && depth < 6) {
      if (container.dataset.lifHidden) break;
      if (container.querySelector(':scope > h2')) {
        container.dataset.lifHidden = '1';
        container.style.setProperty('display', 'none', 'important');
        n++;
        break;
      }
      container = container.parentElement;
      depth++;
    }
  });

  // Strategy 4: promo / suggested content cards
  document.querySelectorAll('[data-view-name="feed-full-width-promo"]').forEach(el => {
    let container = el.parentElement;
    let depth = 0;
    while (container && depth < 6) {
      if (container.dataset.lifHidden) break;
      if (container.getAttribute('componentkey')) {
        container.dataset.lifHidden = '1';
        container.style.setProperty('display', 'none', 'important');
        n++;
        break;
      }
      container = container.parentElement;
      depth++;
    }
  });

  if (n > 0) {
    counts.posts += n;
    saveStats();
  }
}

function showFeedPosts() {
  document.querySelectorAll('[data-lif-hidden]').forEach(el => {
    el.style.removeProperty('display');
    delete el.dataset.lifHidden;
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────

try {
  chrome.storage.sync.get('liSettings', (result) => {
    if (result.liSettings) settings = { ...settings, ...result.liSettings };
    hideFeedPosts();
  });
  chrome.storage.local.get('liCounts', (result) => {
    if (result.liCounts) counts = { ...counts, ...result.liCounts };
  });
} catch (_) {}

// ─── Message Listener ─────────────────────────────────────────────────────────

try {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'LI_SETTINGS_UPDATED') {
      settings = msg.settings;
      if (!settings.enabled || !settings.blockFeedPosts) showFeedPosts();
      else hideFeedPosts();
      sendResponse({ ok: true });
    }
    if (msg.type === 'LI_GET_STATS') sendResponse({ counts });
    if (msg.type === 'LI_RESET_STATS') {
      counts = { posts: 0 };
      saveStats();
      sendResponse({ ok: true });
    }
  });
} catch (_) {}

// ─── MutationObserver ─────────────────────────────────────────────────────────

let tickTimer = null;

const mo = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    clearTimeout(tickTimer);
    tickTimer = setTimeout(() => {
      hideFeedPosts();
      setTimeout(hideFeedPosts, 500);
      setTimeout(hideFeedPosts, 1500);
    }, 100);
    return;
  }
  clearTimeout(tickTimer);
  tickTimer = setTimeout(hideFeedPosts, 250);
});

(function startObserver() {
  const target = document.documentElement || document.body;
  if (target) mo.observe(target, { childList: true, subtree: true });
  else document.addEventListener('DOMContentLoaded', () => {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  });
})();
