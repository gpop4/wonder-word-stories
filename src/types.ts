export type PhaseId =
  | 'wildlife'
  | 'ocean'
  | 'space'
  | 'earth'
  | 'emotions'
  | 'science'
  | 'dinosaurs'
  | 'fantasy'
  | 'detectives'
  | 'culture';

export type SceneBackdrop =
  | 'forest-day'
  | 'forest-dusk'
  | 'forest-autumn'
  | 'forest-night'
  | 'meadow-dawn'
  | 'river-day'
  | 'jungle-bright'
  | 'ocean-reef'
  | 'ocean-deep'
  | 'ocean-surface'
  | 'ocean-arctic'
  | 'beach-sunny'
  | 'space-launch'
  | 'space-moon'
  | 'space-cosmos'
  | 'space-mars'
  | 'space-aurora'
  | 'weather-rain'
  | 'weather-snow'
  | 'weather-storm'
  | 'earth-volcano'
  | 'earth-canyon'
  | 'earth-cave'
  | 'cozy-home'
  | 'classroom-art'
  | 'stage-lights'
  | 'park-sunny'
  | 'workshop-lab'
  | 'dino-jungle'
  | 'dino-cliff'
  | 'dino-ice'
  | 'fantasy-castle'
  | 'fantasy-garden'
  | 'fantasy-sky'
  | 'mystery-attic'
  | 'mystery-night'
  | 'festival-lanterns'
  | 'festival-day';

export type SceneEffect =
  | 'fireflies'
  | 'sparkles'
  | 'bubbles'
  | 'stars'
  | 'leaves'
  | 'snow'
  | 'rain'
  | 'rainbow'
  | 'music'
  | 'wind'
  | 'embers'
  | 'hearts'
  | 'gears'
  | 'petals'
  | 'sunbeams';

export interface VocabWord {
  word: string;
  meaning: string;
}

export interface StoryScene {
  pageNumber: number;
  heading: string;
  text: string;
  caption: string;
  backdrop: SceneBackdrop;
  effect: SceneEffect;
  heroEmoji: string;
  secondaryEmojis: string[];
  palette: [string, string, string];
}

export interface ComprehensionQuestions {
  recall: string;
  vocabulary: string;
  connection: string;
}

export interface Story {
  id: number;
  slug: string;
  phaseId: PhaseId;
  title: string;
  theme: string;
  coverEmoji: string;
  accentColor: string;
  words: VocabWord[];
  scenes: StoryScene[];
  questions: ComprehensionQuestions;
}

export interface PhaseWorld {
  id: PhaseId;
  number: number;
  name: string;
  shortName: string;
  emoji: string;
  color: string;
  gradient: string;
  tagline: string;
  image: string;
  storyRange: [number, number];
}
