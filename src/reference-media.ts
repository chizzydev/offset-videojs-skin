/** Seek one paused reference surface. Never wait on rVFC for paused media. */
export async function captureReference(
  video: HTMLVideoElement,
  target: number,
  signal: AbortSignal,
  timeoutMs = 15000,
): Promise<number> {
  const waitFor = (ready: () => boolean, start?: () => void) => new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked'];
    const cleanup = () => {
      clearTimeout(timer);
      events.forEach((name) => video.removeEventListener(name, check));
      video.removeEventListener('error', fail);
      signal.removeEventListener('abort', abort);
    };
    const finish = (error?: unknown) => {
      cleanup();
      if (error) reject(error); else resolve();
    };
    const fail = () => finish(video.error ?? new Error('Reference media failed to load'));
    const abort = () => finish(signal.reason ?? new DOMException('Reference cancelled', 'AbortError'));
    const check = () => {
      if (signal.aborted) abort();
      else if (video.error) fail();
      else if (ready()) finish();
    };
    events.forEach((name) => video.addEventListener(name, check));
    video.addEventListener('error', fail);
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => finish(new Error('Reference loading timed out')), timeoutMs);
    try {
      signal.throwIfAborted();
      if (video.error) { fail(); return; }
      start?.();
      check();
    } catch (error) { finish(error); }
  });

  signal.throwIfAborted();
  video.pause();
  // A new pin is also an explicit retry after a failed media request.
  if (video.error) video.load();
  if (video.readyState < 1) {
    await waitFor(() => video.readyState >= 1, () => {
      // Do not restart an in-flight metadata fetch on every rapid repin.
      if (video.networkState === 0) video.load();
    });
  }
  signal.throwIfAborted();
  const safeTarget = Number.isFinite(video.duration) && video.duration > 0
    ? Math.min(Math.max(0, target), Math.max(0, video.duration - 0.001))
    : Math.max(0, target);
  await waitFor(
    () => !video.seeking && video.readyState >= 2,
    () => {
      if (Math.abs(video.currentTime - safeTarget) >= 0.002) video.currentTime = safeTarget;
    },
  );
  signal.throwIfAborted();
  // Keep the stable seeked + paint correctness boundary, with cancellation.
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => { cleanup(); reject(signal.reason); };
    const frame = requestAnimationFrame(() => { cleanup(); resolve(); });
    const timer = setTimeout(() => { cleanup(); reject(new Error('Reference presentation timed out')); }, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
  signal.throwIfAborted();
  video.pause();
  return safeTarget;
}
