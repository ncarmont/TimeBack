// popup.js — unified controller for all TimeBack features

// Time saved estimates in hours/week per feature
const TIME_MAP = { blockShorts: 3.5, blockHomeFeed: 2.5, blockFeedPosts: 1.5 };

// ── DOM refs ────────────────────────────────────────────────────────────────

const masterEl       = document.getElementById('master');
const heroTime       = document.getElementById('hero-time');
const heroUnit       = document.getElementById('hero-unit');
const heroFill       = document.getElementById('hero-fill');
const heroAnnual     = document.getElementById('hero-annual');
const heroDaysYear   = document.getElementById('hero-days-year');
const heroDaysLife   = document.getElementById('hero-days-life');
const pillShorts     = document.getElementById('pill-shorts');
const pillHome       = document.getElementById('pill-home');
const pillLi         = document.getElementById('pill-li');
const pillGmail      = document.getElementById('pill-gmail');
const gmailTime      = document.getElementById('gmail-time');
const shortsCount    = document.getElementById('shorts-count');
const videosCount    = document.getElementById('videos-count');
const liCount        = document.getElementById('li-count');
const unsubCount     = document.getElementById('unsub-count');
const resetBtn       = document.getElementById('reset-btn');
const gmailActiveBar = document.getElementById('gmail-active-bar');
const gmailActiveText= document.getElementById('gmail-active-text');
const gmailPauseBtn  = document.getElementById('gmail-pause-btn');
const gmailPauseLabel= document.getElementById('gmail-pause-label');
const gmailPauseIcon = document.getElementById('gmail-pause-icon');
const gmailFocusBtn  = document.getElementById('gmail-focus-btn');
const openRouterInput = document.getElementById('openrouter-key');
const openRouterSaveBtn = document.getElementById('save-openrouter-key');
const openRouterClearBtn = document.getElementById('clear-openrouter-key');
const openRouterStatus = document.getElementById('openrouter-status');
const openRouterBadge = document.getElementById('openrouter-badge');
const openRouterModel = document.getElementById('openrouter-model');
const openRouterSessionSpend = document.getElementById('openrouter-session-spend');
const openRouterDaySpend = document.getElementById('openrouter-day-spend');
const openRouterCallCount = document.getElementById('openrouter-call-count');

// ── State ───────────────────────────────────────────────────────────────────

let ytSettings = { enabled: true, blockShorts: true, blockHomeFeed: true };
let liSettings = { enabled: true, blockFeedPosts: true };
let gmailResult = null;
let hasOpenRouterKey = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function fmtUsd(n) {
  const value = Number(n || 0);
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

function formatHoursForDisplay(hours) {
  const value = Number(hours || 0);
  if (value >= 24) {
    return {
      value: (value / 24).toFixed(1),
      unit: 'days',
    };
  }

  return {
    value: value.toFixed(1),
    unit: 'hrs',
  };
}

function updateHero() {
  const on = ytSettings.enabled;
  let total = 0;
  if (on && ytSettings.blockShorts)       total += TIME_MAP.blockShorts;
  if (on && ytSettings.blockHomeFeed)     total += TIME_MAP.blockHomeFeed;
  if (on && liSettings.blockFeedPosts)    total += TIME_MAP.blockFeedPosts;

  // Add gmail time if we have results
  if (gmailResult) {
    total += gmailResult.hrsPerYear / 52;  // convert annual to weekly
  }

  const weeklyImpact = formatHoursForDisplay(total);
  heroTime.textContent = weeklyImpact.value;
  heroUnit.textContent = `${weeklyImpact.unit} / week saved`;

  const hrsYear = total * 52;
  const daysYear = (hrsYear / 24).toFixed(1);
  const daysLifetime = ((hrsYear * 40) / 24).toFixed(0); // ~40 yr working life

  heroDaysYear.textContent = daysYear;
  heroDaysLife.textContent = daysLifetime;
  heroAnnual.textContent = 'Estimated from your current weekly savings';

  // Fill bar: max ~10 hrs/week maps to 100%
  const pct = Math.min(100, (total / 10) * 100);
  heroFill.style.width = pct + '%';
}

function updatePills() {
  const on = ytSettings.enabled;

  // Master toggle
  masterEl.checked = on;

  // YouTube Shorts pill
  const shortsOn = on && ytSettings.blockShorts;
  pillShorts.classList.toggle('active', shortsOn);
  pillShorts.classList.toggle('off', !shortsOn);
  pillShorts.classList.toggle('disabled', !on);
  pillShorts.querySelector('.pill-state').textContent = shortsOn ? 'ON' : 'OFF';

  // YouTube Home Feed pill
  const homeOn = on && ytSettings.blockHomeFeed;
  pillHome.classList.toggle('active', homeOn);
  pillHome.classList.toggle('off', !homeOn);
  pillHome.classList.toggle('disabled', !on);
  pillHome.querySelector('.pill-state').textContent = homeOn ? 'ON' : 'OFF';

  // LinkedIn pill
  const liOn = on && liSettings.blockFeedPosts;
  pillLi.classList.toggle('active', liOn);
  pillLi.classList.toggle('off', !liOn);
  pillLi.classList.toggle('disabled', !on);
  pillLi.querySelector('.pill-state').textContent = liOn ? 'ON' : 'OFF';

  // Gmail pill — never disable, always clickable
}

function updateAll() {
  updatePills();
  updateHero();
}

function updateOpenRouterUi(ready, message = '') {
  hasOpenRouterKey = ready;
  openRouterBadge.textContent = ready ? 'Ready' : 'Key Required';
  openRouterBadge.classList.toggle('ready', ready);
  openRouterStatus.textContent = message || (
    ready
      ? 'Stored locally. Used only when a sender opens a page outside Gmail.'
      : 'Required for pages outside Gmail.'
  );
  openRouterStatus.classList.toggle('ready', ready);
  openRouterStatus.classList.remove('error');
}

function loadOpenRouterKeyState() {
  chrome.storage.local.get(['openrouterApiKey'], (result) => {
    const key = (result.openrouterApiKey || '').trim();
    updateOpenRouterUi(Boolean(key));
    openRouterInput.value = '';
  });
}

function renderAiUsage(rawUsage) {
  const usage = rawUsage || {};
  const sessionCap = Number(usage.sessionCap || 3);
  const dayCap = Number(usage.dayCap || 3);
  const sessionSpent = Number(usage.sessionSpent || 0);
  const daySpent = Number(usage.daySpent || 0);
  const totalCalls = Number(usage.callsToday || 0);
  const lastModel = usage.lastModel || 'Not used yet';

  openRouterModel.textContent = lastModel;
  openRouterSessionSpend.textContent = `${fmtUsd(sessionSpent)} / ${fmtUsd(sessionCap)}`;
  openRouterDaySpend.textContent = `${fmtUsd(daySpent)} / ${fmtUsd(dayCap)}`;
  openRouterCallCount.textContent = fmt(totalCalls);

  if (!hasOpenRouterKey) return;

  if (sessionSpent >= sessionCap || daySpent >= dayCap) {
    openRouterStatus.textContent = `AI spend cap reached. Session and day requests stop at ${fmtUsd(Math.min(sessionCap, dayCap))}.`;
    openRouterStatus.classList.add('error');
    openRouterStatus.classList.remove('ready');
    return;
  }

  if (lastModel !== 'Not used yet') {
    openRouterStatus.textContent = `Live spend tracking active. Caps: ${fmtUsd(sessionCap)} per session and ${fmtUsd(dayCap)} per day.`;
    openRouterStatus.classList.add('ready');
    openRouterStatus.classList.remove('error');
    return;
  }

  openRouterStatus.textContent = `Caps armed: ${fmtUsd(sessionCap)} per session and ${fmtUsd(dayCap)} per day.`;
  openRouterStatus.classList.add('ready');
  openRouterStatus.classList.remove('error');
}

// ── Persistence ─────────────────────────────────────────────────────────────

function saveYT() {
  chrome.storage.sync.set({ settings: ytSettings });
  // Notify all YouTube tabs
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: ytSettings }).catch(() => {});
    });
  });
}

function saveLI() {
  chrome.storage.sync.set({ liSettings });
  // Notify all LinkedIn tabs
  chrome.tabs.query({ url: 'https://www.linkedin.com/*' }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'LI_SETTINGS_UPDATED', settings: liSettings }).catch(() => {});
    });
  });
}

function loadStats() {
  chrome.storage.local.get(['counts', 'liCounts', 'timebackResults', 'timebackAiUsage'], (result) => {
    const yt = result.counts   || { shorts: 0, videos: 0 };
    const li = result.liCounts || { posts: 0 };
    shortsCount.textContent = fmt(yt.shorts);
    videosCount.textContent = fmt(yt.videos);
    liCount.textContent     = fmt(li.posts);

    if (result.timebackResults) {
      gmailResult = result.timebackResults;
      unsubCount.textContent = fmt(gmailResult.completed);
      if (gmailResult.hrsPerYear > 0) {
        const weeklyGmailImpact = formatHoursForDisplay(gmailResult.hrsPerYear / 52);
        gmailTime.textContent = `~${weeklyGmailImpact.value}${weeklyGmailImpact.unit === 'days' ? 'd' : 'h'}`;
      }
      updateHero();
    }

    renderAiUsage(result.timebackAiUsage);
  });
}

// ── Init ────────────────────────────────────────────────────────────────────

chrome.storage.sync.get(['settings', 'liSettings'], (result) => {
  if (result.settings)   ytSettings = { ...ytSettings, ...result.settings };
  if (result.liSettings) liSettings = { ...liSettings, ...result.liSettings };
  liSettings.enabled = ytSettings.enabled;
  updateAll();
  loadStats();
  loadOpenRouterKeyState();
});

// Refresh stats periodically
const statsInterval = setInterval(loadStats, 1200);
window.addEventListener('unload', () => clearInterval(statsInterval));

// ── Events ──────────────────────────────────────────────────────────────────

// Master toggle
masterEl.addEventListener('change', () => {
  ytSettings.enabled = masterEl.checked;
  liSettings.enabled = masterEl.checked;
  updateAll();
  saveYT();
  saveLI();
});

// Pill clicks toggle features
pillShorts.addEventListener('click', () => {
  if (!ytSettings.enabled) return;
  ytSettings.blockShorts = !ytSettings.blockShorts;
  updateAll();
  saveYT();
});

pillHome.addEventListener('click', () => {
  if (!ytSettings.enabled) return;
  ytSettings.blockHomeFeed = !ytSettings.blockHomeFeed;
  updateAll();
  saveYT();
});

pillLi.addEventListener('click', () => {
  if (!ytSettings.enabled) return;
  liSettings.blockFeedPosts = !liSettings.blockFeedPosts;
  updateAll();
  saveLI();
});

// Gmail — open via background so tab is tracked
pillGmail.addEventListener('click', () => {
  if (!hasOpenRouterKey) {
    updateOpenRouterUi(false, 'Add your OpenRouter key before a sender opens an external unsubscribe page.');
    openRouterStatus.classList.add('error');
  }
  chrome.runtime.sendMessage({ action: 'openGmailSub' });
});

// Pause / Resume
let isPaused = false;
gmailPauseBtn.addEventListener('click', () => {
  if (isPaused) {
    chrome.runtime.sendMessage({ action: 'resumeGmail' });
  } else {
    chrome.runtime.sendMessage({ action: 'pauseGmail' });
  }
});

// Focus the gmail tab
gmailFocusBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'focusGmailTab' });
});

// Poll gmail tab status
function pollGmailStatus() {
  chrome.runtime.sendMessage({ action: 'getGmailTab' }, (resp) => {
    if (chrome.runtime.lastError || !resp || resp.tabId == null) {
      gmailActiveBar.style.display = 'none';
      isPaused = false;
      return;
    }

    const s = resp.status;
    const hasStatusMessage = Boolean(s && (s.currentName || s.aiNeedsKey));
    if (!s || (!s.processing && !s.paused && !hasStatusMessage)) {
      gmailActiveBar.style.display = 'none';
      isPaused = false;
      return;
    }

    gmailActiveBar.style.display = 'flex';
    isPaused = !!s.paused;

    // Update pause button
    if (isPaused) {
      gmailActiveBar.classList.add('paused');
      gmailPauseLabel.textContent = 'Resume';
      gmailPauseIcon.innerHTML = '<polygon points="4,2 12,7 4,12" fill="currentColor"/>';
    } else {
      gmailActiveBar.classList.remove('paused');
      gmailPauseLabel.textContent = 'Pause';
      gmailPauseIcon.innerHTML = '<rect x="3" y="2" width="3" height="10" rx="1" fill="currentColor"/><rect x="8" y="2" width="3" height="10" rx="1" fill="currentColor"/>';
    }

    // Build status text
    const tabTitle = resp.title || 'Gmail';
    const shortTitle = tabTitle.length > 20 ? tabTitle.slice(0, 20) + '…' : tabTitle;
    if (s.current != null && s.total) {
      const name = s.currentName || '';
      const prefix = isPaused ? 'Paused' : 'Running';
      gmailActiveText.textContent = `${prefix}: ${s.current}/${s.total} — ${name}`;
    } else if (s.aiNeedsKey) {
      gmailActiveText.textContent = 'Waiting for OpenRouter key for off-site unsubscribe';
    } else if (s.currentName) {
      gmailActiveText.textContent = s.currentName;
    } else {
      gmailActiveText.textContent = isPaused ? `Paused on "${shortTitle}"` : `Running on "${shortTitle}"`;
    }
  });
}

const gmailPollInterval = setInterval(pollGmailStatus, 800);
window.addEventListener('unload', () => clearInterval(gmailPollInterval));
pollGmailStatus();

openRouterSaveBtn.addEventListener('click', () => {
  const key = openRouterInput.value.trim();
  if (!key) {
    updateOpenRouterUi(false, 'Paste an OpenRouter API key to enable AI page handling.');
    openRouterStatus.classList.add('error');
    return;
  }

  chrome.storage.local.set({ openrouterApiKey: key }, () => {
    openRouterInput.value = '';
    updateOpenRouterUi(true, 'OpenRouter key saved locally.');
  });
});

openRouterClearBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['openrouterApiKey'], () => {
    openRouterInput.value = '';
    updateOpenRouterUi(false, 'OpenRouter key removed.');
  });
});

// Reset stats
resetBtn.addEventListener('click', () => {
  chrome.storage.local.set({
    counts: { shorts: 0, videos: 0 },
    liCounts: { posts: 0 },
  }, () => {
    shortsCount.textContent = '0';
    videosCount.textContent = '0';
    liCount.textContent     = '0';
  });
  chrome.tabs.query({ url: ['https://www.youtube.com/*', 'https://www.linkedin.com/*'] }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'RESET_STATS' }).catch(() => {});
      chrome.tabs.sendMessage(tab.id, { type: 'LI_RESET_STATS' }).catch(() => {});
    });
  });
});
