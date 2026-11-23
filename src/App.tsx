import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Gem,
  Library,
  Search,
  Shuffle,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PHASE_WORLDS } from './data/phases';
import { ALL_STORIES, STORY_BY_ID, TOTAL_STORIES, TOTAL_WORDS } from './data/stories';
import { PhaseId } from './types';
import { useStorySpeech } from './hooks/useStorySpeech';
import { useSceneImages } from './hooks/useSceneImages';
import { StoryLibrary } from './components/StoryLibrary';
import { makeWordKey, StoryReader } from './components/StoryReader';
import { WordChest } from './components/WordChest';

type AppMode = 'reader' | 'library' | 'words';

const STORAGE_STORIES_KEY = 'wonder-word-stories:completed-stories:v1';
const STORAGE_WORDS_KEY = 'wonder-word-stories:learned-words:v1';

function loadNumberSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((n): n is number => typeof n === 'number'))
      : new Set();
  } catch {
    return new Set();
  }
}

function loadStringSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((s): s is string => typeof s === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

function parseStoryIdFromHash(): number | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#story-(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return STORY_BY_ID[id] ? id : null;
}

export function App() {
  const initialHashId = parseStoryIdFromHash();
  const [mode, setMode] = useState<AppMode>(initialHashId ? 'reader' : 'reader');
  const [activeStoryId, setActiveStoryId] = useState<number>(initialHashId ?? 1);
  const [phaseFilter, setPhaseFilter] = useState<'all' | PhaseId>('all');
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [autoRead, setAutoRead] = useState<boolean>(false);

  const [completedStoryIds, setCompletedStoryIds] = useState<Set<number>>(() =>
    loadNumberSet(STORAGE_STORIES_KEY)
  );
  const [learnedWords, setLearnedWords] = useState<Set<string>>(() =>
    loadStringSet(STORAGE_WORDS_KEY)
  );

  const speech = useStorySpeech();
  const sceneImages = useSceneImages();
  const activeStory = STORY_BY_ID[activeStoryId] ?? ALL_STORIES[0];

  // Persist explorer progress
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_STORIES_KEY,
        JSON.stringify(Array.from(completedStoryIds))
      );
      localStorage.setItem(STORAGE_WORDS_KEY, JSON.stringify(Array.from(learnedWords)));
    } catch {
      // ignore storage errors
    }
  }, [completedStoryIds, learnedWords]);

  // Sync URL hash with active story tab
  useEffect(() => {
    if (mode === 'reader' && activeStory) {
      const targetHash = `#story-${String(activeStory.id).padStart(3, '0')}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, '', targetHash);
      }
    }
  }, [mode, activeStory]);

  useEffect(() => {
    const onHashChange = () => {
      const id = parseStoryIdFromHash();
      if (id) {
        setActiveStoryId(id);
        setMode('reader');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{
      key: string;
      emoji: string;
      title: string;
      subtitle: string;
      storyId: number;
    }> = [];

    for (const s of ALL_STORIES) {
      if (
        s.title.toLowerCase().includes(q) ||
        s.theme.toLowerCase().includes(q) ||
        String(s.id) === q
      ) {
        results.push({
          key: `story-${s.id}`,
          emoji: s.coverEmoji,
          title: `#${s.id} ${s.title}`,
          subtitle: s.theme,
          storyId: s.id,
        });
      }

      for (const w of s.words) {
        if (w.word.toLowerCase().includes(q)) {
          results.push({
            key: `word-${s.id}-${w.word}`,
            emoji: '💎',
            title: w.word,
            subtitle: `${w.meaning} • Story #${s.id}: ${s.title}`,
            storyId: s.id,
          });
        }
      }
    }
    return results.slice(0, 12);
  }, [searchQuery]);

  const handleOpenStory = useCallback(
    (storyId: number) => {
      const target = STORY_BY_ID[storyId];
      if (!target) return;
      speech.stop();
      setActiveStoryId(storyId);
      setMode('reader');
      setSearchOpen(false);
      setSearchQuery('');
      if (autoRead && speech.supported) {
        window.setTimeout(() => {
          speech.playWholeStory(target);
        }, 120);
      }
    },
    [autoRead, speech]
  );

  const handleSwitchMode = useCallback(
    (nextMode: AppMode) => {
      if (nextMode === mode) return;
      speech.stop();
      setMode(nextMode);
      setSearchOpen(false);
    },
    [mode, speech]
  );

  const handleToggleAutoRead = useCallback(() => {
    setAutoRead((prev) => {
      const next = !prev;
      if (!next) speech.stop();
      return next;
    });
  }, [speech]);

  const handleSurpriseMe = useCallback(() => {
    const pool =
      phaseFilter === 'all'
        ? ALL_STORIES
        : ALL_STORIES.filter((s) => s.phaseId === phaseFilter);
    const others = pool.length > 1 ? pool.filter((s) => s.id !== activeStoryId) : pool;
    const pick = others[Math.floor(Math.random() * others.length)] ?? ALL_STORIES[0];
    handleOpenStory(pick.id);
  }, [phaseFilter, activeStoryId, handleOpenStory]);

  const handleToggleStoryComplete = useCallback((storyId: number) => {
    const target = STORY_BY_ID[storyId];
    setCompletedStoryIds((prev) => {
      const next = new Set(prev);
      const markingComplete = !next.has(storyId);
      if (markingComplete) {
        next.add(storyId);
        // Also celebrate by marking this story's 10 words as learned!
        if (target) {
          setLearnedWords((prevWords) => {
            const nextWords = new Set(prevWords);
            target.words.forEach((w) => nextWords.add(makeWordKey(storyId, w.word)));
            return nextWords;
          });
        }
      } else {
        next.delete(storyId);
      }
      return next;
    });
  }, []);

  const handleMarkWordLearned = useCallback((wordKey: string) => {
    setLearnedWords((prev) => {
      if (prev.has(wordKey)) return prev;
      const next = new Set(prev);
      next.add(wordKey);
      return next;
    });
  }, []);

  const handleToggleWordLearned = useCallback((wordKey: string) => {
    setLearnedWords((prev) => {
      const next = new Set(prev);
      if (next.has(wordKey)) next.delete(wordKey);
      else next.add(wordKey);
      return next;
    });
  }, []);

  const handleSelectPhaseChip = useCallback(
    (nextPhase: 'all' | PhaseId) => {
      setPhaseFilter(nextPhase);
      setSpotlightIndex(0);
      if (mode === 'reader' && nextPhase !== 'all') {
        const firstInPhase = ALL_STORIES.find((s) => s.phaseId === nextPhase);
        if (firstInPhase && firstInPhase.phaseId !== activeStory.phaseId) {
          handleOpenStory(firstInPhase.id);
        }
      }
    },
    [mode, activeStory.phaseId, handleOpenStory]
  );

  return (
    <div className="app-shell">
      {/* Top Floating Gradient Header (sibling to Wild World Map) */}
      <header className="top-bar">
        <button
          type="button"
          className="brand-btn"
          onClick={() => handleSwitchMode('library')}
          title="Open Story Library"
        >
          <span className="brand-btn__icon">📖</span>
          <div className="brand-btn__text">
            <h1>Wonder Word Stories</h1>
            <span>100 Illustrated Tabs • 1,000 New Words</span>
          </div>
        </button>

        {/* Mode Switcher */}
        <div className="mode-switcher" role="group" aria-label="App mode">
          <button
            type="button"
            className={`mode-btn ${mode === 'reader' ? 'mode-btn--active' : ''}`}
            onClick={() => handleSwitchMode('reader')}
          >
            <BookOpen size={16} />
            <span>Story Tabs</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'library' ? 'mode-btn--active' : ''}`}
            onClick={() => handleSwitchMode('library')}
          >
            <Library size={16} />
            <span>10 Worlds</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'words' ? 'mode-btn--active' : ''}`}
            onClick={() => handleSwitchMode('words')}
          >
            <Gem size={16} />
            <span>1,000 Words</span>
          </button>
        </div>

        {/* Search Box */}
        <div className="search-wrap">
          <div className="search-input-box">
            <Search size={17} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              placeholder="Search story or word (e.g. Luminous, Dragon)..."
              aria-label="Search stories or vocabulary words"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {mode === 'reader' && searchOpen && searchQuery.trim().length > 0 && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">
                  No matches yet — try &quot;Luminous&quot;, &quot;Dragon&quot;, &quot;Saturn&quot;, or &quot;T-Rex&quot;!
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="search-item"
                    onClick={() => handleOpenStory(item.storyId)}
                  >
                    <span className="search-item__emoji">{item.emoji}</span>
                    <div className="search-item__text">
                      <strong>{item.title}</strong>
                      <span>{item.subtitle}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Top Action Pills & Explorer Progress Passport */}
        <div className="top-actions">
          {speech.supported && (
            <button
              type="button"
              className={`action-pill ${autoRead ? 'action-pill--read-on' : ''}`}
              onClick={handleToggleAutoRead}
              title="Toggle Auto-Read when switching stories"
            >
              {autoRead ? <Volume2 size={17} /> : <VolumeX size={17} />}
              <span>Auto-Read: {autoRead ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <button
            type="button"
            className="action-pill action-pill--surprise"
            onClick={handleSurpriseMe}
            title="Jump to a surprise illustrated story!"
          >
            <Shuffle size={16} />
            <span>Surprise Story!</span>
          </button>

          <div
            className="passport-badge"
            title={`${completedStoryIds.size} of ${TOTAL_STORIES} stories completed • ${learnedWords.size} of ${TOTAL_WORDS} words unlocked!`}
          >
            <span>⭐ {completedStoryIds.size}/{TOTAL_STORIES}</span>
            <span className="passport-badge__sep">•</span>
            <span>💎 {learnedWords.size}/{TOTAL_WORDS}</span>
          </div>
        </div>
      </header>

      {/* 10 Story Worlds Filter Bar */}
      <nav className="filter-bar" aria-label="Filter by story world">
        <button
          type="button"
          className={`filter-chip ${phaseFilter === 'all' ? 'filter-chip--active' : ''}`}
          onClick={() => handleSelectPhaseChip('all')}
        >
          🌈 All 100 Stories
        </button>
        {PHASE_WORLDS.map((w) => {
          const isActive =
            mode === 'reader' ? activeStory.phaseId === w.id : phaseFilter === w.id;
          return (
            <button
              key={w.id}
              type="button"
              className={`filter-chip ${isActive ? 'filter-chip--active' : ''}`}
              onClick={() => handleSelectPhaseChip(w.id)}
            >
              {w.emoji} {w.shortName}
            </button>
          );
        })}
      </nav>

      {/* Active Mode View */}
      <main className="main-stage">
        {mode === 'reader' ? (
          <StoryReader
            allStories={ALL_STORIES}
            story={activeStory}
            completedStoryIds={completedStoryIds}
            learnedWords={learnedWords}
            autoRead={autoRead}
            onToggleAutoRead={handleToggleAutoRead}
            speech={speech}
            getSceneImageUrl={sceneImages.getSceneImageUrl}
            onSelectStory={handleOpenStory}
            onToggleStoryComplete={handleToggleStoryComplete}
            onMarkWordLearned={handleMarkWordLearned}
            onToggleWordLearned={handleToggleWordLearned}
          />
        ) : mode === 'library' ? (
          <StoryLibrary
            stories={ALL_STORIES}
            phaseFilter={phaseFilter}
            searchQuery={searchQuery}
            spotlightIndex={spotlightIndex}
            completedStoryIds={completedStoryIds}
            hasStoryStudioVoice={speech.hasStoryStudioVoice}
            getSceneImageUrl={sceneImages.getSceneImageUrl}
            onChangePhaseFilter={setPhaseFilter}
            onChangeSpotlightIndex={setSpotlightIndex}
            onOpenStory={handleOpenStory}
            onSurpriseStory={handleSurpriseMe}
          />
        ) : (
          <WordChest
            stories={ALL_STORIES}
            phaseFilter={phaseFilter}
            searchQuery={searchQuery}
            learnedWords={learnedWords}
            speechSupported={speech.supported}
            onSpeakWord={speech.speakWord}
            onToggleWordLearned={handleToggleWordLearned}
            onOpenStory={handleOpenStory}
          />
        )}
      </main>
    </div>
  );
}

export default App;
