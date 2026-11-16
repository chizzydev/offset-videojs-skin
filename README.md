# OFFSET
## Live Demo

**Try OFFSET:** https://offset-videojs-skin-production.up.railway.app

Source: https://github.com/chizzydev/offset-videojs-skin


**One video. Two times.**

OFFSET is a custom Video.js v10 temporal-comparison skin. A viewer can pin an earlier moment without losing live playback, then compare the same source at two different timestamps.

Instead of repeatedly rewinding to remember what changed, OFFSET turns time itself into part of the player interface.

## Signature interaction

When the browser exposes `requestVideoFrameCallback`, Pin uses the timestamp of the frame actually presented on screen rather than only the advancing media clock. Browsers without that API fall back cleanly to `currentTime`.


1. Play the video.
2. Press **R** or choose **Pin this moment**.
3. Keep watching â€” the reference stays fixed while LIVE continues.
4. Compare the two temporal positions with:
   - **Wipe** â€” drag the in-frame divider to reveal either moment.
   - **Duo** â€” place both moments side-by-side inside the same player stage.
   - **Onion** â€” overlay the reference with adjustable opacity.
5. Move the lime **R** marker independently on the temporal caliper.
6. Read the exact signed `Î”t` between REFERENCE and LIVE.

The core idea is simple: **pin what was, keep watching what is, measure what changed.**

## Why it is a Video.js v10 skin

OFFSET is built around Video.js v10 React primitives rather than wrapping an unrelated player UI. It composes:

- `Container`
- `Controls`
- `TimeSlider`
- `PlayButton`
- `MuteButton`
- `FullscreenButton`
- `Hotkey`
- `StatusAnnouncer`
- `ErrorDialog`

The temporal-comparison layer adds one silent native video surface using the same source as the live Video.js media element. No canvas pixel capture is required, so cross-origin media playback does not depend on canvas/CORS access.

## Controls

- **R** â€” pin / repin the current live moment
- **Esc** â€” clear the reference
- **Space** â€” play / pause
- **M** â€” mute
- **F** â€” fullscreen
- **â† / â†’** â€” seek live playback by 5 seconds

### Wipe divider

- Drag the `â†”` divider directly
- `â† / â†’` â€” adjust 1%
- `Shift + â† / â†’` â€” adjust 5%
- `Home / End` â€” move to comparison bounds
- Double-click â€” reset to 50%

### Reference marker

- Drag the lime **R** marker on the timeline
- `â† / â†’` â€” move reference 1 second
- `Shift + â† / â†’` â€” move reference 0.1 second
- `Home / End` â€” move to the beginning / end

## Accessibility and responsive behavior

OFFSET keeps all custom interactions available through visible controls as well as keyboard shortcuts. It includes:

- visible `:focus-visible` treatment
- ARIA labels and slider values for custom comparison controls
- live-region announcements for custom reference changes
- Video.js status announcements for playback state
- reduced-motion support
- forced-colors support
- pointer/touch drag targets
- stable 16:9 stage across Wipe, Duo, and Onion
- compact and narrow-screen layouts

## Stack

- Video.js / `@videojs/react` 10.4.0
- React 19
- TypeScript
- Vite

## Run locally

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\RUN_WINDOWS.ps1
```

The runner installs the pinned dependencies, executes the production build gate, starts the Vite production preview on `127.0.0.1:4173`, and opens the bundled hero demo.

Default demo:

```text
http://127.0.0.1:4173/
```

The earlier remote Mux sample remains available as an optional fallback/source-compatibility check:

```text
http://127.0.0.1:4173/?remote=1
```

## Demo media

The bundled hero demo uses **â€œMen Doing Sparringâ€** by **Pavel Danilyuk**, sourced from Pexels (1920Ã—1080, 16:9, 25 fps, ~20 s) and re-encoded for web delivery / responsive seeking.

- Source: https://www.pexels.com/video/men-doing-sparring-6296481/
- License: https://www.pexels.com/license/

The footage is used to demonstrate OFFSET's temporal-comparison interaction: pin one combat position, keep watching, then inspect how distance, guard, stance, and relative position changed with Wipe, Duo, or Onion.
## Product principle

OFFSET deliberately avoids becoming an editor, annotation suite, transcript tool, or AI product. Its entire interface is organized around one reusable player-level capability:

> **Compare one video against itself at another moment without losing where you are.**

## Source and browser scope

The reference surface requires a directly playable, seekable video URL matching the live source (the demo uses progressive MP4). Adaptive streams, DRM, embedded providers, and live/DVR sources are not supported by the plain reference video. Media servers must permit playback and seeking; avoiding canvas removes pixel-readback CORS requirements, not server access restrictions.

On iPhone Safari, Video.js uses native video fullscreen, which does not include OFFSET's comparison overlays. Use inline playback for comparison there. Element fullscreen on supported browsers keeps the custom interface.

The signed delta is LIVE minus REFERENCE: positive means live is ahead; negative means the reference is ahead. Pin prefers a fresh presented-frame timestamp where supported. The reference is decoded by a separate video element, so timestamps do not imply millisecond visual-frame precision.

## Verification

```powershell
npm run test:reference
npm run build
```

The focused tests cover reference loading, cancellation, retries, failures, end clamping, and listener cleanup. They use a media-event test double; actual decoding, presented-frame accuracy, and browser accessibility still require the manual checks in `ACCEPTANCE.md`. `OFFSET_BUILD_GATE=PASS` is printed by `RUN_WINDOWS.ps1` after a successful build, not by `npm run build` itself.


