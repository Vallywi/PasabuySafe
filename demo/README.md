# PasabuySafe Demo Video

A self-contained animated demo of PasabuySafe you can screen-record as a 2-minute walkthrough. No build step, no dependencies — just open the HTML file in a browser.

## Files

- `index.html` — the animated demo (single file, all CSS/JS inline)
- `README.md` — this file

## How to record

1. **Open the demo**
   ```bash
   # From the repo root
   xdg-open demo/index.html          # Linux
   open demo/index.html              # macOS
   start demo/index.html             # Windows
   ```

2. **Full-screen the browser** (F11) — the demo is designed for 1920×1080. The layout will still work at other sizes but 1080p gives the crispest output.

3. **Start your screen recorder** (OBS Studio, macOS Screenshot with Cmd+Shift+5, Windows Game Bar with Win+G, or the built-in browser screen recorder). Record the browser window.

4. **Click the "Start Demo" button** (or press Space). The demo auto-advances through 9 scenes for exactly **120 seconds**, then loops.

5. **Stop the recording** when you see the "Loop restart" flash at 2:00.

6. **Export as MP4** at 1920×1080, 30fps or 60fps. Both work fine on YouTube, Twitter/X, and LinkedIn.

## Keyboard shortcuts (during playback)

- `Space` — play / pause
- `→` — jump to next scene
- `←` — jump to previous scene
- `R` — restart from scene 1

## Scenes

| # | Duration | Content |
|---|---------:|---------|
| 1 | 0:00 – 0:08 | Title card — logo, tagline, "an anti-scam escrow for Filipino pasabuy" |
| 2 | 0:08 – 0:22 | The problem — a typical pasabuy scam pattern |
| 3 | 0:22 – 0:38 | The solution — escrow flow diagram, animated |
| 4 | 0:38 – 0:54 | Organizer flow — create a pasabuy, share link |
| 5 | 0:54 – 1:10 | Buyer flow — browse, join, deposit into escrow |
| 6 | 1:10 – 1:28 | Escrow state machine — Deposited → Delivered → Confirmed |
| 7 | 1:28 – 1:42 | Anti-scam guarantees — what the contract prevents |
| 8 | 1:42 – 1:52 | Refund safety net — deadline-triggered auto-refund |
| 9 | 1:52 – 2:00 | Call to action — try the live demo, view on GitHub |

Total: **120 seconds exactly.**

## Tips for a polished recording

- Close other tabs/apps so notifications don't interrupt the recording
- Disable browser extensions that inject UI (dark mode toggles, ad blockers with counters)
- Record at 60fps if your machine can handle it — the animations look silky
- If you want narration, record video first, add audio in post (Descript, CapCut, iMovie all work). Or use OBS to record system audio + mic in the same take.

## Preview screenshot

Open `index.html` and screenshot scene 1 to use as the video thumbnail on YouTube or Twitter.
