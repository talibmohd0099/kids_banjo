// The 10 starter songs, easiest first. All are traditional / public-domain tunes,
// written in D major so they sit comfortably on the violin's open strings.
// Format: "NOTE:beats", space separated. "R:1" is a one-beat rest.
// Happy Birthday starts with a one-beat pickup, so it ends with a rest to fill the last bar.

import { parseNote } from './theory';

export interface SongNote {
  midi: number; // -1 for a rest
  beat: number; // start, in beats from the beginning
  beats: number; // length in beats
}

export interface Song {
  id: string;
  title: string;
  emoji: string;
  tempo: number; // beats per minute
  beatsPerBar: number;
  notes: SongNote[];
  totalBeats: number;
}

interface SongSource {
  id: string;
  title: string;
  emoji: string;
  tempo: number;
  beatsPerBar?: number;
  score: string;
}

const SOURCES: SongSource[] = [
  {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    emoji: '🥯',
    tempo: 90,
    score: `F#4:1 E4:1 D4:2  F#4:1 E4:1 D4:2
            D4:.5 D4:.5 D4:.5 D4:.5 E4:.5 E4:.5 E4:.5 E4:.5  F#4:1 E4:1 D4:2`,
  },
  {
    id: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    emoji: '🐑',
    tempo: 100,
    score: `F#4:1 E4:1 D4:1 E4:1  F#4:1 F#4:1 F#4:2  E4:1 E4:1 E4:2  F#4:1 A4:1 A4:2
            F#4:1 E4:1 D4:1 E4:1  F#4:1 F#4:1 F#4:1 F#4:1  E4:1 E4:1 F#4:1 E4:1  D4:4`,
  },
  {
    id: 'sa-re-ga-ma',
    title: 'Sa Re Ga Ma',
    emoji: '🪷',
    tempo: 84,
    score: `D4:1 E4:1 F#4:1 G4:1 A4:1 B4:1 C#5:1 D5:1
            C#5:1 B4:1 A4:1 G4:1 F#4:1 E4:1 D4:2`,
  },
  {
    id: 'twinkle',
    title: 'Twinkle Twinkle',
    emoji: '⭐',
    tempo: 96,
    score: `D4:1 D4:1 A4:1 A4:1 B4:1 B4:1 A4:2  G4:1 G4:1 F#4:1 F#4:1 E4:1 E4:1 D4:2
            A4:1 A4:1 G4:1 G4:1 F#4:1 F#4:1 E4:2  A4:1 A4:1 G4:1 G4:1 F#4:1 F#4:1 E4:2
            D4:1 D4:1 A4:1 A4:1 B4:1 B4:1 A4:2  G4:1 G4:1 F#4:1 F#4:1 E4:1 E4:1 D4:2`,
  },
  {
    id: 'frere-jacques',
    title: 'Frère Jacques',
    emoji: '🔔',
    tempo: 100,
    score: `D4:1 E4:1 F#4:1 D4:1  D4:1 E4:1 F#4:1 D4:1  F#4:1 G4:1 A4:2  F#4:1 G4:1 A4:2
            A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1  A4:.5 B4:.5 A4:.5 G4:.5 F#4:1 D4:1
            D4:1 A3:1 D4:2  D4:1 A3:1 D4:2`,
  },
  {
    id: 'row-boat',
    title: 'Row Row Row Your Boat',
    emoji: '🚣',
    tempo: 100,
    beatsPerBar: 3,
    score: `D4:1.5 D4:1.5  D4:1 E4:.5 F#4:1.5  F#4:1 E4:.5 F#4:1 G4:.5  A4:3
            D5:.5 D5:.5 D5:.5 A4:.5 A4:.5 A4:.5  F#4:.5 F#4:.5 F#4:.5 D4:.5 D4:.5 D4:.5
            A4:1 G4:.5 F#4:1 E4:.5  D4:3`,
  },
  {
    id: 'london-bridge',
    title: 'London Bridge',
    emoji: '🌉',
    tempo: 104,
    score: `A4:1.5 B4:.5 A4:1 G4:1  F#4:1 G4:1 A4:2  E4:1 F#4:1 G4:2  F#4:1 G4:1 A4:2
            A4:1.5 B4:.5 A4:1 G4:1  F#4:1 G4:1 A4:2  E4:2 A4:2  F#4:1 D4:3`,
  },
  {
    id: 'ode-to-joy',
    title: 'Ode to Joy',
    emoji: '🎉',
    tempo: 100,
    score: `F#4:1 F#4:1 G4:1 A4:1  A4:1 G4:1 F#4:1 E4:1  D4:1 D4:1 E4:1 F#4:1  F#4:1.5 E4:.5 E4:2
            F#4:1 F#4:1 G4:1 A4:1  A4:1 G4:1 F#4:1 E4:1  D4:1 D4:1 E4:1 F#4:1  E4:1.5 D4:.5 D4:2`,
  },
  {
    id: 'jingle-bells',
    title: 'Jingle Bells',
    emoji: '🛷',
    tempo: 112,
    score: `F#4:1 F#4:1 F#4:2  F#4:1 F#4:1 F#4:2  F#4:1 A4:1 D4:1.5 E4:.5  F#4:4
            G4:1 G4:1 G4:1.5 G4:.5  G4:1 F#4:1 F#4:1 F#4:.5 F#4:.5  F#4:1 E4:1 E4:1 F#4:1  E4:2 A4:2
            F#4:1 F#4:1 F#4:2  F#4:1 F#4:1 F#4:2  F#4:1 A4:1 D4:1.5 E4:.5  F#4:4
            G4:1 G4:1 G4:1.5 G4:.5  G4:1 F#4:1 F#4:1 F#4:.5 F#4:.5  A4:1 A4:1 G4:1 E4:1  D4:4`,
  },
  {
    id: 'happy-birthday',
    title: 'Happy Birthday',
    emoji: '🎂',
    tempo: 92,
    beatsPerBar: 3,
    score: `A3:.75 A3:.25 B3:1 A3:1 D4:1 C#4:2  A3:.75 A3:.25 B3:1 A3:1 E4:1 D4:2
            A3:.75 A3:.25 A4:1 F#4:1 D4:1 C#4:1 B3:2  G4:.75 G4:.25 F#4:1 D4:1 E4:1 D4:3 R:1`,
  },
];

export function parseScore(score: string): SongNote[] {
  const notes: SongNote[] = [];
  let beat = 0;
  for (const token of score.split(/\s+/).filter(Boolean)) {
    const [name, len] = token.split(':');
    const beats = Number(len);
    if (!(beats > 0)) throw new Error(`Bad length in "${token}"`);
    notes.push({ midi: name === 'R' ? -1 : parseNote(name), beat, beats });
    beat += beats;
  }
  return notes;
}

export const SONGS: readonly Song[] = SOURCES.map((s) => {
  const notes = parseScore(s.score);
  const last = notes[notes.length - 1];
  return {
    id: s.id,
    title: s.title,
    emoji: s.emoji,
    tempo: s.tempo,
    beatsPerBar: s.beatsPerBar ?? 4,
    notes: notes.filter((n) => n.midi >= 0),
    totalBeats: last.beat + last.beats,
  };
});

export function songById(id: string): Song | undefined {
  return SONGS.find((s) => s.id === id);
}
