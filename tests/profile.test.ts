import { describe, expect, it } from 'vitest';
import { emptyProfile, isUnlocked, migrate, plantStage, recordPractice, recordResult, recordStart, songRecord, treeStage } from '../src/state/profile';

const ORDER = ['a', 'b', 'c'];
const DAY = 86_400_000;
const T0 = new Date(2026, 8, 24, 10).getTime();

describe('profile', () => {
  it('first song is open, the next unlocks after finishing the one before', () => {
    const p = emptyProfile();
    expect(isUnlocked(p, ORDER, 0)).toBe(true);
    expect(isUnlocked(p, ORDER, 1)).toBe(false);
    recordStart(p, 'a', T0);
    expect(isUnlocked(p, ORDER, 1)).toBe(false); // starting is not finishing
    const r = recordResult(p, ORDER, 'a', { stars: 1, hits: 3, total: 10 }, T0);
    expect(r.unlockedSongId).toBe('b');
    expect(isUnlocked(p, ORDER, 1)).toBe(true);
    // Finishing again does not "unlock" it a second time.
    expect(recordResult(p, ORDER, 'a', { stars: 1, hits: 3, total: 10 }, T0).unlockedSongId).toBeNull();
  });

  it('plants: seed, then grow with better stars (never shrink)', () => {
    const p = emptyProfile();
    expect(plantStage(songRecord(p, 'a'))).toBe(0);
    let r = recordResult(p, ORDER, 'a', { stars: 1, hits: 4, total: 10 }, T0);
    expect([r.plantBefore, r.plantAfter, r.firstCompletion]).toEqual([0, 1, true]);
    r = recordResult(p, ORDER, 'a', { stars: 3, hits: 10, total: 10 }, T0);
    expect([r.plantBefore, r.plantAfter, r.newBest]).toEqual([1, 3, true]);
    r = recordResult(p, ORDER, 'a', { stars: 1, hits: 2, total: 10 }, T0);
    expect(r.plantAfter).toBe(3);
    expect(r.newBest).toBe(false);
    expect(songRecord(p, 'a')).toMatchObject({ completions: 3, bestStars: 3, bestAccuracy: 1 });
  });

  it('the Magic Tree grows with total completed songs', () => {
    expect(treeStage(0)).toBe(0);
    expect(treeStage(1)).toBe(1);
    expect(treeStage(10)).toBe(2);
    expect(treeStage(99)).toBe(4);
    expect(treeStage(100)).toBe(5);
    const p = emptyProfile();
    const r = recordResult(p, ORDER, 'a', { stars: 2, hits: 7, total: 10 }, T0);
    expect([r.treeBefore, r.treeAfter, r.totalCompletions]).toEqual([0, 1, 1]);
  });

  it('counts practice and keeps a daily streak', () => {
    const p = emptyProfile();
    recordPractice(p, 5000, 12, T0);
    expect(p.stats).toMatchObject({ practiceMs: 5000, notesPlayed: 12, streakDays: 1 });
    recordPractice(p, 1000, 1, T0 + 3600_000); // same day
    expect(p.stats.streakDays).toBe(1);
    recordPractice(p, 1000, 1, T0 + DAY); // next day
    expect(p.stats.streakDays).toBe(2);
    recordPractice(p, 1000, 1, T0 + 4 * DAY); // missed days: start again
    expect(p.stats.streakDays).toBe(1);
    recordPractice(p, 0, 0, T0 + 5 * DAY); // nothing played: no change
    expect(p.stats.streakDays).toBe(1);
  });

  it('migrates old star-only progress and keeps saved profiles', () => {
    const p = migrate(null, { a: 2, b: 0 });
    expect(songRecord(p, 'a')).toMatchObject({ bestStars: 2, completions: 1 });
    expect(p.songs.b).toBeUndefined();
    expect(p.stats.songsCompleted).toBe(1);
    const again = migrate(JSON.parse(JSON.stringify(p)), null);
    expect(again).toEqual(p);
  });
});
