import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(readFileSync(new URL('../src/reference-media.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { captureReference } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = clearTimeout;
class Media extends EventTarget {
  readyState = 4; networkState = 1; duration = 8; seeking = false; error = null;
  paused = true; loads = 0; seeks = 0; value = 0; listeners = new Map();
  addEventListener(name, fn, opts) { super.addEventListener(name, fn, opts); this.listeners.set(fn, (this.listeners.get(fn) ?? 0) + 1); }
  removeEventListener(name, fn) { super.removeEventListener(name, fn); const count = this.listeners.get(fn) ?? 0; if (count <= 1) this.listeners.delete(fn); else this.listeners.set(fn, count - 1); }
  pause() { this.paused = true; }
  load() { this.loads++; this.error = null; this.readyState = 0; }
  get currentTime() { return this.value; }
  set currentTime(value) { this.value = value; this.seeking = true; this.seeks++; }
  fire(name) { this.dispatchEvent(new Event(name)); }
  finish() { this.seeking = false; this.readyState = 4; this.fire('seeked'); }
}
const signal = () => new AbortController();
test('first pin at zero needs no seek event', async () => {
 const video = new Media(); assert.equal(await captureReference(video, 0, signal().signal), 0); assert.equal(video.seeks, 0); assert.equal(video.listeners.size, 0); assert.equal(video.paused, true);
});
test('zero pin waits for data when only metadata is ready', async () => {
 const video = new Media(); video.readyState = 1; const capture = captureReference(video, 0, signal().signal); await Promise.resolve(); video.readyState = 2; video.fire('loadeddata'); await capture; assert.equal(video.listeners.size, 0);
});
test('repin waits for seek completion, including repeated same-target requests', async () => {
 const video = new Media(); const old = signal(); const first = captureReference(video, 3, old.signal); const rejected = assert.rejects(first, {name:'AbortError'}); old.abort(); const last = captureReference(video, 3, signal().signal); video.finish(); assert.equal(await last, 3); await rejected; assert.equal(video.listeners.size, 0);
});
test('rapid metadata repins cancel old waits without restarting the fetch', async () => {
 const video = new Media(); video.readyState = 0; const old = signal(); const first = captureReference(video, 1, old.signal); const rejected = assert.rejects(first); old.abort(); const last = captureReference(video, 2, signal().signal); video.readyState = 1; video.fire('loadedmetadata'); await Promise.resolve(); video.finish(); assert.equal(await last, 2); await rejected; assert.equal(video.loads, 0); assert.equal(video.listeners.size, 0);
});
test('end clamp is applied after initially missing duration loads', async () => {
 const video = new Media(); video.readyState = 0; video.networkState = 0; video.duration = NaN; const capture = captureReference(video, 20, signal().signal); video.duration = 8; video.readyState = 1; video.fire('loadedmetadata'); await Promise.resolve(); video.finish(); assert.equal(await capture, 7.999); assert.equal(video.loads, 1); assert.equal(video.listeners.size, 0);
});
test('clear/source change/unmount abort every pending stage without leaking listeners', async () => {
 for (const ready of [0, 1, 4]) { const video = new Media(); video.readyState = ready; const controller = signal(); const capture = captureReference(video, 2, controller.signal); const rejected = assert.rejects(capture, {name:'AbortError'}); controller.abort(); await rejected; assert.equal(video.listeners.size, 0); }
});
test('errors during post-seek data wait reject and clean up', async () => {
 const video = new Media(); const capture = captureReference(video, 2, signal().signal); video.seeking = false; video.readyState = 1; video.fire('seeked'); const rejected = assert.rejects(capture, /decode failed/); video.error = new Error('decode failed'); video.fire('error'); await rejected; assert.equal(video.listeners.size, 0);
});
test('stalled requests time out and release listeners', async () => {
 const video = new Media(); video.readyState = 0; await assert.rejects(captureReference(video, 1, signal().signal, 10), /timed out/); assert.equal(video.listeners.size, 0);
});
test('abort between seeked and paint cannot complete an old capture', async () => {
 const video = new Media(); const controller = signal(); const capture = captureReference(video, 2, controller.signal); video.finish(); await Promise.resolve(); const rejected = assert.rejects(capture, {name:'AbortError'}); controller.abort(); await rejected; assert.equal(video.listeners.size, 0);
});

test('pinning again retries a previously failed reference source', async () => {
 const video = new Media(); video.readyState = 0; video.error = new Error('temporary network failure'); const capture = captureReference(video, 0, signal().signal); video.readyState = 4; video.fire('loadedmetadata'); assert.equal(await capture, 0); assert.equal(video.loads, 1); assert.equal(video.listeners.size, 0);
});
