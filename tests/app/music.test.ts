import { describe, expect, it, vi } from 'vitest';
import { startMusic } from '../../src/app/music';

/** A stand-in for an <audio> element; `allowed` says whether the browser lets it play right now. */
function fakeAudio(allowed: { now: boolean }) {
  const el = {
    loop: false,
    volume: 1,
    paused: true,
    play: vi.fn(() => {
      if (!allowed.now) return Promise.reject(new DOMException('needs a tap', 'NotAllowedError'));
      el.paused = false;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      el.paused = true;
    }),
  };
  return el;
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const tap = (target: EventTarget) => target.dispatchEvent(new Event('pointerup'));

describe('background music', () => {
  it('plays the track on a loop straight away when the browser allows sound', async () => {
    const el = fakeAudio({ now: true });
    startMusic(el, true, new EventTarget());
    await settle();
    expect(el.loop).toBe(true);
    expect(el.volume).toBeLessThan(1);
    expect(el.paused).toBe(false);
  });
  it('waits for the first tap when the browser blocks sound until then', async () => {
    const allowed = { now: false };
    const el = fakeAudio(allowed);
    const page = new EventTarget();
    startMusic(el, true, page);
    await settle();
    expect(el.paused).toBe(true);
    allowed.now = true;
    tap(page);
    await settle();
    expect(el.paused).toBe(false);
    const calls = el.play.mock.calls.length;
    tap(page);
    expect(el.play).toHaveBeenCalledTimes(calls);
  });
  it('mutes and unmutes', async () => {
    const el = fakeAudio({ now: true });
    const music = startMusic(el, true, new EventTarget());
    await settle();
    music.setEnabled(false);
    expect(el.paused).toBe(true);
    music.setEnabled(true);
    await settle();
    expect(el.paused).toBe(false);
  });
  it('stays silent when muted, even after a tap', async () => {
    const allowed = { now: false };
    const el = fakeAudio(allowed);
    const page = new EventTarget();
    const music = startMusic(el, true, page);
    await settle();
    music.setEnabled(false);
    allowed.now = true;
    tap(page);
    await settle();
    expect(el.paused).toBe(true);
    startMusic(fakeAudio({ now: true }), false, page);
    await settle();
    expect(el.play).toHaveBeenCalledTimes(1);
  });
});
