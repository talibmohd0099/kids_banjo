// Free Play and Magic Orchestra: the violin, a record button, and (optionally)
// a band that joins in depending on how the child plays.

import { getEngine, hasEngine } from '../audio/engine';
import { Orchestra } from '../audio/orchestra';
import { NO_LAYERS } from '../audio/arranger';
import { funName, Recorder, saveRecording } from '../record/recording';
import { settings } from '../settings';
import { ViolinView } from '../violin/violinView';
import { h, toast, type Screen } from './dom';
import { musiciansRow } from './musicians';
import { openSettings } from './settingsSheet';
import { goHome, goMyMusic } from './router';

export function playScreen(withOrchestra: boolean): Screen {
  return (root) => {
    const screen = h('div', { class: 'screen stage' });
    const host = h('div', { class: 'violin-host' });
    screen.append(host);
    root.append(screen);

    const view = new ViolinView(host, { top: 104, bottom: 18, side: 14 });
    const recorder = new Recorder();
    let orchestra: Orchestra | null = null;
    let orchestraOn = withOrchestra;
    const band = musiciansRow();
    let lastSound = -Infinity;

    const ensureOrchestra = () => {
      if (!orchestraOn || orchestra || !hasEngine()) return;
      orchestra = new Orchestra(getEngine(), { tempo: 96, beatsPerBar: 4 });
      orchestra.onLayersChange = (l) => band.update(l, true);
      orchestra.start();
    };

    view.onNoteOn = (midi, _lane, replay) => {
      if (replay) return;
      ensureOrchestra();
      orchestra?.arranger.noteOn(midi, getEngine().now);
    };
    view.onFrame = (max) => {
      if (max > 0.05) lastSound = performance.now();
      if (orchestra) orchestra.arranger.activity(max, getEngine().now);
      band.update(orchestra?.layers ?? NO_LAYERS, performance.now() - lastSound < 300);
    };
    view.onState = (key, state) => recorder.capture(key, state, performance.now());

    // ----- top bar -----
    const recTime = h('span', { class: 'rec-time' });
    let recTimer = 0;
    const recBtn = h('button', { class: 'round-btn rec', 'aria-label': 'Record my song' }, '⏺');
    recBtn.addEventListener('click', () => {
      if (!recorder.recording) {
        recorder.begin(performance.now());
        recBtn.classList.add('on');
        recBtn.textContent = '⏹';
        recBtn.setAttribute('aria-label', 'Stop recording');
        const started = performance.now();
        recTimer = window.setInterval(() => {
          const s = Math.floor((performance.now() - started) / 1000);
          recTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }, 250);
      } else {
        stopRecording(true);
      }
    });

    const stopRecording = (announce: boolean) => {
      if (!recorder.recording) return;
      window.clearInterval(recTimer);
      recTime.textContent = '';
      recBtn.classList.remove('on');
      recBtn.textContent = '⏺';
      recBtn.setAttribute('aria-label', 'Record my song');
      const rec = recorder.finish(performance.now(), funName(), settings.skin);
      if (!announce) return;
      if (!rec) {
        toast(screen, 'Play some notes while recording 🎻');
        return;
      }
      if (saveRecording(rec)) {
        const t = h('div', { class: 'toast' }, `🎉 Saved “${rec.name}”! `, h('button', { class: 'pill-btn', style: { minHeight: '36px', fontSize: '15px' }, onclick: () => goMyMusic() }, '▶ My Music'));
        screen.append(t);
        setTimeout(() => t.remove(), 4000);
      } else {
        toast(screen, 'Could not save: storage is full');
      }
    };

    const bandBtn = h('button', { class: `round-btn${orchestraOn ? ' on' : ''}`, 'aria-label': 'Magic Orchestra on or off', 'aria-pressed': String(orchestraOn) }, '🎼');
    bandBtn.addEventListener('click', () => {
      orchestraOn = !orchestraOn;
      bandBtn.classList.toggle('on', orchestraOn);
      bandBtn.setAttribute('aria-pressed', String(orchestraOn));
      band.el.style.display = orchestraOn ? '' : 'none';
      if (!orchestraOn) {
        orchestra?.stop();
        orchestra = null;
      } else {
        ensureOrchestra();
      }
    });
    band.el.style.display = orchestraOn ? '' : 'none';

    screen.append(
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'round-btn', 'aria-label': 'Home', onclick: () => goHome() }, '🏠'),
        h('div', { class: 'title' }, withOrchestra ? '✨ Magic Orchestra' : '🎻 Free Play'),
        recTime,
        recBtn,
        bandBtn,
        h('button', { class: 'round-btn', 'aria-label': 'Settings', onclick: () => openSettings(screen) }, '⚙️'),
      ),
      band.el,
    );

    return () => {
      stopRecording(false);
      orchestra?.stop();
      view.destroy();
    };
  };
}
