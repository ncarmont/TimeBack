# TimeBack

TimeBack is an open-source Chrome extension for reclaiming attention from the
small loops that quietly drain the day: YouTube Shorts, YouTube Home, LinkedIn
feed posts, and newsletter clutter in Gmail.

The extension has no build step and no bundled backend. Load the folder in
Chrome, choose the blockers you want, and use the Gmail subscription cleanup
flow when your inbox needs a reset.

## What It Does

- Blocks YouTube Shorts shelves, Shorts search results, Shorts navigation, and
  redirects direct `/shorts/` visits to the normal YouTube watch page.
- Hides the YouTube home feed when you want YouTube search and watch pages
  without the recommendation loop.
- Hides LinkedIn feed posts while leaving the rest of LinkedIn available.
- Opens Gmail's subscriptions page and unsubscribes from visible subscription
  rows in sequence, with pause and resume controls.
- Optionally uses your own OpenRouter API key to continue unsubscribe flows on
  external sender pages.
- Shows local counters and estimated time saved.

## Install Locally

1. Clone or download this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on `Developer mode`.
4. Click `Load unpacked`.
5. Select this `TimeBack` folder.
6. Pin the extension and open the popup.

## Usage

Use the master toggle to turn all focus blockers on or off. Each pill controls
one surface: YouTube Shorts, YouTube Home, or LinkedIn Feed.

Click `Unsubscribe All` to open Gmail's subscriptions page. TimeBack waits for
Gmail to load the subscription table, then clicks each unsubscribe action one at
a time. The Gmail overlay and extension popup both expose pause and resume.

The OpenRouter field is optional. It is only needed when a sender opens an
external unsubscribe page outside Gmail and you want TimeBack to ask a model
which safe confirmation action to click.

## Privacy Model

TimeBack does not include a TimeBack server or bundled API key.

- Focus settings are stored in `chrome.storage.sync`.
- Counters, Gmail unsubscribe results, AI usage totals, and the optional
  OpenRouter key are stored in `chrome.storage.local`.
- YouTube and LinkedIn blocking is done with local CSS rules and DOM checks.
- Gmail cleanup runs in the Gmail tab.
- Optional off-site unsubscribe assistance sends the external page URL, title,
  visible text, and clickable action candidates to OpenRouter using your key.

See [PRIVACY.md](PRIVACY.md) for the full data-handling summary.

## Permissions

| Permission | Why TimeBack Uses It |
| --- | --- |
| `storage` | Saves blocker settings, counters, unsubscribe results, optional OpenRouter key, and AI usage caps. |
| `tabs` | Opens and focuses the Gmail subscriptions tab and sends status between the popup and content scripts. |
| `https://www.youtube.com/*` | Hides Shorts and Home recommendations on YouTube. |
| `https://www.linkedin.com/*` | Hides LinkedIn feed posts. |
| `https://mail.google.com/*` | Runs Gmail subscription cleanup. |
| `https://openrouter.ai/*` | Calls OpenRouter only when optional off-site unsubscribe assistance is enabled. |
| `<all_urls>` | Detects external unsubscribe pages opened from Gmail; the helper returns early unless the page looks like an unsubscribe flow. |

## Project Structure

```text
manifest.json       Chrome extension manifest
background.js       Service worker for Gmail tab tracking
popup.html          Extension popup markup
popup.css           Extension popup styles
popup.js            Popup state, settings, stats, and key controls
youtube.js          YouTube Shorts and Home blocker
linkedin.js         LinkedIn feed blocker
gmail.js            Gmail subscription cleanup automation
unsubscribe.js      Optional off-site unsubscribe assistant
icons/              Extension icons
marketing/          Product Hunt launch kit and export source
public/product-hunt Exported Product Hunt PNG assets
```

## Development

There is no package install or build step. Edit the source files, then reload the
extension from `chrome://extensions`.

Useful checks before publishing:

```bash
rg -n "(api[_-]?key|secret|token|password|client[_-]?secret|bearer|authorization|sk-)" .
sips -g pixelWidth -g pixelHeight icons/*.png public/product-hunt/*.png
```

## Product Hunt Assets

The launch copy, gallery plan, source HTML, and PNG exports live in
`marketing/product-hunt` and `public/product-hunt`.

Regenerate the Product Hunt images with:

```bash
bash marketing/product-hunt/export-product-hunt-media.sh
```

The gallery exports are `1270 x 760` PNGs and the thumbnail is a square
`240 x 240` PNG.

## License

MIT. See [LICENSE](LICENSE).
