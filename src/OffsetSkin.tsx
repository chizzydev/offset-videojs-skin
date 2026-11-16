import {
  Container,
  Controls,
  ErrorDialog,
  FullscreenButton,
  Hotkey,
  MuteButton,
  PlayButton,
  StatusAnnouncer,
  Time,
  TimeSlider,
  selectTime,
} from '@videojs/react';
import type { CSSProperties, ReactNode, RefObject, PointerEvent as ReactPointerEvent } from 'react';
import { usePlayer } from './player';
import { captureReference } from './reference-media';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type CompareMode = 'wipe' | 'split' | 'ghost';
type OffsetSkinProps = {
  children: ReactNode;
  source: string;
  mediaRef: RefObject<HTMLVideoElement | null>;
  style?: CSSProperties;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatClock(seconds: number, millis = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  const base = `${mins}:${String(secs).padStart(2, '0')}`;
  if (!millis) return base;
  return `${base}.${String(Math.floor(seconds * 1000 + 1e-7) % 1000).padStart(3, '0')}`;
}

function Icon({ name }: { name: 'play' | 'pause' | 'volume' | 'muted' | 'expand' | 'collapse' | 'pin' | 'close' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'play') return <svg {...common}><path d="M8 5v14l11-7z" fill="currentColor" stroke="none" /></svg>;
  if (name === 'pause') return <svg {...common}><path d="M8 5v14M16 5v14" /></svg>;
  if (name === 'volume') return <svg {...common}><path d="M5 10v4h4l5 4V6L9 10H5zM17 9a4 4 0 0 1 0 6" /></svg>;
  if (name === 'muted') return <svg {...common}><path d="M5 10v4h4l5 4V6L9 10H5zM18 9l4 6M22 9l-4 6" /></svg>;
  if (name === 'expand') return <svg {...common}><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" /></svg>;
  if (name === 'collapse') return <svg {...common}><path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" /></svg>;
  if (name === 'pin') return <svg {...common}><path d="m14 4 6 6-3 1-4 4-1 5-2-2-2-2-2-2 5-1 4-4 1-3zM6 18l-3 3" /></svg>;
  return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

function ModeGlyph({ mode }: { mode: CompareMode }) {
  if (mode === 'wipe') {
    return <span className="mode-glyph mode-glyph-wipe" aria-hidden="true"><i /><b /></span>;
  }
  if (mode === 'split') {
    return <span className="mode-glyph mode-glyph-split" aria-hidden="true"><i /><b /></span>;
  }
  return <span className="mode-glyph mode-glyph-ghost" aria-hidden="true"><i /><b /></span>;
}

export function OffsetSkin({ children, source, mediaRef, style }: OffsetSkinProps) {
  const time = usePlayer(selectTime);
  const referenceVideoRef = useRef<HTMLVideoElement>(null);
  const referenceToggleRef = useRef<HTMLButtonElement>(null);
  const referenceDragValue = useRef<number | null>(null);
  const referenceRequestId = useRef(0);
  const referenceAbort = useRef<AbortController | null>(null);
  const presentedFrameRef = useRef<{ mediaTime: number; wallTime: number } | null>(null);
  const [referenceTime, setReferenceTime] = useState<number | null>(null);
  const [referenceReady, setReferenceReady] = useState(false);
  const [mode, setMode] = useState<CompareMode>('wipe');
  const [wipe, setWipe] = useState(52);
  const [ghost, setGhost] = useState(42);
  const [announcement, setAnnouncement] = useState('');
  const [referenceError, setReferenceError] = useState('');

  const currentTime = time?.currentTime ?? mediaRef.current?.currentTime ?? 0;
  const duration = time?.duration ?? mediaRef.current?.duration ?? 0;

  // Track the timestamp of the frame Chromium actually presented, not just the
  // advancing media clock. This lets R / Pin capture the moment the viewer saw.
  // The reference-video path remains seek-based and does not depend on this API.
  useEffect(() => {
    let cancelled = false;
    let attachRaf = 0;
    let frameCallbackId = 0;
    let attachedVideo: HTMLVideoElement | null = null;

    presentedFrameRef.current = null;

    const attach = () => {
      if (cancelled) return;
      const video = mediaRef.current;
      if (!video) {
        attachRaf = requestAnimationFrame(attach);
        return;
      }

      attachedVideo = video;
      if (typeof video.requestVideoFrameCallback !== 'function') return;

      const onFrame = (_now: number, metadata: { mediaTime: number }) => {
        if (cancelled) return;
        presentedFrameRef.current = {
          mediaTime: metadata.mediaTime,
          wallTime: performance.now(),
        };
        frameCallbackId = video.requestVideoFrameCallback(onFrame);
      };

      frameCallbackId = video.requestVideoFrameCallback(onFrame);
    };

    attach();

    return () => {
      cancelled = true;
      presentedFrameRef.current = null;
      if (attachRaf) cancelAnimationFrame(attachRaf);
      if (attachedVideo && frameCallbackId && typeof attachedVideo.cancelVideoFrameCallback === 'function') {
        attachedVideo.cancelVideoFrameCallback(frameCallbackId);
      }
    };
  }, [mediaRef, source]);

  const hasFiniteDuration = Number.isFinite(duration) && duration > 0;
  const referencePercent = hasFiniteDuration && referenceTime !== null
    ? clamp((referenceTime / duration) * 100, 0, 100)
    : 0;
  const currentPercent = hasFiniteDuration ? clamp((currentTime / duration) * 100, 0, 100) : 0;

  const delta = referenceTime === null ? 0 : currentTime - referenceTime;
  const deltaStart = Math.min(referencePercent, currentPercent);
  const deltaWidth = Math.abs(currentPercent - referencePercent);

  const normalizeReferenceTime = useCallback((target: number) => {
    if (!Number.isFinite(target)) return 0;
    if (Number.isFinite(duration) && duration > 0) {
      return clamp(target, 0, Math.max(0, duration - 0.001));
    }
    return Math.max(0, target);
  }, [duration]);

  const setReference = useCallback((target: number, announce = true) => {
    const safeTarget = normalizeReferenceTime(target);
    referenceAbort.current?.abort();
    const controller = new AbortController();
    referenceAbort.current = controller;
    const requestId = ++referenceRequestId.current;
    setReferenceTime(safeTarget);
    setReferenceReady(false);
    setReferenceError('');
    const video = referenceVideoRef.current;
    if (!video) return;
    void captureReference(video, safeTarget, controller.signal).then((capturedTime) => {
      if (requestId !== referenceRequestId.current) return;
      setReferenceTime(capturedTime);
      setReferenceReady(true);
      if (announce) setAnnouncement(`Reference pinned at ${formatClock(capturedTime, true)}. Keep watching to compare.`);
    }).catch(() => {
      if (requestId !== referenceRequestId.current) return;
      setReferenceReady(false);
      setReferenceTime(null);
      setReferenceError('Reference could not be loaded. Try pinning again.');
      setAnnouncement('Reference frame could not be loaded for this source');
    });
  }, [normalizeReferenceTime]);

  const pinNow = useCallback(() => {
    if (document.activeElement?.matches('.offset-pin-hero')) referenceToggleRef.current?.focus();
    const media = mediaRef.current;
    let target = media?.currentTime ?? currentTime;
    const presented = presentedFrameRef.current;

    // While playing, currentTime can be slightly ahead of the pixels currently
    // on screen. Prefer the most recently presented frame when it is fresh and
    // still agrees with the live media clock. Paused/seeking/unsupported cases
    // intentionally fall back to currentTime.
    if (media && !media.paused && !media.seeking && presented) {
      const ageMs = performance.now() - presented.wallTime;
      const clockGap = Math.abs(target - presented.mediaTime);
      if (ageMs <= 250 && clockGap <= 0.25) {
        target = presented.mediaTime;
      }
    }

    setReference(target);
  }, [currentTime, mediaRef, setReference]);

  const clearReference = useCallback(() => {
    if (document.activeElement?.closest('.offset-compare-toolbar, .reference-marker, .offset-wipe-line, .offset-floating-range')) {
      referenceToggleRef.current?.focus();
    }
    referenceRequestId.current += 1;
    referenceAbort.current?.abort();
    referenceDragValue.current = null;
    setReferenceError('');
    setReferenceTime(null);
    setReferenceReady(false);
    setAnnouncement('Reference cleared');
  }, []);

  useEffect(() => {
    referenceRequestId.current += 1;
    referenceAbort.current?.abort();
    referenceDragValue.current = null;
    setReferenceError('');
    setReferenceTime(null);
    setReferenceReady(false);
    return () => {
      referenceRequestId.current += 1;
      referenceAbort.current?.abort();
      referenceDragValue.current = null;
    };
  }, [source]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
      if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        pinNow();
      }
      if (event.key === 'Escape' && referenceTime !== null) {
        event.preventDefault();
        clearReference();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clearReference, pinNow, referenceTime]);

  const adjustReference = useCallback((seconds: number) => {
    if (referenceTime === null) return;
    setReference(referenceTime + seconds, false);
  }, [referenceTime, setReference]);

  const pointerReferenceTime = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const caliper = event.currentTarget.closest('.offset-caliper');
    if (!caliper || !Number.isFinite(duration) || duration <= 0) return null;
    const bounds = caliper.getBoundingClientRect();
    const ratio = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    return normalizeReferenceTime(ratio * duration);
  }, [duration, normalizeReferenceTime]);

  const pointerWipePercent = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const stage = event.currentTarget.closest('.offset-stage');
    if (!stage) return null;
    const bounds = stage.getBoundingClientRect();
    const ratio = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
    return clamp(ratio * 100, 8, 92);
  }, []);

  const referenceLabel = useMemo(() => {
    if (referenceTime === null) return 'No reference pinned';
    return `Reference ${formatClock(referenceTime, true)}`;
  }, [referenceTime]);

  return (
    <Container
      className="offset-player"
      aria-label="OFFSET temporal comparison video player"
      data-compare-mode={referenceTime === null ? 'off' : mode}
      data-reference-ready={referenceReady || undefined}
      style={style}
    >
      <div className="offset-stage">
        <div className="offset-live-plane">{children}</div>
        <div
          className="offset-reference-plane"
          aria-hidden="true"
          style={
            {
              '--offset-wipe': `${wipe}%`,
              '--offset-ghost': `${ghost / 100}`,
            } as CSSProperties
          }
        >
          <video
            ref={referenceVideoRef}
            className="offset-reference-video"
            src={source}
            muted
            playsInline
            preload="auto"
            tabIndex={-1}
          />
        </div>

        {referenceTime !== null && mode === 'wipe' && (
          <button
            type="button"
            className="offset-wipe-line offset-wipe-slider"
            style={{ left: `${wipe}%` }}
            role="slider"
            aria-orientation="horizontal"
            aria-label="Comparison wipe position"
            aria-valuemin={8}
            aria-valuemax={92}
            aria-valuenow={Math.round(wipe)}
            aria-valuetext={`${Math.round(wipe)} percent reference`}
            title="Drag left or right to compare moments · Arrow keys adjust"
            onPointerDown={(event) => {
              event.preventDefault();
              const next = pointerWipePercent(event);
              if (next === null) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setWipe(next);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const next = pointerWipePercent(event);
              if (next !== null) setWipe(next);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onDoubleClick={() => setWipe(50)}
            // Video.js listens natively on Container, before React bubble handlers.
            onKeyDownCapture={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.stopPropagation();
              const step = event.shiftKey ? 5 : 1;
              if (event.key === 'ArrowLeft') { event.preventDefault(); setWipe((value) => clamp(value - step, 8, 92)); }
              if (event.key === 'ArrowRight') { event.preventDefault(); setWipe((value) => clamp(value + step, 8, 92)); }
              if (event.key === 'Home') { event.preventDefault(); setWipe(8); }
              if (event.key === 'End') { event.preventDefault(); setWipe(92); }
            }}
          >
            <span className="wipe-handle" aria-hidden="true"><span>↔</span></span>
          </button>
        )}

        <div className="offset-corner offset-corner-reference" data-visible={referenceTime !== null || undefined}>
          <span className="corner-dot" />
          <span>REFERENCE</span>
          <strong>{referenceTime === null ? '—' : referenceReady ? formatClock(referenceTime, true) : 'Loading…'}</strong>
        </div>
        <div className="offset-corner offset-corner-live">
          <span className="corner-dot" />
          <span>LIVE</span>
          <strong>{formatClock(currentTime, true)}</strong>
        </div>

        {referenceTime === null ? (
          <button className="offset-pin-hero" type="button" onClick={pinNow} aria-keyshortcuts="R">
            <span className="pin-hero-icon"><Icon name="pin" /></span>
            <span><strong>Pin this moment</strong><small>Keep watching without losing it</small></span>
            <kbd>R</kbd>
          </button>
        ) : (
          <div className="offset-compare-toolbar" aria-label="Comparison view">
            {(['wipe', 'split', 'ghost'] as CompareMode[]).map((item) => (
              <button
                key={item}
                type="button"
                aria-label={item === 'ghost' ? 'Onion' : item === 'split' ? 'Duo' : 'Wipe'}
                title={item === 'ghost' ? 'Onion' : item === 'split' ? 'Duo' : 'Wipe'}
                aria-pressed={mode === item}
                className="mode-button"
                onClick={() => setMode(item)}
              >
                <ModeGlyph mode={item} />
                <span>{item === 'ghost' ? 'Onion' : item === 'split' ? 'Duo' : 'Wipe'}</span>
              </button>
            ))}
            <span className="toolbar-divider" aria-hidden="true" />
            <button type="button" className="mode-button repin-button" aria-label="Repin" title="Repin current moment" onClick={pinNow} aria-keyshortcuts="R">
              <Icon name="pin" /><span>Repin</span>
            </button>
            <button type="button" className="toolbar-icon-button" onClick={clearReference} aria-label="Clear reference" aria-keyshortcuts="Escape">
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>

      {referenceTime !== null && mode === 'wipe' && (
        <label className="offset-floating-range offset-floating-range-wipe">
          <span>WIPE</span>
          <input
            type="range"
            min="8"
            max="92"
            step="1"
            value={wipe}
            onChange={(event) => setWipe(Number(event.currentTarget.value))}
            aria-label="Comparison wipe position"
          />
          <output>{Math.round(wipe)}%</output>
        </label>
      )}
      {referenceTime !== null && mode === 'ghost' && (
        <label className="offset-floating-range offset-floating-range-ghost">
          <span>REF OPACITY</span>
          <input
            type="range"
            min="10"
            max="90"
            step="1"
            value={ghost}
            onChange={(event) => setGhost(Number(event.currentTarget.value))}
            aria-label="Reference opacity"
          />
          <output>{ghost}%</output>
        </label>
      )}

      {referenceError && <div className="offset-reference-status" role="status">{referenceError}</div>}

      <Controls.Root>
        <Controls.Content className="offset-controls">
          <div className="offset-caliper" data-active={referenceTime !== null || undefined}>
            {referenceTime !== null && (
              <>
                <div
                  className="delta-span"
                  style={{ left: `${deltaStart}%`, width: `${Math.max(deltaWidth, 0.2)}%` }}
                  aria-hidden="true"
                />
                <div
                  className="delta-chip"
                  style={{ left: `${clamp((referencePercent + currentPercent) / 2, 8, 92)}%` }}
                  aria-label={`Live is ${Math.abs(delta).toFixed(2)} seconds ${delta >= 0 ? 'ahead of' : 'behind'} reference`}
                >
                  Δ {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(2)}s
                </div>
                <button
                  type="button"
                  className="reference-marker"
                  role="slider"
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={hasFiniteDuration ? Math.max(0, duration - 0.001) : 0}
                  aria-valuenow={referenceTime}
                  aria-valuetext={formatClock(referenceTime, true)}
                  style={{ left: `${referencePercent}%` }}
                  aria-label={`${referenceLabel}. Use arrow keys to move it.`}
                  aria-keyshortcuts="ArrowLeft ArrowRight Home End"
                  title="Reference time · Arrow keys move · Shift = fine step"
                  onKeyDownCapture={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.stopPropagation();
                    const fine = event.shiftKey ? 0.1 : 1;
                    if (event.key === 'ArrowLeft') { event.preventDefault(); adjustReference(-fine); }
                    if (event.key === 'ArrowRight') { event.preventDefault(); adjustReference(fine); }
                    if (event.key === 'Home') { event.preventDefault(); setReference(0, false); }
                    if (event.key === 'End') { event.preventDefault(); setReference(duration, false); }
                  }}
                  onPointerDown={(event) => {
                    const next = pointerReferenceTime(event);
                    if (next === null) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    referenceRequestId.current += 1;
                    referenceAbort.current?.abort();
                    referenceDragValue.current = next;
                    setReferenceReady(false);
                    setReferenceTime(next);
                  }}
                  onPointerMove={(event) => {
                    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                    const next = pointerReferenceTime(event);
                    if (next === null) return;
                    referenceDragValue.current = next;
                    setReferenceTime(next);
                  }}
                  onPointerUp={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    const next = referenceDragValue.current;
                    referenceDragValue.current = null;
                    if (next !== null) setReference(next, false);
                  }}
                  onPointerCancel={() => {
                    const next = referenceDragValue.current;
                    referenceDragValue.current = null;
                    if (next !== null) setReference(next, false);
                  }}
                >
                  <span className="reference-marker-pin" />
                  <span className="reference-marker-label">R</span>
                </button>
              </>
            )}

            <TimeSlider.Root className="offset-time-slider" aria-label="Live playback position">
              <TimeSlider.Track className="offset-time-track">
                <TimeSlider.Buffer className="offset-time-buffer" />
                <TimeSlider.Fill className="offset-time-fill" />
              </TimeSlider.Track>
              <TimeSlider.Thumb className="offset-time-thumb" />
              <TimeSlider.Preview className="offset-time-preview">
                <TimeSlider.Value type="pointer" />
              </TimeSlider.Preview>
            </TimeSlider.Root>
          </div>

          <div className="offset-control-row">
            <Controls.Group className="offset-control-group offset-control-group-left">
              <PlayButton
                className="offset-icon-control offset-play"
                render={(props, state) => (
                  <button {...props}>{state.paused ? <Icon name="play" /> : <Icon name="pause" />}</button>
                )}
              />
              <MuteButton
                className="offset-icon-control"
                render={(props, state) => (
                  <button {...props}>{state.muted || state.volumeLevel === 'off' ? <Icon name="muted" /> : <Icon name="volume" />}</button>
                )}
              />
              <Time.Group className="offset-time-readout">
                <Time.Value type="current" />
                <Time.Separator />
                <Time.Value type="duration" />
              </Time.Group>
            </Controls.Group>

            <div className="offset-wordmark" aria-hidden="true">
              <span className="wordmark-mark"><i /><b /></span>
              <strong>OFFSET</strong>
            </div>

            <Controls.Group className="offset-control-group offset-control-group-right">
              <button
                type="button"
                ref={referenceToggleRef}
                className="offset-reference-toggle"
                title={referenceTime === null ? 'Pin current moment' : 'Clear reference'}
                onClick={referenceTime === null ? pinNow : clearReference}
                aria-label={referenceTime === null ? 'Pin current moment as reference' : 'Clear reference moment'}
                aria-pressed={referenceTime !== null}
                aria-keyshortcuts={referenceTime === null ? 'R' : 'Escape'}
              >
                <Icon name={referenceTime === null ? 'pin' : 'close'} />
                <span>{referenceTime === null ? 'PIN' : 'CLEAR'}</span>
              </button>
              <FullscreenButton
                className="offset-icon-control"
                render={(props, state) => (
                  <button {...props}>{state.fullscreen ? <Icon name="collapse" /> : <Icon name="expand" />}</button>
                )}
              />
            </Controls.Group>
          </div>
        </Controls.Content>
      </Controls.Root>

      <Hotkey keys="Space" action="togglePaused" />
      <Hotkey keys="m" action="toggleMuted" />
      <Hotkey keys="f" action="toggleFullscreen" />
      <Hotkey keys="ArrowLeft" action="seekStep" value={-5} />
      <Hotkey keys="ArrowRight" action="seekStep" value={5} />
      <StatusAnnouncer className="sr-only" />
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      <ErrorDialog.Root>
        <ErrorDialog.Backdrop className="offset-error-backdrop" />
        <ErrorDialog.Popup className="offset-error">
          <ErrorDialog.Title className="offset-error-title" />
          <ErrorDialog.Description className="offset-error-description" />
          <ErrorDialog.Close className="offset-error-close">Dismiss</ErrorDialog.Close>
        </ErrorDialog.Popup>
      </ErrorDialog.Root>
    </Container>
  );
}
