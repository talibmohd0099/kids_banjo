import { describe, expect, it } from 'vitest';
import { FallingNotesGame } from '../src/game/fallingNotes';
import { SONGS, songById } from '../src/music/songs';

const buns = songById('hot-cross-buns')!;

function playPerfectly(game: FallingNotesGame) {
  for (let guard = 0; guard < 10000 && !game.finished; guard++) {
    const next = game.nextPending();
    if (next && Math.abs(next.time - game.songTime) < 0.02) game.play(next.lane, next.midi);
    game.update(0.01);
  }
}

describe('FallingNotesGame', () => {
  it('beginner mode waits on each note until it is played', () => {
    const game = new FallingNotesGame(buns, 'beginner');
    game.update(game.travel + 5);
    expect(game.waiting).toBe(true);
    expect(game.songTime).toBeCloseTo(0);
    expect(game.nextPending()!.index).toBe(0);
    // Wrong string: nothing happens.
    expect(game.play((game.nextPending()!.lane + 1) % 4, 0)).toBeNull();
    // Right string, any finger spot (the violin plays the right note for them).
    const hit = game.play(game.nextPending()!.lane, 0);
    expect(hit?.grade).toBe('perfect');
  });

  it('"keep the beat": a beginner song keeps moving and still helps with the pitch', () => {
    const game = new FallingNotesGame(buns, 'beginner', { wait: false });
    game.update(game.travel + 2);
    expect(game.waiting).toBe(false);
    expect(game.songTime).toBeCloseTo(2);
    expect(game.notes[0].state).toBe('missed');
  });

  it('beginner mode assists the pitch of the upcoming note', () => {
    const game = new FallingNotesGame(buns, 'beginner');
    game.update(game.travel);
    const first = game.notes[0];
    expect(game.assistedPitch(first.lane)).toBe(first.midi);
    expect(new FallingNotesGame(buns, 'free').assistedPitch(first.lane)).toBeNull();
  });

  it('free mode needs the right finger pitch and lets notes pass', () => {
    const game = new FallingNotesGame(buns, 'free');
    game.update(game.travel);
    const first = game.notes[0];
    expect(game.play(first.lane, first.midi + 2)).toBeNull();
    expect(game.play(first.lane, first.midi)).not.toBeNull();
    const missed = game.update(5);
    expect(missed.length).toBeGreaterThan(0);
  });

  it('a perfect run gets 3 stars', () => {
    const game = new FallingNotesGame(buns, 'explorer');
    playPerfectly(game);
    expect(game.finished).toBe(true);
    const r = game.result();
    expect(r.hits).toBe(r.total);
    expect(r.stars).toBe(3);
  });

  it('never says FAILED: even playing nothing earns a star and a kind word', () => {
    const game = new FallingNotesGame(buns, 'free');
    game.update(1000);
    const r = game.result();
    expect(r.stars).toBe(1);
    expect(r.message).not.toMatch(/fail/i);
  });

  it('every song can be completed in every mode', () => {
    for (const song of SONGS) {
      for (const level of ['beginner', 'explorer', 'free'] as const) {
        const game = new FallingNotesGame(song, level);
        playPerfectly(game);
        expect(game.result().stars, `${song.title} ${level}`).toBe(3);
      }
    }
  });
});
