// Navigation between screens. Kept in one place so screens don't import each other.

import type { Recording } from '../record/recording';
import type { Reward } from '../state/profile';
import type { Song } from '../music/songs';
import { show } from './dom';
import { gameScreen } from './gameScreen';
import { gardenScreen, playHubScreen, rewardsScreen } from './gardenScreens';
import { homeScreen, myMusicScreen, replayScreen, songsScreen } from './menuScreens';
import { playScreen } from './playScreen';

export const goHome = () => show(homeScreen);
export const goPlay = (withOrchestra: boolean) => show(playScreen(withOrchestra));
export const goSongs = () => show(songsScreen);
export const goGame = (song: Song) => show(gameScreen(song));
export const goMyMusic = () => show(myMusicScreen);
export const goReplay = (rec: Recording) => show(replayScreen(rec));
export const goPlayHub = () => show(playHubScreen);
export const goRewards = (reward: Reward) => show(rewardsScreen(reward));
export const goGarden = (highlight?: string) => show(gardenScreen(highlight));
