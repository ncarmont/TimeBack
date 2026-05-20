ECO# TimeBack Product Hunt Kit

Use these assets and words for launch. Product Hunt's current help docs still
recommend a `240 x 240` square thumbnail and `1270 x 760` gallery images, with
at least two gallery images required.

Spec sources checked on May 20, 2026:

- https://help.producthunt.com/en/articles/479557-how-to-post-a-product
- https://www.producthunt.com/launch/preparing-for-launch

## Product Truth

Product name: TimeBack

Primary audience: Chrome users, knowledge workers, founders, students, and
makers who lose focus to short-form feeds, social feeds, and newsletter clutter.

Urgent job: Reduce everyday attention leaks without replacing the user's
browser or email workflow.

Current painful workflow: Manually avoiding YouTube Shorts, clearing LinkedIn
feed distractions, and unsubscribing from Gmail senders one by one.

Input: Extension toggles, Gmail's subscriptions page, and an optional
user-provided OpenRouter API key for external unsubscribe pages.

Core action: Hide distracting surfaces, redirect Shorts, run Gmail unsubscribe
actions in sequence, and optionally ask OpenRouter which external unsubscribe
button is safe to click.

Output: Cleaner YouTube, cleaner LinkedIn, fewer Gmail subscriptions, local
counts, and estimated time saved.

Proof/mechanism: Manifest V3 content scripts, CSS rules and DOM checks for
YouTube and LinkedIn, Gmail subscription table automation, and a guarded
OpenRouter helper with per-session and per-day caps.

Trust/privacy facts: No bundled TimeBack backend or bundled API key. Settings
use Chrome storage. Optional OpenRouter assistance sends external unsubscribe
page context only when the user saves their own key.

Primary next action: Load the extension, turn on the blockers, and click
`Unsubscribe All` when Gmail subscriptions need cleanup.

Tone: Direct, calm, utility-first, and specific about privacy.

## Launch Position

TimeBack helps Chrome users reclaim attention by blocking Shorts, hiding feeds,
and cleaning Gmail subscriptions, without manually fighting the same loops every
day.

## Product Hunt Listing

Name:
TimeBack

Tagline:
Block Shorts, feeds, and newsletter clutter

Short description:
A Chrome extension that hides YouTube Shorts, YouTube Home, LinkedIn feed posts,
and bulk-unsubscribes from Gmail.

Description:
TimeBack is a Chrome extension for removing everyday attention traps. Toggle
YouTube Shorts, YouTube Home, and LinkedIn feed blockers, then open Gmail's
subscriptions page to unsubscribe in bulk. Optional OpenRouter assistance handles
external unsubscribe pages with your own locally stored key and visible spend
caps.

Topics:
Productivity, Email, Browser Extensions, Open Source

Pricing:
Free and open source

## Gallery Image Order

1. `public/product-hunt/gallery-01-hero.png`
   Caption: Reclaim hours from feeds and subscriptions.

2. `public/product-hunt/gallery-02-steps.png`
   Caption: Turn on the blockers you need.

3. `public/product-hunt/gallery-03-ask.png`
   Caption: Choose exactly what gets hidden or cleaned up.

4. `public/product-hunt/gallery-04-proof.png`
   Caption: CSS rules, Gmail selectors, and safe AI assist do the work.

5. `public/product-hunt/gallery-05-results.png`
   Caption: Watch skipped items and unsubscribes turn into time-saved stats.

6. `public/product-hunt/gallery-06-action.png`
   Caption: Jump to Gmail, unsubscribe in sequence, pause, or resume.

7. `public/product-hunt/gallery-07-trust.png`
   Caption: No bundled backend or shared API key.

8. `public/product-hunt/gallery-08-outcomes.png`
   Caption: Built for YouTube, LinkedIn, Gmail, and daily attention leaks.

Thumbnail:
`public/product-hunt/thumbnail.png`

## Maker Comment

Hi Product Hunt, I built TimeBack around one repeated problem: tiny attention
leaks were turning into real hours lost across YouTube, LinkedIn, and Gmail.

The product is deliberately simple. Turn on the blockers you want, keep YouTube
and LinkedIn cleaner, and use Gmail's subscriptions page to unsubscribe from
senders in sequence.

The important part for me was keeping the trust model plain. There is no bundled
TimeBack backend or shared API key. Settings and counters live in Chrome storage,
and the optional OpenRouter assist only runs for external unsubscribe pages when
you provide your own key.

I would love feedback on the permission wording, the reliability of the Gmail
unsubscribe flow, and which distracting surfaces are worth supporting next.

## Social Posts

X:
Launching TimeBack on Product Hunt: block Shorts, feeds, and newsletter clutter
before they drain the day. Toggle focus blockers, bulk-clean Gmail
subscriptions, and keep optional AI assist behind your own local key.

LinkedIn:
I am launching TimeBack on Product Hunt.

It helps Chrome users reclaim attention by blocking YouTube Shorts, hiding the
YouTube Home and LinkedIn feeds, and bulk-cleaning Gmail subscriptions.

Built for research days, deep work blocks, inbox cleanup, and those moments when
one quick check turns into twenty minutes.

Launch question:
Which feed, inbox habit, or short-form loop steals the most time from your week?

## Comment Replies

If someone asks how it works:
TimeBack uses Manifest V3 content scripts. YouTube and LinkedIn are handled with
CSS rules plus DOM checks for surfaces that change dynamically. Gmail cleanup
runs from Gmail's subscriptions page and clicks unsubscribe actions one at a
time.

If someone asks about privacy:
There is no bundled TimeBack backend or shared API key. Settings are stored in
Chrome storage. Optional OpenRouter assistance only runs on external unsubscribe
pages when you save your own key; it sends page context and clickable candidates
so the model can pick a safe next action.

If someone asks who it is for:
It is for Chrome users who want fewer attention traps without changing browsers,
email clients, or social accounts. The strongest use cases are deep work,
research sessions, inbox cleanup, and reducing short-form content loops.

If someone asks what is next:
The next improvements I am considering are clearer permission controls, more
robust Gmail selector handling, and support for additional distracting surfaces
that people repeatedly ask to block.

## Launch-Day Checklist

- Upload `gallery-01-hero.png` first.
- Upload the rest of the gallery images in order.
- Use `thumbnail.png` as the square thumbnail.
- Paste the tagline exactly as written.
- Paste the description exactly as written unless the live Product Hunt editor
  reports a field-specific character limit.
- Post the maker comment shortly after launch.
- Ask the launch question to encourage useful comments.
- Share X and LinkedIn posts after the Product Hunt page is live.
- Reply to early comments with concrete product details, not upvote requests.

## Export Instructions

Regenerate media from the code-rendered source:

```bash
bash marketing/product-hunt/export-product-hunt-media.sh
```

Validate dimensions:

```bash
sips -g pixelWidth -g pixelHeight public/product-hunt/*.png
```
