import { Story } from '../types';
import { PHASE_01_02_STORIES } from './phases/phase01_02';
import { PHASE_03_04_STORIES } from './phases/phase03_04';
import { PHASE_05_06_STORIES } from './phases/phase05_06';
import { PHASE_07_08_STORIES } from './phases/phase07_08';
import { PHASE_09_10_STORIES } from './phases/phase09_10';

export const ALL_STORIES: Story[] = [
  ...PHASE_01_02_STORIES,
  ...PHASE_03_04_STORIES,
  ...PHASE_05_06_STORIES,
  ...PHASE_07_08_STORIES,
  ...PHASE_09_10_STORIES,
].sort((a, b) => a.id - b.id);

export const STORY_BY_ID: Record<number, Story> = Object.fromEntries(
  ALL_STORIES.map((s) => [s.id, s])
);

export const TOTAL_STORIES = ALL_STORIES.length;
export const TOTAL_WORDS = ALL_STORIES.reduce((sum, s) => sum + s.words.length, 0);
