import { translate, type Lang, type StringKey, type Vars } from './strings';

/** The booth's current language. Screens listen and re-label when it changes. */
export class I18n {
  private listeners = new Set<() => void>();

  constructor(private current: Lang = 'vi') {}

  get lang(): Lang {
    return this.current;
  }

  t(key: StringKey, vars?: Vars): string {
    return translate(this.current, key, vars);
  }

  set(lang: Lang): void {
    if (lang === this.current) return;
    this.current = lang;
    for (const cb of [...this.listeners]) cb();
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
}
