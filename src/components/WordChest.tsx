import { useMemo, useState } from 'react';
import { BookOpen, Volume2 } from 'lucide-react';
import { PHASE_MAP } from '../data/phases';
import { PhaseId, Story } from '../types';
import { makeWordKey } from './StoryReader';

interface WordChestProps {
  stories: Story[];
  phaseFilter: 'all' | PhaseId;
  searchQuery: string;
  learnedWords: Set<string>;
  speechSupported: boolean;
  onSpeakWord: (word: string, meaning: string) => void;
  onToggleWordLearned: (wordKey: string) => void;
  onOpenStory: (storyId: number) => void;
}

export function WordChest({
  stories,
  phaseFilter,
  searchQuery,
  learnedWords,
  speechSupported,
  onSpeakWord,
  onToggleWordLearned,
  onOpenStory,
}: WordChestProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'learned' | 'unlearned'>('all');

  const entries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list: Array<{
      key: string;
      word: string;
      meaning: string;
      story: Story;
      learned: boolean;
    }> = [];

    for (const story of stories) {
      if (phaseFilter !== 'all' && story.phaseId !== phaseFilter) continue;
      for (const w of story.words) {
        const key = makeWordKey(story.id, w.word);
        const learned = learnedWords.has(key);
        if (statusFilter === 'learned' && !learned) continue;
        if (statusFilter === 'unlearned' && learned) continue;
        if (
          q &&
          !w.word.toLowerCase().includes(q) &&
          !w.meaning.toLowerCase().includes(q) &&
          !story.title.toLowerCase().includes(q)
        ) {
          continue;
        }
        list.push({ key, word: w.word, meaning: w.meaning, story, learned });
      }
    }
    return list;
  }, [stories, phaseFilter, searchQuery, learnedWords, statusFilter]);

  return (
    <div className="library-scroll">
      <div className="library-container">
        <section className="word-chest-header">
          <div>
            <h2>💎 1,000-Word Treasure Chest</h2>
            <p>
              Tap any word to hear it pronounced with its kid-friendly meaning, or jump straight
              into its illustrated story!
            </p>
          </div>
          <div className="word-chest-filters">
            {(
              [
                { id: 'all', label: 'All Words' },
                { id: 'learned', label: `⭐ Learned (${learnedWords.size})` },
                { id: 'unlearned', label: '✨ To Discover' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                className={`filter-chip ${statusFilter === btn.id ? 'filter-chip--active' : ''}`}
                onClick={() => setStatusFilter(btn.id)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </section>

        <p className="word-chest-count">Showing {entries.length} vocabulary words</p>

        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__emoji">💎</span>
            <h3>No words match this filter yet!</h3>
            <p>Open a story tab and tap glowing words to unlock them in your treasure chest.</p>
          </div>
        ) : (
          <div className="word-chest-grid">
            {entries.map((item) => {
              const world = PHASE_MAP[item.story.phaseId];
              return (
                <div
                  key={item.key}
                  className={`chest-word-card ${
                    item.learned ? 'chest-word-card--learned' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="chest-word-card__speak"
                    onClick={() => {
                      if (speechSupported) {
                        onSpeakWord(item.word, item.meaning);
                      }
                    }}
                  >
                    <div className="chest-word-card__top">
                      <strong>{item.word}</strong>
                      {speechSupported && <Volume2 size={16} />}
                    </div>
                    <p>{item.meaning}</p>
                  </button>

                  <div className="chest-word-card__footer">
                    <button
                      type="button"
                      className="chest-story-link"
                      onClick={() => onOpenStory(item.story.id)}
                    >
                      <BookOpen size={13} />
                      <span>
                        {world?.emoji} Story #{item.story.id}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`chest-star-btn ${
                        item.learned ? 'chest-star-btn--on' : ''
                      }`}
                      onClick={() => onToggleWordLearned(item.key)}
                    >
                      {item.learned ? '⭐ Learned' : '☆ Learn'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
