// Guided song playing (Falling Notes): play a song by catching the notes as they reach
// the glowing line. "Listen" lets a fairy play the tune first. The Magic Orchestra
// follows the song and grows as the child progresses; a finished song ends in a concert
// finale, then the score, then the reward that grows the child's Music Garden.

import { getEngine } from '../audio/engine';
import { Orchestra } from '../audio/orchestra';
import { synthBank } from '../audio/instruments';
import { ALL_LAYERS, NO_LAYERS, type Layers } from '../audio/arranger';
import { FallingNotesGame, GRADE_WORDS } from '../game/fallingNotes';
import { chordAtBeat, songHarmony } from '../music/harmony';
import { SONGS, type Song } from '../music/songs';
import { noteLabel, STRINGS } from '../music/theory';
import type { NoteEvent } from '../input/noteInput';
import { profile, recordResult, recordStart, saveProfile } from '../state/profile';
import { settings } from '../settings';
import type { Fingerboard } from '../violin/fingerboard';
import { ViolinView } from '../violin/violinView';
import { floatWord, h, type Screen } from './dom';
import { musiciansRow } from './musicians';
import { goGame, goRewards, goSongs } from './router';

export function gameScreen(song: Song): Screen {
  return (root) => {
    const screen = h('div', { class: 'screen stage' });
    const host = h('div', { class: 'violin-host' });
    screen.append(host);
    root.append(screen);

    const game = new FallingNotesGame(song, settings.assist, { wait: settings.songPace === 'wait' });
    const harmony = songHarmony(song);
    const view = new ViolinView(host, { top: 118, bottom: 18, side: 14 });
    view.showHint = false;
    const band = musiciansRow();
    const bar = h('div');
    let orchestra: Orchestra | null = null;
    let running = false;
    let done = false;
    let last = 0;
    let raf = 0;

    const layersNow = (): Layers => {
      if (done) return ALL_LAYERS;
      if (game.songTime < 0) return NO_LAYERS;
      const p = game.progress();
      return { piano: true, bass: game.hits() >= 4, drums: p > 0.35 && !game.waiting, flute: p > 0.65 };
    };

    view.pitchOverride = (lane) => (running ? game.assistedPitch(lane) : null);
    // Any note source (touch today; microphone or MIDI later) scores through here.
    const handleNote = (e: NoteEvent) => {
      if (!running || e.source === 'replay') return;
      const note = game.play(e.lane, e.midi);
      if (!note) return;
      // Even a quick tap plays the note for its written length, so the tune keeps its rhythm.
      if (e.source === 'touch') view.sustain(e.lane, note.beats * game.secPerBeat * 900);
      const words = GRADE_WORDS[note.grade!];
      const x = view.board.stringX(e.lane);
      floatWord(screen, words[Math.floor(Math.random() * words.length)], x, hitY(view.board) - 70);
      if (game.streak > 0 && game.streak % 8 === 0) floatWord(screen, `🔥 ${game.streak} in a row!`, view.board.area.x + view.board.area.w / 2, hitY(view.board) - 120);
    };
    view.onNoteOn = (midi, lane, replay) => handleNote({ midi, lane, source: replay ? 'replay' : 'touch' });

    // The fairy plays a song note on the violin (shown as a 🧚 finger). Used by
    // "Listen" and by the soft guide melody that plays along during the song.
    const fairy = (key: string, i: number, intensity: number, bowChanged: boolean, now: number) => {
      const gn = game.notes[i];
      const a = view.board.area;
      view.apply(key, {
        lane: gn.lane,
        midi: gn.midi,
        intensity,
        vibrato: gn.beats >= 2 ? 0.5 : 0,
        direction: i % 2 === 0 ? 'down' : 'up',
        bowChanged,
        x: (view.board.stringX(gn.lane) - a.x) / a.w + Math.sin(now / 180) * 0.04,
        y: (view.board.yForPosition(gn.position) - a.y) / a.h,
      });
    };

    // ----- guide melody: the tune always sounds, softly, on the beat -----
    let guideIdx = -1;
    const guideFrame = (now: number) => {
      const t = game.songTime;
      const i = game.notes.findIndex((n) => t >= n.time && t < n.time + (n.beats - Math.min(0.25, n.beats * 0.2)) * game.secPerBeat);
      if (i < 0 || done) {
        if (guideIdx !== -1) view.apply('rguide', null);
        guideIdx = -1;
        return;
      }
      // Soft while the child still has to play it; almost silent once they did.
      const played = game.notes[i].state === 'hit';
      fairy('rguide', i, played ? 0.1 : settings.assist === 'free' ? 0.2 : 0.3, i !== guideIdx, now);
      guideIdx = i;
    };

    // ----- count-in: "3, 2, 1" with a soft click so the child feels the beat -----
    let lastCountBeat = Infinity;
    const countFrame = () => {
      if (game.songTime >= 0) return;
      const beatsLeft = Math.ceil(-game.songTime / game.secPerBeat);
      if (beatsLeft !== lastCountBeat) {
        lastCountBeat = beatsLeft;
        const e = getEngine();
        synthBank.hat(e, e.input, e.now, 1);
        if (beatsLeft <= 3) synthBank.kick(e, e.input, e.now, 0.35);
      }
    };

    // ----- "Listen first": the fairy plays the song -----
    const DEMO_NOTES = Math.min(song.notes.length, 32);
    let demoStart: number | null = null;
    let demoIdx = -1;
    const stopDemo = () => {
      demoStart = null;
      demoIdx = -1;
      view.apply('rdemo', null);
    };
    const demoFrame = (now: number) => {
      if (demoStart === null) return;
      const t = ((now - demoStart) / 1000) / game.secPerBeat; // in beats
      const i = song.notes.findIndex((n) => t >= n.beat && t < n.beat + n.beats);
      const n = song.notes[i];
      if (i < 0 || i >= DEMO_NOTES || t > n.beat + n.beats - Math.min(0.25, n.beats * 0.2)) {
        view.apply('rdemo', null);
        if (t > song.notes[DEMO_NOTES - 1].beat + song.notes[DEMO_NOTES - 1].beats) stopDemo();
        return;
      }
      fairy('rdemo', i, 0.7, i !== demoIdx, now);
      demoIdx = i;
    };
    view.drawOverlay = (g, board) => drawNotes(g, board, game);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      demoFrame(now);
      if (!running) return;
      game.update(dt);
      countFrame();
      guideFrame(now);
      // Exposed for automated tests (and handy for debugging): which string is due.
      const due = game.nextPending();
      screen.dataset.nextLane = due && due.time - game.songTime < 0.3 ? String(due.lane) : '';
      bar.style.width = `${Math.round(game.progress() * 100)}%`;
      if (game.finished && !done) finish();
    };

    const start = () => {
      stopDemo();
      overlay.remove();
      recordStart(profile, song.id, Date.now());
      saveProfile();
      const engine = getEngine();
      void engine.resume();
      orchestra = new Orchestra(engine, {
        tempo: 60 / game.secPerBeat,
        beatsPerBar: song.beatsPerBar,
        beatClock: () => (running ? game.beat() : null),
        chordAt: (b) => chordAtBeat(song, harmony, b),
        layersOverride: layersNow,
      });
      orchestra.onLayersChange = (l) => band.update(l, true);
      orchestra.start();
      running = true;
      last = performance.now();
    };

    const finish = () => {
      done = true;
      running = false;
      const result = game.result();
      const reward = recordResult(profile, SONGS.map((x) => x.id), song.id, result, Date.now());
      saveProfile(true);
      orchestra?.finale();
      band.update(ALL_LAYERS, true);
      setTimeout(() => {
        screen.append(
          h(
            'div',
            { class: 'overlay' },
            h(
              'div',
              { class: 'panel' },
              h('div', { class: 'audience' }, '👏🧒👏👧👏🧑👏'),
              h('h2', {}, `${song.emoji} ${song.title}`),
              h('div', { class: 'big-stars', 'aria-label': `${result.stars} stars` }, '⭐'.repeat(result.stars) + '☆'.repeat(3 - result.stars)),
              h('p', {}, result.message),
              h('p', { class: 'hint' }, `You played ${result.hits} of ${result.total} notes.`),
              h('button', { class: 'pill-btn big', onclick: () => goRewards(reward) }, '🎁 Collect reward'),
              h('br'),
              h('button', { class: 'pill-btn secondary', onclick: () => goGame(song) }, '🔁 Play again'),
            ),
          ),
        );
      }, 1200);
    };

    const when = settings.songPace === 'wait' ? 'The song waits for you.' : 'The fairy plays along softly, so keep the beat with her!';
    const howTo =
      settings.assist === 'beginner'
        ? `When a note reaches the glowing line, touch its string. ${when}`
        : `Put your finger on the glowing ring and bow when the note reaches the line. ${when}`;
    const overlay = h(
      'div',
      { class: 'overlay' },
      h(
        'div',
        { class: 'panel' },
        h('div', { style: { fontSize: '56px' } }, song.emoji),
        h('h2', {}, song.title),
        h('p', {}, howTo),
        h('button', { class: 'pill-btn secondary', onclick: () => {
          void getEngine().resume();
          demoStart = performance.now();
          demoIdx = -1;
        } }, '👂 Listen'),
        h('button', { class: 'pill-btn', onclick: start }, '▶ Start'),
      ),
    );

    screen.append(
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'round-btn', 'aria-label': 'Back to songs', onclick: () => goSongs() }, '⬅️'),
        h('div', { class: 'title' }, `${song.emoji} ${song.title}`),
      ),
      band.el,
      overlay,
    );
    // The progress bar sits just under the band row.
    const prog = h('div', { class: 'progress', style: { top: 'calc(max(10px, env(safe-area-inset-top)) + 104px)' } }, bar);
    screen.append(prog);

    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      orchestra?.stop();
      view.destroy();
    };
  };
}

function hitY(board: Fingerboard): number {
  return board.area.y + board.area.h * 0.84;
}

function drawNotes(g: CanvasRenderingContext2D, board: Fingerboard, game: FallingNotesGame): void {
  const a = board.area;
  const lineY = hitY(board);
  const topY = a.y - 10;
  const now = performance.now();

  // Glowing target line.
  g.save();
  g.shadowColor = '#fff';
  g.shadowBlur = 16;
  g.strokeStyle = '#ffffffcc';
  g.lineWidth = 4;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.moveTo(a.x + 8, lineY);
  g.lineTo(a.x + a.w - 8, lineY);
  g.stroke();
  g.restore();

  const next = game.nextPending();
  // Where the finger goes for the next note (not needed in beginner mode).
  if (next && game.level !== 'beginner' && next.position > 0) {
    const pulse = 1 + 0.2 * Math.sin(now / 150);
    g.strokeStyle = '#fff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(board.stringX(next.lane), board.yForPosition(next.position), 16 * pulse, 0, Math.PI * 2);
    g.stroke();
  }
  // The next note is close (or the song is waiting): light up its string and show where to touch.
  const soon = next && (game.waiting || next.time - game.songTime < 0.9);
  if (next && soon) {
    // Landing spot on the line: a ring that closes in as the note arrives.
    const ahead = Math.max(0, next.time - game.songTime);
    g.strokeStyle = STRINGS[next.lane].color;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(board.stringX(next.lane), lineY, 24 + ahead * 40, 0, Math.PI * 2);
    g.stroke();
  }
  if (next && soon && game.level === 'beginner') {
    const x = board.stringX(next.lane);
    const lw = board.laneWidth();
    g.fillStyle = STRINGS[next.lane].color + '40';
    g.fillRect(x - lw / 2 + 4, a.y, lw - 8, a.h);
    // A little hand shows where to touch.
    g.font = '38px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('👆', x + 22, lineY + 44 + 6 * Math.sin(now / 160));
  }

  const labelStyle = settings.labels === 'off' ? null : settings.labels;
  const pxPerSec = (lineY - topY) / game.travel;
  // Keep falling notes and their tails inside the fingerboard.
  g.save();
  g.beginPath();
  g.rect(a.x, a.y - 30, a.w, a.h + 30);
  g.clip();
  for (const n of game.notes) {
    if (n.state === 'hit') continue;
    const ahead = n.time - game.songTime;
    if (ahead > game.travel || ahead < -0.6) continue;
    const y = lineY - ahead * pxPerSec;
    const x = board.stringX(n.lane);
    const r = 19 + Math.min(2, n.beats) * 3;
    g.globalAlpha = n.state === 'missed' ? 0.3 : 1;
    // A tail shows how long to hold the note.
    const tail = Math.max(0, n.beats * game.secPerBeat * pxPerSec - r);
    if (tail > 4) {
      g.fillStyle = STRINGS[n.lane].color + '66';
      g.fillRect(x - 7, y - r - tail, 14, tail);
    }
    const grad = g.createRadialGradient(x - 5, y - 5, 2, x, y, r);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, STRINGS[n.lane].color);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b1b2f';
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(labelStyle ? noteLabel(n.midi, labelStyle) : '♪', x, y + 1);
    g.textBaseline = 'alphabetic';
  }
  g.globalAlpha = 1;
  g.restore();

  // Count-in before the first note.
  if (game.songTime < 0) {
    const beatsLeft = Math.ceil(-game.songTime / game.secPerBeat);
    const word = beatsLeft > 3 ? 'Ready…' : String(beatsLeft);
    g.font = `900 ${beatsLeft > 3 ? 44 : 84}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = '#0008';
    g.strokeText(word, a.x + a.w / 2, a.y + a.h * 0.4);
    g.fillStyle = '#fff';
    g.fillText(word, a.x + a.w / 2, a.y + a.h * 0.4);
    g.textBaseline = 'alphabetic';
  }
}
