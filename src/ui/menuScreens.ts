import { SONGS } from '../music/songs';
import { deleteRecording, listRecordings, Replayer, type Recording } from '../record/recording';
import { progress, settings, type SkinId } from '../settings';
import { ViolinView } from '../violin/violinView';
import { h, toast, type Screen } from './dom';
import { goGame, goHome, goMyMusic, goPlay, goReplay, goSongs } from './router';
import { getEngine } from '../audio/engine';
import { openSettings } from './settingsSheet';
import { SKINS } from '../violin/skins';

export const homeScreen: Screen = (root) => {
  const menuBtn = (icon: string, label: string, onclick: () => void, extra = '') =>
    h('button', { class: `menu-btn ${extra}`, onclick }, h('span', { class: 'icon' }, icon), label);
  const soon = (icon: string, label: string) =>
    h('button', { class: 'menu-btn soon', disabled: true, 'aria-disabled': 'true' }, h('span', { class: 'icon' }, icon), label, h('small', {}, 'coming soon'));

  const screen = h(
    'div',
    { class: 'screen home' },
    h('div', { class: 'big-violin', 'aria-hidden': 'true' }, '🎻'),
    h('h1', {}, 'Magic Violin'),
    h('p', { class: 'tagline' }, 'Slide, sing and play with your own orchestra!'),
    h(
      'div',
      { class: 'menu' },
      menuBtn('✨', 'MAGIC ORCHESTRA', () => goPlay(true), 'wide'),
      menuBtn('🎻', 'FREE PLAY', () => goPlay(false)),
      menuBtn('🎵', 'SONGS', () => goSongs()),
      menuBtn('💾', 'MY MUSIC', () => goMyMusic()),
      menuBtn('⚙️', 'SETTINGS', () => openSettings(screen)),
      soon('🌱', 'Music Garden'),
      soon('👪', 'Parent Area'),
    ),
  );
  root.append(screen);
  return () => {};
};

function unlocked(i: number): boolean {
  return i === 0 || (progress[SONGS[i - 1].id] ?? 0) > 0;
}

export const songsScreen: Screen = (root) => {
  const cards = SONGS.map((song, i) => {
    const open = unlocked(i);
    const stars = progress[song.id] ?? 0;
    const card = h(
      'button',
      { class: `song-card${open ? '' : ' locked'}${i === SONGS.length - 1 ? ' boss' : ''}`, 'aria-label': `${song.title}${open ? '' : ', locked'}` },
      h('span', { class: 'emoji' }, open ? song.emoji : '🔒'),
      song.title,
      h('span', { class: 'stars' }, open ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : 'Locked'),
    );
    card.addEventListener('click', () => (open ? goGame(song) : toast(screen, `🔒 Play “${SONGS[i - 1].title}” first!`)));
    return card;
  });
  const screen = h(
    'div',
    { class: 'screen list-screen' },
    h('div', { class: 'list-head' }, h('button', { class: 'round-btn', 'aria-label': 'Home', onclick: () => goHome() }, '🏠'), h('h2', {}, '🎵 Songs')),
    h('div', { class: 'song-grid' }, ...cards),
  );
  root.append(screen);
  return () => {};
};

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const myMusicScreen: Screen = (root) => {
  const list = h('div', { class: 'rec-list' });
  const render = () => {
    const recs = listRecordings();
    list.replaceChildren(
      ...(recs.length
        ? recs.map((r) =>
            h(
              'div',
              { class: 'rec-item' },
              h('span', { style: { fontSize: '30px' } }, SKINS[r.skin as SkinId]?.emoji ?? '🎻'),
              h('div', { class: 'info' }, h('div', { class: 'name' }, r.name), h('div', { class: 'meta' }, `${fmtDuration(r.durationMs)} · ${new Date(r.createdAt).toLocaleDateString()}`)),
              h('button', { class: 'round-btn', 'aria-label': `Play ${r.name}`, onclick: () => goReplay(r) }, '▶️'),
              h('button', {
                class: 'round-btn',
                'aria-label': `Delete ${r.name}`,
                onclick: () => {
                  if (confirm(`Delete “${r.name}”?`)) {
                    deleteRecording(r.id);
                    render();
                  }
                },
              }, '🗑️'),
            ),
          )
        : [h('div', { class: 'empty' }, 'No songs yet!', h('br'), 'Tap ⏺ while playing to record your music.')]),
    );
  };
  render();
  root.append(
    h(
      'div',
      { class: 'screen list-screen' },
      h('div', { class: 'list-head' }, h('button', { class: 'round-btn', 'aria-label': 'Home', onclick: () => goHome() }, '🏠'), h('h2', {}, '💾 My Music')),
      list,
    ),
  );
  return () => {};
};

/** Instant replay: the fairy plays the recording back on the violin. */
export function replayScreen(rec: Recording): Screen {
  return (root) => {
    const screen = h('div', { class: 'screen stage' });
    const host = h('div', { class: 'violin-host' });
    screen.append(host);
    root.append(screen);
    const savedSkin = settings.skin;
    if (rec.skin in SKINS) settings.skin = rec.skin as SkinId;
    const view = new ViolinView(host, { top: 64, bottom: 18, side: 14 });
    view.showHint = false;
    let raf = 0;
    let replayer: Replayer | null = null;
    let started = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!replayer) return;
      if (!replayer.advance(now - started)) {
        replayer = null;
        playBtn.textContent = '🔁';
      }
    };
    const play = () => {
      void getEngine().resume();
      view.releaseAll();
      replayer = new Replayer(rec, (key, state) => view.apply(key, state));
      started = performance.now();
      playBtn.textContent = '⏳';
    };
    const playBtn = h('button', { class: 'round-btn on', 'aria-label': 'Play again', onclick: play }, '▶️');
    screen.append(
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'round-btn', 'aria-label': 'Back to My Music', onclick: () => goMyMusic() }, '⬅️'),
        h('div', { class: 'title' }, `🧚 ${rec.name}`),
        playBtn,
      ),
    );
    raf = requestAnimationFrame(loop);
    // Audio needs a tap on some browsers, so the replay starts from the button.
    play();
    return () => {
      cancelAnimationFrame(raf);
      view.destroy();
      settings.skin = savedSkin;
    };
  };
}
