# TimeBack Product Hunt Gallery Plan

| Order | Filename | Slide Role | Kicker | Headline | Subline | Visual | Proof Source |
|---:|---|---|---|---|---|---|---|
| 1 | `gallery-01-hero.png` | Hook | TimeBack | Reclaim your day | Block Shorts, feeds, and newsletter clutter from one Chrome extension. | Popup UI with blockers and time saved | `popup.html`, `popup.js`, `manifest.json` |
| 2 | `gallery-02-steps.png` | Workflow | Three switches | Turn noise off | Pick the blockers, browse cleaner pages, and let stats update locally. | Three-step workflow | `popup.html`, `youtube.js`, `linkedin.js` |
| 3 | `gallery-03-ask.png` | Input | Your inputs | Choose the leaks | The only setup is toggles, Gmail subscriptions, and an optional OpenRouter key. | Toggle and key settings | `popup.html`, `popup.js` |
| 4 | `gallery-04-proof.png` | Mechanism | How it works | Runs in Chrome | Content scripts hide known feed surfaces; Gmail automation works from the subscriptions page. | Chrome content script flow | `youtube.js`, `linkedin.js`, `gmail.js` |
| 5 | `gallery-05-results.png` | Output | Clear result | See time saved | Blocked Shorts, hidden videos, feed posts, and unsubs roll into weekly impact. | Stats and saved-time panel | `popup.html`, `popup.js`, `gmail.js` |
| 6 | `gallery-06-action.png` | Next move | Next action | Clean Gmail faster | Open the subscriptions page, unsubscribe in sequence, pause or resume any time. | Gmail overlay and progress | `background.js`, `gmail.js` |
| 7 | `gallery-07-trust.png` | Trust | Trust facts | No shared backend | Settings stay in Chrome storage. Optional AI uses your own OpenRouter key. | Trust flow and storage facts | `popup.js`, `unsubscribe.js`, `PRIVACY.md` |
| 8 | `gallery-08-outcomes.png` | Payoff | Built for focus | Win back hours | Use it for research days, deep work, inbox cleanup, and social media boundaries. | Outcome tiles | Product brief and README |

## Slide Rules

- One headline idea per slide.
- Use real product workflow words: blockers, Gmail subscriptions, OpenRouter key,
  pause, resume, local counters.
- Keep privacy claims precise.
- Do not imply that optional OpenRouter requests stay local.
- Keep filenames and upload order identical to the launch kit.
