/** The bits of an <audio> element the music needs (a stand-in in the tests). */
export type MusicElement = Pick<HTMLMediaElement, 'play' | 'pause' | 'loop' | 'volume'>;

export interface Music {
  /** Staff's sound switch: off pauses the music, on plays it again (waiting for a tap if the browser asks for one). */
  setEnabled(on: boolean): void;
}

/** Background level: the music sits under the game rather than over the room. */
const VOLUME = 0.6;
/** Events that count as a user gesture for the browser's autoplay rule (a touch only counts once the finger lifts). */
const GESTURES = ['pointerup', 'touchend', 'mousedown', 'keydown', 'click'] as const;

/**
 * Loops the track from the start. Browsers block sound until someone taps the page (unless the kiosk launcher
 * allows it), so a blocked start waits for the first tap anywhere, the one that starts a round.
 */
export function startMusic(el: MusicElement, enabled: boolean, page: EventTarget): Music {
  el.loop = true;
  el.volume = VOLUME;
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
    el.play().then(
      () => listen(false),
      () => {
        if (on) listen(true);
      },
    );
  }
  play();
  return {
    setEnabled(v) {
      on = v;
      if (v) play();
      else {
        listen(false);
        el.pause();
      }
    },
  };
}
