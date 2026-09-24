import type { Layers } from '../audio/arranger';
import { h } from './dom';

const BAND: [keyof Layers | 'violin', string, string][] = [
  ['violin', '🎻', 'You'],
  ['piano', '🎹', 'Piano'],
  ['bass', '🎸', 'Bass'],
  ['drums', '🥁', 'Drums'],
  ['flute', '🪈', 'Flute'],
];

/** The row of band members that light up when they join in. */
export function musiciansRow(): { el: HTMLElement; update: (l: Layers, violinOn: boolean) => void } {
  const items = BAND.map(([id, icon, name]) => h('div', { class: 'musician', 'data-id': id }, icon, h('small', {}, name)));
  const el = h('div', { class: 'musicians', 'aria-hidden': 'true' }, ...items);
  return {
    el,
    update(l, violinOn) {
      items.forEach((item, i) => {
        const id = BAND[i][0];
        item.classList.toggle('on', id === 'violin' ? violinOn : l[id]);
      });
    },
  };
}
