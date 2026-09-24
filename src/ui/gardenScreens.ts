// Rewards and the Music Garden. Instead of coins and a shop, progress is musical:
// every finished song plants a flower that grows with better stars, and all the
// finished songs together grow the giant Magic Tree.

import { SONGS, songById } from '../music/songs';
import { isUnlocked, plantStage, profile, songRecord, treeStage, TREE_GOAL, type PlantStage, type Reward } from '../state/profile';
import { h, type Screen } from './dom';
import { goGame, goGarden, goHome, goPlay, goPlayHub, goSongs } from './router';

/** Each song has its own flower. */
const FLOWERS: Record<string, string> = {
  'hot-cross-buns': '🌻',
  'mary-lamb': '🌼',
  'sa-re-ga-ma': '🪷',
  twinkle: '🌟',
  'frere-jacques': '🌷',
  'row-boat': '🌺',
  'london-bridge': '🏵️',
  'ode-to-joy': '🌸',
  'jingle-bells': '🎄',
  'happy-birthday': '💐',
};

export function plantEmoji(songId: string, stage: PlantStage): string {
  return ['🌰', '🌱', '🌿', FLOWERS[songId] ?? '🌸'][stage];
}

const STAGE_NAMES = ['a seed', 'a sprout', 'a leafy plant', 'a flower'];
const TREE_EMOJI = ['🌰', '🌱', '🪴', '🌳', '🌳', '🌳✨'];
const TREE_NAMES = ['Magic seed', 'Magic sprout', 'Little tree', 'Growing tree', 'Big tree', 'Giant Magic Tree'];

export function rewardsScreen(reward: Reward): Screen {
  return (root) => {
    const song = songById(reward.songId)!;
    const unlocked = reward.unlockedSongId ? songById(reward.unlockedSongId) : undefined;
    const grew = reward.plantAfter > reward.plantBefore;
    const idx = SONGS.indexOf(song);
    const next = SONGS[idx + 1];

    const headline = reward.firstCompletion
      ? `You planted a ${song.title} flower!`
      : grew
        ? `Your ${song.title} plant grew!`
        : reward.newBest
          ? 'New best score!'
          : 'Your garden loves your music!';

    const screen = h(
      'div',
      { class: 'screen rewards' },
      h('div', { class: 'reward-glow', 'aria-hidden': 'true' }),
      h('h2', {}, '🎁 Reward!'),
      h(
        'div',
        { class: 'plant-grow', 'aria-label': `Plant is now ${STAGE_NAMES[reward.plantAfter]}` },
        h('span', { class: 'from' }, plantEmoji(song.id, reward.plantBefore)),
        h('span', { class: 'arrow' }, grew ? '➜' : ''),
        h('span', { class: 'to' }, plantEmoji(song.id, reward.plantAfter)),
      ),
      h('p', { class: 'reward-line' }, headline),
      h('div', { class: 'big-stars', 'aria-label': `${reward.stars} stars` }, '⭐'.repeat(reward.stars) + '☆'.repeat(3 - reward.stars)),
      unlocked ? h('div', { class: 'unlock-card' }, `🔓 New song unlocked: ${unlocked.emoji} ${unlocked.title}`) : null,
      reward.treeAfter > reward.treeBefore ? h('div', { class: 'unlock-card' }, `${TREE_EMOJI[reward.treeAfter]} Your Magic Tree grew into a ${TREE_NAMES[reward.treeAfter]}!`) : null,
      h('p', { class: 'tree-line' }, `${reward.totalCompletions} of ${TREE_GOAL} songs to grow the Giant Magic Tree`),
      h(
        'div',
        { class: 'reward-actions' },
        h('button', { class: 'pill-btn big', onclick: () => goGarden(song.id) }, '🌷 Visit my Music Garden'),
        next && isUnlocked(profile, SONGS.map((s) => s.id), idx + 1)
          ? h('button', { class: 'pill-btn secondary', onclick: () => goGame(next) }, `Next: ${next.emoji} ${next.title}`)
          : null,
        h('button', { class: 'pill-btn secondary', onclick: () => goSongs() }, '🎵 Songs'),
      ),
    );
    root.append(screen);
    return () => {};
  };
}

/** The garden: one plot per song, the Magic Tree on top. `highlight` bounces a fresh plant. */
export function gardenScreen(highlight?: string): Screen {
  return (root) => {
    const order = SONGS.map((s) => s.id);
    const total = profile.stats.songsCompleted;
    const tree = treeStage(total);
    const grown = SONGS.filter((s) => plantStage(songRecord(profile, s.id)) > 0).length;

    const plots = SONGS.map((song, i) => {
      const rec = songRecord(profile, song.id);
      const stage = plantStage(rec);
      const open = isUnlocked(profile, order, i);
      const label = stage > 0 ? `${song.title}: ${STAGE_NAMES[stage]}, played ${rec.completions} times` : open ? `${song.title}: play it to plant a seed` : `${song.title}: locked`;
      const plot = h(
        'button',
        { class: `plot${stage > 0 ? ' grown' : ''}${highlight === song.id ? ' fresh' : ''}${open ? '' : ' locked'}`, 'aria-label': label },
        h('span', { class: 'plant' }, open ? plantEmoji(song.id, stage) : '🔒'),
        h('span', { class: 'plot-name' }, song.title),
        stage > 0 ? h('span', { class: 'plot-stars' }, '⭐'.repeat(rec.bestStars)) : h('span', { class: 'plot-stars' }, open ? 'Tap to plant' : ''),
      );
      plot.addEventListener('click', () => open && goGame(song));
      return plot;
    });

    const pct = Math.min(100, Math.round((total / TREE_GOAL) * 100));
    const minutes = Math.round(profile.stats.practiceMs / 60000);
    const screen = h(
      'div',
      { class: 'screen garden' },
      h('div', { class: 'list-head' }, h('button', { class: 'round-btn', 'aria-label': 'Home', onclick: () => goHome() }, '🏠'), h('h2', {}, '🌷 Music Garden')),
      h(
        'div',
        { class: 'tree-card' },
        h('div', { class: `tree stage-${tree}`, 'aria-hidden': 'true' }, TREE_EMOJI[tree]),
        h(
          'div',
          { class: 'tree-info' },
          h('div', { class: 'tree-name' }, TREE_NAMES[tree]),
          h('div', { class: 'tree-bar', role: 'progressbar', 'aria-valuenow': String(total), 'aria-valuemax': String(TREE_GOAL), 'aria-label': 'Magic Tree growth' }, h('div', { style: { width: `${pct}%` } })),
          h('div', { class: 'hint' }, `${total} / ${TREE_GOAL} songs played to the end`),
        ),
      ),
      h(
        'div',
        { class: 'garden-stats' },
        h('div', {}, h('b', {}, String(grown)), h('span', {}, 'plants')),
        h('div', {}, h('b', {}, String(profile.stats.notesPlayed)), h('span', {}, 'notes played')),
        h('div', {}, h('b', {}, minutes === 0 && profile.stats.practiceMs > 0 ? '<1' : String(minutes)), h('span', {}, 'minutes')),
        h('div', {}, h('b', {}, `${profile.stats.streakDays}🔥`), h('span', {}, 'day streak')),
      ),
      h('div', { class: 'plots' }, ...plots),
      h('button', { class: 'pill-btn', onclick: () => goPlayHub() }, '🎻 Play more music'),
    );
    root.append(screen);
    return () => {};
  };
}

/** PLAY: pick how to play. */
export const playHubScreen: Screen = (root) => {
  const card = (icon: string, title: string, sub: string, onclick: () => void) =>
    h('button', { class: 'hub-card', onclick }, h('span', { class: 'icon' }, icon), h('span', { class: 'hub-text' }, h('b', {}, title), h('small', {}, sub)));
  root.append(
    h(
      'div',
      { class: 'screen list-screen' },
      h('div', { class: 'list-head' }, h('button', { class: 'round-btn', 'aria-label': 'Home', onclick: () => goHome() }, '🏠'), h('h2', {}, '▶ Play')),
      h(
        'div',
        { class: 'hub' },
        card('🎵', 'Song Journey', 'Play songs with help, earn stars, grow your garden', () => goSongs()),
        card('🎻', 'Free Violin', 'Slide, bend and wiggle the strings', () => goPlay(false)),
        card('✨', 'Magic Orchestra', 'Your band plays along with you', () => goPlay(true)),
      ),
    ),
  );
  return () => {};
};
