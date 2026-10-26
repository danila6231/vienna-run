/** A decoded track: the bits of an AudioBuffer the music needs. */
export type Track = Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>;

/** The bits of an AudioContext the music needs (a stand-in in the tests). */
export interface MusicContext {
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer>;
  createBufferSource(): AudioBufferSourceNode;
  createGain(): GainNode;
}

export interface Music {
  /** Staff's sound switch: off pauses the music, on plays it again (waiting for a tap if the browser asks for one). */
  setEnabled(on: boolean): void;
}

/** Background level: the music sits under the game rather than over the room. */
const VOLUME = 0.6;
/** Events that count as a user gesture for the browser's autoplay rule (a touch only counts once the finger lifts). */
const GESTURES = ['pointerup', 'touchend', 'mousedown', 'keydown', 'click'] as const;
/** Quieter than this (−60 dBFS) counts as silence at the ends of a recording. */
const SILENCE = 0.001;

/** Where the sound starts and ends in a recording, in seconds, so the loop can skip silence at either end. */
export function soundSpan(t: Track): { start: number; end: number } {
  const channels = Array.from({ length: t.numberOfChannels }, (_, c) => t.getChannelData(c));
  const loud = (i: number) => channels.some((ch) => Math.abs(ch[i]) > SILENCE);
  let first = 0;
  while (first < t.length - 1 && !loud(first)) first++;
  let last = t.length - 1;
  while (last > first && !loud(last)) last--;
  // Start a hair early so the first note's attack is whole.
  return { start: Math.max(0, first / t.sampleRate - 0.01), end: (last + 1) / t.sampleRate };
}

/**
 * Loops the track through Web Audio, which repeats seamlessly in every browser (an <audio loop> leaves a gap in
 * Safari), and only the part with sound in it: this recording has ~1 s of silence at the start and ~2 s at the end.
 * Browsers keep audio suspended until someone taps the page (unless the kiosk launcher allows it), so a blocked start
 * waits for the first tap anywhere, the one that starts a round.
 */
export function startMusic(ctx: MusicContext, load: () => Promise<ArrayBuffer>, enabled: boolean, page: EventTarget): Music {
  const gain = ctx.createGain();
  gain.gain.value = VOLUME;
  gain.connect(ctx.destination);
  let on = enabled;
  let waiting = false;
  const listen = (yes: boolean) => {
    if (waiting === yes) return;
    waiting = yes;
    for (const g of GESTURES) {
      if (yes) page.addEventListener(g, play, { capture: true });
      else page.removeEventListener(g, play, { capture: true });
    }
  };
  function play(): void {
    if (!on) return;
    if (ctx.state === 'running') {
      listen(false);
      return;
    }
    listen(true);
    ctx.resume().then(
      () => {
        if (ctx.state === 'running') listen(false);
      },
      () => undefined,
    );
  }

  load()
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => {
      const { start, end } = soundSpan(buffer);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = end;
      source.connect(gain);
      source.start(0, start);
    })
    .catch((err: unknown) => console.warn(`[music] ${String(err)}. Playing without music.`));

  if (on) play();
  else void ctx.suspend();
  return {
    setEnabled(v) {
      on = v;
      if (v) play();
      else {
        listen(false);
        void ctx.suspend();
      }
    },
  };
}
