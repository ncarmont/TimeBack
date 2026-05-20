// background.js — service worker: tracks active Gmail unsub tab

let gmailTabId = null;
let gmailTabTitle = '';
let gmailStatus = null; // { processing, paused, current, total, currentName }

function pingTrackedTab(tabId) {
  chrome.tabs.sendMessage(tabId, { action: 'maybeContinueUnsubscribe' }, () => {
    void chrome.runtime.lastError;
  });
}

// Store the tab we opened for Gmail unsubscribe
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Content script reports its status
  if (msg.action === 'gmailStatus') {
    gmailTabId = sender.tab?.id ?? gmailTabId;
    gmailTabTitle = sender.tab?.title ?? '';
    gmailStatus = msg.status;
    sendResponse({ ok: true });
    return true;
  }

  // Popup asks which tab is active
  if (msg.action === 'getGmailTab') {
    // Verify tab still exists
    if (gmailTabId != null) {
      chrome.tabs.get(gmailTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          gmailTabId = null;
          gmailStatus = null;
          sendResponse({ tabId: null, status: null });
        } else {
          sendResponse({ tabId: gmailTabId, title: tab.title, status: gmailStatus });
        }
      });
      return true; // async
    }
    sendResponse({ tabId: null, status: null });
    return true;
  }

  // Popup wants to open Gmail sub page and track the tab
  if (msg.action === 'openGmailSub') {
    // If we already have a tab, just focus it
    if (gmailTabId != null) {
      chrome.tabs.get(gmailTabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          // Tab gone, open new one
          chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#sub' }, (t) => {
            gmailTabId = t.id;
            sendResponse({ tabId: t.id });
          });
        } else {
          chrome.tabs.update(gmailTabId, { active: true });
          chrome.windows.update(tab.windowId, { focused: true });
          pingTrackedTab(gmailTabId);
          sendResponse({ tabId: gmailTabId });
        }
      });
      return true;
    }
    chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#sub' }, (t) => {
      gmailTabId = t.id;
      sendResponse({ tabId: t.id });
    });
    return true;
  }

  // Popup sends pause/resume to gmail content script
  if (msg.action === 'pauseGmail' || msg.action === 'resumeGmail') {
    if (gmailTabId != null) {
      chrome.tabs.sendMessage(gmailTabId, { action: msg.action }, (resp) => {
        sendResponse(resp || { ok: false });
      });
      return true;
    }
    sendResponse({ ok: false });
    return true;
  }

  // Popup wants to focus the gmail tab
  if (msg.action === 'focusGmailTab') {
    if (gmailTabId != null) {
      chrome.tabs.get(gmailTabId, (tab) => {
        if (!chrome.runtime.lastError && tab) {
          chrome.tabs.update(gmailTabId, { active: true });
          chrome.windows.update(tab.windowId, { focused: true });
          sendResponse({ ok: true });
        } else {
          sendResponse({ ok: false });
        }
      });
      return true;
    }
    sendResponse({ ok: false });
    return true;
  }

  // Clean up when tab closes
  if (msg.action === 'progress' || msg.action === 'complete') {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
});

// Track tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === gmailTabId) {
    gmailTabId = null;
    gmailStatus = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId !== gmailTabId) return;
  if (changeInfo.status !== 'complete') return;

  gmailTabTitle = tab?.title || gmailTabTitle;
  pingTrackedTab(tabId);
});
