// unsubscribe.js — AI-assisted continuation for unsubscribe flows outside Gmail

(() => {
  'use strict';

  let aiRunInFlight = false;
  let lastPageSignature = '';
  const DEFAULT_MODEL = 'openai/gpt-4.1-mini';
  const SESSION_CAP_USD = 3;
  const DAY_CAP_USD = 3;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function dayKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function isGmailSubPage() {
    return location.hostname === 'mail.google.com'
      && (location.hash === '#sub' || location.hash.startsWith('#sub/'));
  }

  function reportStatus(extra = {}) {
    chrome.runtime.sendMessage({
      action: 'gmailStatus',
      status: { processing: false, paused: false, ...extra },
    }).catch(() => {});
  }

  function getOpenRouterKey() {
    return new Promise(resolve => {
      chrome.storage.local.get(['openrouterApiKey'], result => {
        resolve((result.openrouterApiKey || '').trim());
      });
    });
  }

  function getAiUsageState() {
    return new Promise(resolve => {
      chrome.storage.local.get(['timebackAiUsage'], result => {
        const usage = result.timebackAiUsage || {};
        const today = dayKey();
        const sameDay = usage.dayKey === today;
        resolve({
          dayKey: today,
          daySpent: sameDay ? Number(usage.daySpent || 0) : 0,
          callsToday: sameDay ? Number(usage.callsToday || 0) : 0,
          sessionId: usage.sessionId || `tb-${Date.now()}`,
          sessionSpent: Number(usage.sessionSpent || 0),
          sessionCalls: Number(usage.sessionCalls || 0),
          lastModel: usage.lastModel || DEFAULT_MODEL,
          lastCost: Number(usage.lastCost || 0),
          sessionCap: Number(usage.sessionCap || SESSION_CAP_USD),
          dayCap: Number(usage.dayCap || DAY_CAP_USD),
        });
      });
    });
  }

  function setAiUsageState(nextState) {
    return new Promise(resolve => {
      chrome.storage.local.set({ timebackAiUsage: nextState }, resolve);
    });
  }

  function parseUsd(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && style.opacity !== '0'
      && rect.width > 6
      && rect.height > 6
      && rect.bottom >= 0
      && rect.right >= 0
      && rect.top <= window.innerHeight
      && rect.left <= window.innerWidth;
  }

  function elementLabel(el) {
    const parts = [
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('value'),
      el.textContent,
    ].map(normalizeText).filter(Boolean);

    return parts[0] || '';
  }

  function collectCandidates() {
    const seen = new Set();
    const elements = Array.from(document.querySelectorAll(
      'button, a[href], input[type="submit"], input[type="button"], [role="button"]'
    ));

    const candidates = [];
    let id = 1;

    for (const el of elements) {
      if (!isVisible(el)) continue;
      if (el.matches('[disabled], [aria-disabled="true"]')) continue;

      const label = elementLabel(el);
      const href = el instanceof HTMLAnchorElement ? (el.href || '') : '';
      if (!label && !href) continue;

      const key = `${el.tagName}|${label}|${href}`;
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        id,
        label: label.slice(0, 160),
        href: href.slice(0, 240),
        tag: el.tagName.toLowerCase(),
        text: normalizeText(el.textContent).slice(0, 160),
        ariaLabel: normalizeText(el.getAttribute('aria-label')).slice(0, 120),
        title: normalizeText(el.getAttribute('title')).slice(0, 120),
        element: el,
      });

      id += 1;
      if (candidates.length >= 24) break;
    }

    return candidates;
  }

  function isUnsubscribeContext(pageText) {
    const haystack = normalizeText(`${document.title} ${location.href} ${pageText}`).toLowerCase();
    return /(unsubscribe|opt out|stop emails|email preferences|manage preferences|mailing list|newsletter|subscription)/.test(haystack);
  }

  function looksComplete(pageText) {
    const haystack = normalizeText(`${document.title} ${location.href} ${pageText}`).toLowerCase();
    return /(you('| a)?re unsubscribed|successfully unsubscribed|email preferences updated|you will no longer receive|removed from.*list|opt-out successful|preferences saved)/.test(haystack);
  }

  function isUnsafeChoice(candidate) {
    const haystack = normalizeText(`${candidate.label} ${candidate.text} ${candidate.ariaLabel} ${candidate.title} ${candidate.href}`).toLowerCase();
    return /(sign in|log in|login|create account|start trial|buy now|purchase|checkout|upgrade|delete account|delete profile|remove account|resubscribe|keep subscribed|keep me subscribed)/.test(haystack);
  }

  function isSafeChoice(candidate) {
    const haystack = normalizeText(`${candidate.label} ${candidate.text} ${candidate.ariaLabel} ${candidate.title} ${candidate.href}`).toLowerCase();
    if (isUnsafeChoice(candidate)) return false;
    return /(unsubscribe|opt out|stop|confirm|submit|save preferences|update preferences|continue|yes|remove)/.test(haystack);
  }

  function pageSignature(pageText, candidates) {
    return JSON.stringify({
      url: location.href,
      title: document.title,
      text: pageText.slice(0, 700),
      ids: candidates.map(candidate => [candidate.id, candidate.label, candidate.href]),
    });
  }

  function parseDecision(raw) {
    if (!raw) throw new Error('OpenRouter returned an empty response.');

    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
      throw new Error('OpenRouter did not return JSON.');
    }

    return JSON.parse(text.slice(start, end + 1));
  }

  async function askOpenRouter(apiKey, pageText, candidates) {
    const body = {
      model: DEFAULT_MODEL,
      temperature: 0,
      max_tokens: 120,
      usage: { include: true },
      messages: [
        {
          role: 'system',
          content: [
            'You choose the safest next action on a web page that appears in an email unsubscribe flow.',
            'Return JSON only.',
            'Schema: {"action":"click"|"done"|"wait"|"none","elementId":number|null,"reason":"short string"}',
            'Choose "click" only for the most likely unsubscribe-confirming action.',
            'Never choose sign-in, account creation, purchasing, or account deletion actions.',
          ].join(' '),
        },
        {
          role: 'user',
          content: JSON.stringify({
            url: location.href,
            title: document.title,
            pageText: pageText.slice(0, 7000),
            candidates: candidates.map(candidate => ({
              id: candidate.id,
              label: candidate.label,
              href: candidate.href,
              tag: candidate.tag,
              text: candidate.text,
              ariaLabel: candidate.ariaLabel,
              title: candidate.title,
            })),
          }),
        },
      ],
    };

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://mail.google.com/',
        'X-Title': 'TimeBack',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    return {
      decision: parseDecision(content),
      model: data?.model || DEFAULT_MODEL,
      cost: parseUsd(data?.usage?.cost ?? data?.cost),
    };
  }

  function flashElement(el) {
    const previousOutline = el.style.outline;
    const previousOffset = el.style.outlineOffset;
    el.style.outline = '3px solid rgba(102, 126, 234, 0.95)';
    el.style.outlineOffset = '2px';
    setTimeout(() => {
      el.style.outline = previousOutline;
      el.style.outlineOffset = previousOffset;
    }, 1800);
  }

  async function maybeContinueUnsubscribe() {
    if (aiRunInFlight || isGmailSubPage()) return;

    const pageText = normalizeText(document.body?.innerText || '');
    if (!pageText || !isUnsubscribeContext(pageText)) return;

    if (looksComplete(pageText)) {
      reportStatus({ currentName: 'External unsubscribe complete' });
      return;
    }

    const apiKey = await getOpenRouterKey();
    if (!apiKey) {
      reportStatus({
        aiNeedsKey: true,
        currentName: 'External unsubscribe needs your OpenRouter API key',
      });
      return;
    }

    const usageState = await getAiUsageState();
    if (usageState.sessionSpent >= usageState.sessionCap || usageState.daySpent >= usageState.dayCap) {
      const capType = usageState.sessionSpent >= usageState.sessionCap ? 'session' : 'day';
      const capValue = capType === 'session' ? usageState.sessionCap : usageState.dayCap;
      reportStatus({
        currentName: `AI spend cap reached (${capType} max $${capValue.toFixed(2)})`,
      });
      return;
    }

    const candidates = collectCandidates();
    if (!candidates.length) {
      reportStatus({ currentName: 'No clickable unsubscribe action found on this page' });
      return;
    }

    const signature = pageSignature(pageText, candidates);
    if (signature === lastPageSignature) return;
    lastPageSignature = signature;
    aiRunInFlight = true;

    reportStatus({ processing: true, currentName: 'AI reviewing external unsubscribe page…' });

    try {
      const result = await askOpenRouter(apiKey, pageText, candidates);
      const nextUsage = {
        ...usageState,
        lastModel: result.model || usageState.lastModel || DEFAULT_MODEL,
        lastCost: result.cost,
        sessionSpent: usageState.sessionSpent + result.cost,
        daySpent: usageState.daySpent + result.cost,
        sessionCalls: usageState.sessionCalls + 1,
        callsToday: usageState.callsToday + 1,
      };
      await setAiUsageState(nextUsage);

      const decision = result.decision;
      if (!decision || typeof decision !== 'object') {
        throw new Error('Invalid OpenRouter decision payload.');
      }

      if (decision.action === 'done') {
        reportStatus({ currentName: 'External unsubscribe complete' });
        return;
      }

      if (decision.action === 'wait') {
        reportStatus({ currentName: 'Waiting for external page to finish loading…' });
        setTimeout(() => { maybeContinueUnsubscribe(); }, 1500);
        return;
      }

      if (decision.action !== 'click') {
        reportStatus({ currentName: 'AI could not find a safe unsubscribe action' });
        return;
      }

      const target = candidates.find(candidate => candidate.id === decision.elementId);
      if (!target) {
        reportStatus({ currentName: 'AI selected a missing page action' });
        return;
      }

      if (!isSafeChoice(target)) {
        reportStatus({ currentName: 'Blocked an unsafe AI-suggested page action' });
        return;
      }

      flashElement(target.element);
      reportStatus({ processing: true, currentName: `AI clicking "${target.label || target.text || target.href}"` });
      await sleep(350);
      target.element.click();
      setTimeout(() => { maybeContinueUnsubscribe(); }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown OpenRouter failure';
      reportStatus({ currentName: `AI assist failed: ${message}` });
    } finally {
      aiRunInFlight = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action !== 'maybeContinueUnsubscribe') return;
    maybeContinueUnsubscribe();
    sendResponse({ ok: true });
    return true;
  });
})();
