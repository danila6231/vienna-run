import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundSpan, startMusic, type MusicContext } from '../../src/app/music';

/** A decoded track at 1 kHz: `lead` s of silence, `sound` s of tone, `tail` s of silence. */
function track(lead: number, sound: number, tail: number) {
  const rate = 1000;
  const length = Math.round((lead + sound + tail) * rate);
  const ch = new Float32Array(length);
  for (let i = Math.round(lead * rate); i < Math.round((lead + sound) * rate); i++) ch[i] = 0.3 * Math.sin(i);
  return { sampleRate: rate, length, numberOfChannels: 2, duration: length / rate, getChannelData: () => ch };
}

/** A stand-in AudioContext; `allowed` says whether the browser lets it run right now. */
function fakeContext(allowed: { now: boolean }, decoded: Promise<unknown> = Promise.resolve(track(0.85, 7, 2.15))) {
  const source = { buffer: null as unknown, loop: false, loopStart: 0, loopEnd: 0, connect: vi.fn(), start: vi.fn() };
  const gain = { gain: { value: 1 }, connect: vi.fn() };
  const ctx = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(async () => {
      if (allowed.now) ctx.state = 'running';
    }),
    suspend: vi.fn(async () => {
      ctx.state = 'suspended';
    }),
    decodeAudioData: vi.fn(() => decoded),
    createBufferSource: () => source,
    createGain: () => gain,
  };
  return { ctx: ctx as unknown as MusicContext & { state: string }, source, gain };
}
const load = () => Promise.resolve(new ArrayBuffer(8));
const settle = () => new Promise((r) => setTimeout(r, 0));
const tap = (target: EventTarget) => target.dispatchEvent(new Event('pointerup'));

describe('background music', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loops only the part with sound, skipping the silence at both ends of the recording', async () => {
    const { ctx, source, gain } = fakeContext({ now: true });
    startMusic(ctx, load, true, new EventTarget());
    await settle();
    expect(source.loop).toBe(true);
    expect(source.loopStart).toBeCloseTo(0.84, 2);
    expect(source.loopEnd).toBeCloseTo(7.85, 2);
    expect(source.start).toHaveBeenCalledWith(0, source.loopStart);
    expect(gain.gain.value).toBeLessThan(1);
  });
  it('plays straight away when the browser allows sound', async () => {
    const { ctx } = fakeContext({ now: true });
    startMusic(ctx, load, true, new EventTarget());
    await settle();
    expect(ctx.state).toBe('running');
  });
  it('waits for the first tap when the browser blocks sound until then', async () => {
    const allowed = { now: false };
    const { ctx } = fakeContext(allowed);
    const page = new EventTarget();
    startMusic(ctx, load, true, page);
    await settle();
    expect(ctx.state).toBe('suspended');
    allowed.now = true;
    tap(page);
    await settle();
    expect(ctx.state).toBe('running');
    const calls = (ctx.resume as ReturnType<typeof vi.fn>).mock.calls.length;
    tap(page);
    expect(ctx.resume).toHaveBeenCalledTimes(calls);
  });
  it('mutes and unmutes', async () => {
    const { ctx } = fakeContext({ now: true });
    const music = startMusic(ctx, load, true, new EventTarget());
    await settle();
    music.setEnabled(false);
    await settle();
    expect(ctx.state).toBe('suspended');
    music.setEnabled(true);
    await settle();
    expect(ctx.state).toBe('running');
  });
  it('stays silent when muted, even after a tap', async () => {
    const { ctx } = fakeContext({ now: true });
    const page = new EventTarget();
    startMusic(ctx, load, false, page);
    tap(page);
    await settle();
    expect(ctx.state).toBe('suspended');
    expect(ctx.resume).not.toHaveBeenCalled();
  });
  it('keeps the game going when the track cannot be decoded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ctx, source } = fakeContext({ now: true }, Promise.reject(new Error('no AAC decoder')));
    expect(() => startMusic(ctx, load, true, new EventTarget())).not.toThrow();
    await settle();
    expect(source.start).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
  });
});

describe('soundSpan', () => {
  it('finds where the sound starts and ends, and keeps a silent-free track whole', () => {
    expect(soundSpan(track(0.85, 7, 2.15))).toEqual({ start: expect.closeTo(0.84, 2), end: expect.closeTo(7.85, 2) });
    const full = track(0, 5, 0);
    expect(soundSpan(full).start).toBe(0);
    expect(soundSpan(full).end).toBeCloseTo(5, 2);
  });
});
