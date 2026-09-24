// Counts practice for the stats (and the future Parent Area): time the violin is
// actually sounding, and notes played by the child (not replays).

import { profile, recordPractice, saveProfile } from './profile';

let lastFrame = 0;

export function practiceFrame(now: number, sounding: boolean): void {
  const dt = lastFrame ? Math.min(100, now - lastFrame) : 0;
  lastFrame = now;
  if (sounding && dt > 0) {
    recordPractice(profile, dt, 0, Date.now());
    saveProfile();
  }
}

export function practiceNote(): void {
  recordPractice(profile, 0, 1, Date.now());
  saveProfile();
}
