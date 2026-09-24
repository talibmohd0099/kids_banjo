import { settings, saveSettings, type Settings } from '../settings';
import { SKINS } from '../violin/skins';
import { h } from './dom';

function group<K extends keyof Settings>(title: string, key: K, options: [Settings[K], string][], hint?: (v: Settings[K]) => string): HTMLElement {
  const hintEl = h('div', { class: 'hint' });
  const buttons = options.map(([value, label]) => {
    const b = h('button', { class: 'choice', 'aria-pressed': String(settings[key] === value) }, label);
    b.addEventListener('click', () => {
      settings[key] = value;
      saveSettings();
      buttons.forEach((x, i) => {
        const on = options[i][0] === value;
        x.classList.toggle('selected', on);
        x.setAttribute('aria-pressed', String(on));
      });
      if (hint) hintEl.textContent = hint(value);
    });
    if (settings[key] === value) b.classList.add('selected');
    return b;
  });
  if (hint) hintEl.textContent = hint(settings[key]);
  return h('div', { class: 'setting' }, h('h3', {}, title), h('div', { class: 'choices' }, ...buttons), hint ? hintEl : null);
}

const ASSIST_HINTS: Record<string, string> = {
  beginner: 'Every finger spot plays a nice note. Songs wait for you.',
  explorer: 'Fingers can slide between notes. Songs keep moving.',
  free: 'Just like a real violin. Every tiny move changes the pitch.',
};

export function openSettings(parent: HTMLElement, onClose?: () => void): void {
  const close = () => {
    overlay.remove();
    onClose?.();
  };
  const overlay = h(
    'div',
    { class: 'overlay', onclick: (e: MouseEvent) => e.target === overlay && close() },
    h(
      'div',
      { class: 'panel', role: 'dialog', 'aria-label': 'Settings' },
      h('h2', {}, '⚙️ Settings'),
      group('Help level', 'assist', [
        ['beginner', '🐣 Beginner'],
        ['explorer', '🧭 Explorer'],
        ['free', '🦅 Free'],
      ], (v) => ASSIST_HINTS[v]),
      group('Note names', 'labels', [
        ['off', 'Off'],
        ['letters', 'G A B'],
        ['solfege', 'Do Re Mi'],
        ['sargam', 'Sa Re Ga'],
      ]),
      group(
        'Violin',
        'skin',
        Object.values(SKINS).map((s) => [s.id, `${s.emoji} ${s.name}`]),
      ),
      group('Songs', 'songPace', [
        ['beat', '🎵 Keep the beat'],
        ['wait', '🐢 Wait for me'],
      ], (v) => (v === 'beat' ? 'The song keeps moving like real music, and a fairy plays the tune softly with you.' : 'The song stops on each note until you play it.')),
      group('Strings', 'openStrings', [
        [false, '🎶 All notes'],
        [true, '🎯 Open strings only'],
      ], (v) => (v ? 'Only G, D, A and E: great for the very first lesson.' : 'Slide your finger up and down a string to change the note.')),
      h('button', { class: 'pill-btn', onclick: close }, 'Done ✓'),
    ),
  );
  parent.append(overlay);
}
