import type { SkinId } from '../settings';

export interface Skin {
  id: SkinId;
  name: string;
  emoji: string;
  frame: [string, string]; // body gradient
  board: [string, string]; // fingerboard gradient
  string: string;
  nut: string;
  particle: 'notes' | 'stars' | 'hearts';
  particleColors: string[];
  twinkles: boolean;
  rainbowLanes: boolean;
}

export const SKINS: Record<SkinId, Skin> = {
  wood: {
    id: 'wood',
    name: 'Classic Wood',
    emoji: '🎻',
    frame: ['#b5602a', '#6e3212'],
    board: ['#2a1a12', '#140b07'],
    string: '#f1e6d0',
    nut: '#efe3c4',
    particle: 'notes',
    particleColors: ['#ffd166', '#ffb703', '#fff1c1'],
    twinkles: false,
    rainbowLanes: false,
  },
  galaxy: {
    id: 'galaxy',
    name: 'Blue Galaxy',
    emoji: '🌌',
    frame: ['#3a0ca3', '#10002b'],
    board: ['#0b1d51', '#03071e'],
    string: '#bde0fe',
    nut: '#caf0f8',
    particle: 'stars',
    particleColors: ['#4cc9f0', '#f72585', '#ffffff', '#b8c0ff'],
    twinkles: true,
    rainbowLanes: false,
  },
  rainbow: {
    id: 'rainbow',
    name: 'Rainbow',
    emoji: '🌈',
    frame: ['#ff7eb3', '#7afcff'],
    board: ['#fffaf0', '#ffe5ec'],
    string: '#5a4a78',
    nut: '#ffffff',
    particle: 'hearts',
    particleColors: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'],
    twinkles: false,
    rainbowLanes: true,
  },
};
