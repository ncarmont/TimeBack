# Privacy

TimeBack is a Chrome extension that runs in your browser. It does not include a
bundled backend service or a bundled API key.

## Data Stored By The Extension

- Focus settings for YouTube and LinkedIn are stored with `chrome.storage.sync`.
- Blocked-item counters, Gmail unsubscribe results, OpenRouter usage totals, and
  an optional OpenRouter API key are stored with `chrome.storage.local`.
- The optional OpenRouter key can be cleared from the popup at any time.

## Network Calls

The YouTube and LinkedIn blockers do not send data to a TimeBack server.

Gmail unsubscribe automation runs on Gmail's subscriptions page. If an
unsubscribe flow opens an external page and you have saved an OpenRouter key,
TimeBack may send the external page URL, title, visible page text, and clickable
action candidates to OpenRouter so the model can choose the safest next action.
The extension tracks a per-session and per-day spend cap for this optional
external-page assist.

## Permissions

TimeBack requests access to YouTube, LinkedIn, Gmail, OpenRouter, and all URLs.
The broad URL access is used by the optional off-site unsubscribe helper so it
can detect and continue unsubscribe flows that leave Gmail. The content script
returns early unless the page appears to be part of an unsubscribe flow.

Review the source before installing from an unpacked checkout.
