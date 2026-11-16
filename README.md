# OFFSET

**Two moments. One frame.**

**[Try the live demo](https://offset-videojs-skin-production.up.railway.app)** · [Source on GitHub](https://github.com/chizzydev/offset-videojs-skin)

Most video players help you navigate to one moment. OFFSET lets you pin a moment, keep watching, and compare the same video against itself at another point in time.

Built as a Video.js v10 skin, OFFSET goes beyond visual styling: it makes time itself part of the player interface. A frozen REFERENCE sits alongside LIVE playback, with three comparison views and a signed temporal caliper.

## Try it in 15 seconds

1. Play the bundled sparring video.
2. At roughly **2–3 seconds**, press **R** or choose **Pin this moment**.
3. Keep watching until roughly **6–8 seconds**, then pause.
4. Try **Wipe**, **Duo**, and **Onion**.
5. Move the lime **R** marker on the timeline independently of LIVE.
6. Watch the signed **Δ** change as the two positions move apart or cross.

Choose **Repin** to capture the current LIVE moment again, or **Clear reference** to start over. The highlighted **REF** button also clears the reference.

## Why OFFSET exists

Most players answer “Where am I in the video?” OFFSET adds “What changed between here and another moment?”

That comparison is useful for movement review, sports technique, demonstrations, transformations, choreography, and before/after inspection—without repeatedly rewinding and relying on memory.

**Pin what was. Keep watching what is. Measure what changed.**

## Comparison views

| View | Interaction |
| --- | --- |
| **Wipe** | Drag the divider to reveal REFERENCE and LIVE across the same frame. |
| **Duo** | Inspect two moments side by side; at narrow mobile widths, the views stack vertically. |
| **Onion** | Overlay REFERENCE on LIVE and adjust the reference opacity. |
| **Temporal caliper** | Move the reference marker independently and read the signed difference between the two timestamps. |

The delta is **LIVE − REFERENCE**. Positive means LIVE is ahead; negative means REFERENCE is ahead. Comparison modes share the same outer 16:9 stage.

## Signature interaction

Video.js drives the LIVE playback surface. A separate, silent, seekable video element displays a paused reference from the same source. Pinning and moving the reference do not seek LIVE.

During playback, Pin prefers a fresh presented-frame timestamp from `requestVideoFrameCallback` where supported. Paused, seeking, unsupported, or stale-timestamp cases fall back to `currentTime`. The reference remains fixed while LIVE continues; loading and seek completion are handled separately from playback.

No canvas pixel capture is required. This avoids canvas pixel-readback CORS requirements, while media playback and seeking still depend on the source server's access policies. Presented-frame-aware capture does not imply universal frame-perfect or millisecond-perfect visual accuracy.

## Controls

| Key | Action |
| --- | --- |
| **R** | Pin / repin the current LIVE moment |
| **Esc** | Clear the reference |
| **Space** | Play / pause |
| **M** | Mute / unmute |
| **F** | Enter / exit fullscreen |
| **Left / Right** | Seek LIVE by 5 seconds when focused on the player surface |

Playback shortcuts operate within the focused player. Visible Pin, Repin, Clear, and transport controls provide alternatives to shortcuts.

### Focused Wipe divider

Drag the divider, or use **Left / Right** to adjust by 1 percentage point and **Shift + Left / Right** by 5. **Home / End** reach the 8% / 92% bounds. Double-click resets to 50%. The range control mirrors the divider.

### Focused reference marker

Drag the lime **R** marker, or use **Left / Right** to move by 1 second and **Shift + Left / Right** by 0.1 seconds. **Home / End** reach the beginning / final valid reference position. These controls move REFERENCE only; Wipe keys move the divider only.

## Built on Video.js v10

OFFSET uses `@videojs/react` with `createPlayer` and `videoFeatures`. Its custom interface composes the actual Video.js primitives:

`Container`, `Controls`, `TimeSlider`, `PlayButton`, `MuteButton`, `FullscreenButton`, `Hotkey`, `StatusAnnouncer`, and `ErrorDialog`.

The comparison layer belongs to the player interface: it extends the media view and timeline rather than replacing Video.js playback with a separate application.

## Accessibility and responsive behavior

The implementation includes keyboard-operable custom controls, visible focus styling, accessible button names, slider values, reference-change live announcements, and Video.js playback status announcements. CSS provides reduced-motion and forced-colors treatments; custom drag controls support pointer/touch input.

Compact layouts adapt controls and labels while retaining the same outer 16:9 stage across modes. These are implemented capabilities, not a claim of an automated accessibility or cross-browser certification.

## Stack

| Package | Version declared in `package.json` |
| --- | --- |
| `@videojs/react` | `10.4.0` |
| `react` / `react-dom` | `19.3.1` |
| `typescript` | `^5.9.3` |
| `vite` | `8.3.8` |
| `@vitejs/plugin-react` | `6.3.0` |

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite. For a production preview on a fixed local port:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

- [Bundled sparring demo](http://127.0.0.1:4173/)
- [Optional remote Mux sample](http://127.0.0.1:4173/?remote=1)

On Windows, `pwsh -NoProfile -ExecutionPolicy Bypass -File .\RUN_WINDOWS.ps1` installs dependencies when needed, builds, and opens the production preview on port 4173.

## Verification

```sh
npm run test:reference
npm run build
```

The 10 focused tests cover first pin at zero, decoded-data readiness, same-target repins, rapid metadata-stage repins, end clamping, cancellation, media errors, timeouts, listener cleanup, cancellation before paint, and retry after a failed request. They use a media-event test double; they do not automate browser decoding, visual frame accuracy, or accessibility testing.

The build runs TypeScript checking and Vite production bundling.

## Demo footage

**“Men Doing Sparring” by Pavel Danilyuk / Pexels** demonstrates continuous changes in distance, guard, stance, and relative position—useful landmarks for comparing two moments.

[Original footage](https://www.pexels.com/video/men-doing-sparring-6296481/) · [Pexels license](https://www.pexels.com/license/)

## Scope and limitations

- Directly playable, seekable video sources are the target. The plain reference element does not provide DRM, embedded-provider, live/DVR, or universal adaptive-stream support.
- On iPhone Safari, native video fullscreen cannot include custom comparison overlays. Use inline playback for comparison there.
- Visual accuracy depends on browser seeking, frame cadence, and decoding; displayed timestamp precision is not a guarantee of matching visual precision.
- The reference uses a second media element, so decoder memory, buffering, and network/cache behavior depend on the browser and source.

## License

This challenge entry is released under the [Apache License 2.0](LICENSE). The demo footage remains subject to the Pexels license linked above.
