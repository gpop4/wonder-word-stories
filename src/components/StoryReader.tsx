import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Maximize2,
  Pause,
  Play,
  Sparkles,
  Square,
  Star,
  Volume2,
  X,
} from 'lucide-react';
import { PHASE_MAP } from '../data/phases';
import { SpeedPreset } from '../hooks/useStorySpeech';
import { Story, VocabWord } from '../types';
import { StorySceneArt } from './StorySceneArt';

interface StoryReaderProps {
  allStories: Story[];
  story: Story;
  completedStoryIds: Set<number>;
  learnedWords: Set<string>;
  autoRead: boolean;
  onToggleAutoRead: () => void;
  speech: {
    supported: boolean;
    hasStudioVoice: boolean;
    hasStoryStudioVoice: (storySlug: string) => boolean;
    activeEngine: 'audio' | 'tts' | null;
    speedPreset: SpeedPreset;
    setSpeedPreset: (preset: SpeedPreset) => void;
    isSpeaking: boolean;
    isPaused: boolean;
    activeSegmentId: string | null;
    playWholeStory: (story: Story) => void;
    playScene: (pageNumber: number, heading: string, text: string) => void;
    speakWord: (word: string, meaning: string) => void;
    speakText: (text: string, segmentId?: string) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
  };
  onSelectStory: (storyId: number) => void;
  onToggleStoryComplete: (storyId: number) => void;
  onMarkWordLearned: (wordKey: string) => void;
  onToggleWordLearned: (wordKey: string) => void;
}

export function makeWordKey(storyId: number, word: string): string {
  return `${storyId}:${word.toLowerCase()}`;
}

function matchVocabWord(rawToken: string, words: VocabWord[]): VocabWord | null {
  const clean = rawToken.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!clean) return null;

  // 1. Exact match
  const exact = words.find((w) => w.word.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Prefix / inflection match (e.g., meanders -> meander, perches -> perch, pebbles -> pebble, glowing -> glow)
  const candidates = words.filter((w) => {
    const base = w.word.toLowerCase();
    const stem = base.length > 4 && base.endsWith('e') ? base.slice(0, -1) : base;
    const stemY = base.length > 4 && base.endsWith('y') ? base.slice(0, -1) + 'i' : base;
    return (
      clean.startsWith(base) ||
      base.startsWith(clean) ||
      clean.startsWith(stem) ||
      clean.startsWith(stemY)
    );
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.word.length - a.word.length);
    return candidates[0];
  }
  return null;
}

function buildGeminiPrompt(story: Story): string {
  const wordLines = story.words
    .map((w, i) => `${i + 1}. ${w.word} [${w.meaning}]`)
    .join('\n');
  const plotLines = story.scenes
    .map((s) => `- **Page ${s.pageNumber} (${s.heading}):** ${s.text}`)
    .join('\n');

  return `Create an illustrated children's storybook suitable for a 5-year-old child titled:
"${story.title}"

### Theme:
${story.theme}

### 10 Target Vocabulary Words to Include:
${wordLines}

### Story Outline (6 Illustrated Pages):
${plotLines}

### Ending Page: Word Treasure Chest & Comprehension Check:
1. Review all 10 bolded vocabulary words with child-friendly definitions.
2. Include 3 interactive comprehension questions:
   - Story Recall: "${story.questions.recall}"
   - Vocabulary in Context: "${story.questions.vocabulary}"
   - Creative Connection: "${story.questions.connection}"`;
}

export function StoryReader({
  allStories,
  story,
  completedStoryIds,
  learnedWords,
  autoRead,
  onToggleAutoRead,
  speech,
  onSelectStory,
  onToggleStoryComplete,
  onMarkWordLearned,
  onToggleWordLearned,
}: StoryReaderProps) {
  const [tabScope, setTabScope] = useState<'phase' | 'all'>('phase');
  const [activeWordPopup, setActiveWordPopup] = useState<VocabWord | null>(null);
  const [checkedQuestions, setCheckedQuestions] = useState<Record<string, boolean>>({});
  const [lightboxPageIdx, setLightboxPageIdx] = useState<number | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const readerScrollRef = useRef<HTMLDivElement | null>(null);

  const phase = PHASE_MAP[story.phaseId];
  const isCompleted = completedStoryIds.has(story.id);

  const tabStories = useMemo(() => {
    if (tabScope === 'all') return allStories;
    return allStories.filter((s) => s.phaseId === story.phaseId);
  }, [allStories, story.phaseId, tabScope]);

  const prevStory = allStories.find((s) => s.id === story.id - 1) ?? null;
  const nextStory = allStories.find((s) => s.id === story.id + 1) ?? null;

  // Reset per-story UI state and scroll to top when switching story tabs
  useEffect(() => {
    setActiveWordPopup(null);
    setCheckedQuestions({});
    setLightboxPageIdx(null);
    setPromptOpen(false);
    setCopiedPrompt(false);
    readerScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [story.id]);

  // Keep active story tab centered in the tab strip without shifting outer layout
  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const activeTab = strip.querySelector<HTMLElement>('[data-active="true"]');
    if (activeTab) {
      const targetLeft = Math.max(
        0,
        activeTab.offsetLeft - strip.clientWidth / 2 + activeTab.clientWidth / 2
      );
      strip.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  }, [story.id, tabScope]);

  // Keyboard navigation (Left/Right switches stories, or lightbox pages if open)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (lightboxPageIdx !== null) {
        if (e.key === 'Escape') setLightboxPageIdx(null);
        else if (e.key === 'ArrowRight') {
          setLightboxPageIdx((idx) =>
            idx === null ? null : (idx + 1) % story.scenes.length
          );
        } else if (e.key === 'ArrowLeft') {
          setLightboxPageIdx((idx) =>
            idx === null
              ? null
              : (idx - 1 + story.scenes.length) % story.scenes.length
          );
        }
        return;
      }
      if (e.key === 'Escape' && activeWordPopup) {
        setActiveWordPopup(null);
      } else if (e.key === 'ArrowRight' && nextStory) {
        onSelectStory(nextStory.id);
      } else if (e.key === 'ArrowLeft' && prevStory) {
        onSelectStory(prevStory.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxPageIdx, activeWordPopup, nextStory, prevStory, onSelectStory, story.scenes.length]);

  const handleTapVocab = (vocab: VocabWord) => {
    setActiveWordPopup(vocab);
    onMarkWordLearned(makeWordKey(story.id, vocab.word));
    if (speech.supported) {
      speech.speakWord(vocab.word, vocab.meaning);
    }
  };

  const renderStoryTextWithVocab = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const display = part.slice(2, -2);
        const matched = matchVocabWord(display, story.words);
        if (matched) {
          const isLearned = learnedWords.has(makeWordKey(story.id, matched.word));
          const isSelected = activeWordPopup?.word === matched.word;
          return (
            <button
              key={idx}
              type="button"
              className={`vocab-inline-chip ${isLearned ? 'vocab-inline-chip--learned' : ''} ${
                isSelected ? 'vocab-inline-chip--active' : ''
              }`}
              onClick={() => handleTapVocab(matched)}
              title={`Tap to hear meaning: ${matched.meaning}`}
            >
              {display}
              <span className="vocab-inline-chip__dot" aria-hidden="true">
                ✨
              </span>
            </button>
          );
        }
        return <strong key={idx}>{display}</strong>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  const learnedInThisStory = story.words.filter((w) =>
    learnedWords.has(makeWordKey(story.id, w.word))
  ).length;

  const isWholeStorySpeaking =
    speech.isSpeaking &&
    (speech.activeSegmentId === 'whole-story' || speech.activeSegmentId === 'story-title');

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildGeminiPrompt(story));
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const lightboxScene = lightboxPageIdx !== null ? story.scenes[lightboxPageIdx] : null;

  return (
    <div className="reader-shell">
      {/* Persistent 100-Story Page Tab Bar */}
      <div className="story-tabs-bar">
        <div className="story-tabs-bar__scope">
          <button
            type="button"
            className={`scope-pill ${tabScope === 'phase' ? 'scope-pill--active' : ''}`}
            onClick={() => setTabScope('phase')}
          >
            {phase?.emoji} World {phase?.number} (10)
          </button>
          <button
            type="button"
            className={`scope-pill ${tabScope === 'all' ? 'scope-pill--active' : ''}`}
            onClick={() => setTabScope('all')}
          >
            📚 All 100 Tabs
          </button>
        </div>

        <div
          ref={tabStripRef}
          className="story-tabs-strip"
          role="tablist"
          aria-label="Story page tabs"
        >
          {tabStories.map((s) => {
            const active = s.id === story.id;
            const done = completedStoryIds.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-active={active}
                className={`story-tab ${active ? 'story-tab--active' : ''} ${
                  done ? 'story-tab--done' : ''
                }`}
                style={{ '--tab-accent': s.accentColor } as React.CSSProperties}
                onClick={() => onSelectStory(s.id)}
              >
                <span className="story-tab__num">#{String(s.id).padStart(2, '0')}</span>
                <span className="story-tab__emoji">{s.coverEmoji}</span>
                <span className="story-tab__title">{s.title}</span>
                {done && <span className="story-tab__star">⭐</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Scrollable Illustrated Story Page */}
      <div ref={readerScrollRef} className="reader-scroll">
        <article className="story-page">
          {/* Story Cover Hero Banner with Watercolor World Art */}
          <header
            className={`story-hero ${isWholeStorySpeaking ? 'speaking-highlight' : ''}`}
            style={{ '--story-accent': story.accentColor } as React.CSSProperties}
          >
            <img
              src={phase?.image}
              alt={phase?.name}
              className="story-hero__bg-img"
            />
            <div className="story-hero__scrim" />

            <div className="story-hero__inner">
              <div className="story-hero__top-row">
                <div className="story-hero__badges">
                  <span className="story-badge story-badge--num">
                    Story {story.id} of 100
                  </span>
                  <span className="story-badge story-badge--phase">
                    {phase?.emoji} {phase?.shortName}
                  </span>
                  <span className="story-badge story-badge--words">
                    💎 {learnedInThisStory} / 10 Words
                  </span>
                </div>

                <button
                  type="button"
                  className={`complete-pill ${isCompleted ? 'complete-pill--done' : ''}`}
                  onClick={() => onToggleStoryComplete(story.id)}
                >
                  <Star size={16} fill={isCompleted ? '#facc15' : 'none'} />
                  <span>{isCompleted ? 'Story Completed!' : 'Mark Complete'}</span>
                </button>
              </div>

              <div className="story-hero__title-block">
                <div className="story-hero__emblem">{story.coverEmoji}</div>
                <div>
                  <h2 className="story-hero__title">{story.title}</h2>
                  <p className="story-hero__theme">{story.theme}</p>
                </div>
              </div>

              {/* Studio Read-Aloud Bar (matching wild-world-map) */}
              {speech.supported && (
                <div className="speech-bar">
                  <div className="speech-bar__buttons">
                    {!speech.isSpeaking ? (
                      <button
                        type="button"
                        className="btn-read-aloud"
                        onClick={() => speech.playWholeStory(story)}
                      >
                        <Volume2 size={18} /> Read Whole Story
                      </button>
                    ) : speech.isPaused ? (
                      <button
                        type="button"
                        className="btn-read-aloud btn-read-aloud--active"
                        onClick={speech.resume}
                      >
                        <Play size={18} /> Resume
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-read-aloud btn-read-aloud--active"
                        onClick={speech.pause}
                      >
                        <Pause size={18} /> Pause
                      </button>
                    )}

                    {speech.isSpeaking && (
                      <button
                        type="button"
                        className="btn-stop-speech"
                        onClick={speech.stop}
                      >
                        <Square size={14} /> Stop
                      </button>
                    )}
                  </div>

                  <div className="speech-bar__options">
                    {speech.hasStoryStudioVoice(story.slug) && (
                      <span
                        className="studio-voice-tag"
                        title="Pre-recorded Studio AI Narration"
                      >
                        ✨ AI Voice
                      </span>
                    )}
                    <button
                      type="button"
                      className={`speed-pill ${
                        speech.speedPreset === 'slow' ? 'speed-pill--active' : ''
                      }`}
                      onClick={() => speech.setSpeedPreset('slow')}
                      title="Extra slow story pace"
                    >
                      🐢
                    </button>
                    <button
                      type="button"
                      className={`speed-pill ${
                        speech.speedPreset === 'normal' ? 'speed-pill--active' : ''
                      }`}
                      onClick={() => speech.setSpeedPreset('normal')}
                      title="Gentle kid-friendly speed"
                    >
                      🦊
                    </button>
                    <button
                      type="button"
                      className={`speed-pill ${
                        speech.speedPreset === 'fast' ? 'speed-pill--active' : ''
                      }`}
                      onClick={() => speech.setSpeedPreset('fast')}
                      title="Faster speed"
                    >
                      🐆
                    </button>
                    <button
                      type="button"
                      className={`auto-read-mini ${autoRead ? 'auto-read-mini--on' : ''}`}
                      onClick={onToggleAutoRead}
                      title="Automatically read when opening a story tab"
                    >
                      {autoRead ? 'Auto: ON' : 'Auto: OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </header>

          {/* 10 New Words Preview Ribbon */}
          <section className="word-preview-ribbon" aria-label="10 New Words in This Story">
            <div className="word-preview-ribbon__label">
              <Sparkles size={16} />
              <span>Tap any glowing word to hear its meaning:</span>
            </div>
            <div className="word-preview-ribbon__chips">
              {story.words.map((w) => {
                const learned = learnedWords.has(makeWordKey(story.id, w.word));
                const active = activeWordPopup?.word === w.word;
                return (
                  <button
                    key={w.word}
                    type="button"
                    className={`preview-word-pill ${
                      learned ? 'preview-word-pill--learned' : ''
                    } ${active ? 'preview-word-pill--active' : ''}`}
                    onClick={() => handleTapVocab(w)}
                  >
                    <span>{w.word}</span>
                    {learned && <span className="preview-word-pill__star">⭐</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Intermixed Text & Visuals — 6 Illustrated Storybook Spreads */}
          <section className="story-spreads" aria-label="Illustrated Story Pages">
            {story.scenes.map((scene, idx) => {
              const isReversed = idx % 2 === 1;
              const isReadingScene = speech.activeSegmentId === `scene-${scene.pageNumber}`;
              return (
                <div
                  key={scene.pageNumber}
                  className={`story-spread ${isReversed ? 'story-spread--reverse' : ''} ${
                    isReadingScene ? 'speaking-highlight' : ''
                  }`}
                >
                  {/* Visual Column */}
                  <div className="story-spread__visual">
                    <div className="story-spread__art-frame">
                      <StorySceneArt
                        scene={scene}
                        storyId={story.id}
                        onClick={() => setLightboxPageIdx(idx)}
                      />
                      <button
                        type="button"
                        className="hero-zoom-btn"
                        onClick={() => setLightboxPageIdx(idx)}
                        title="See Big Picture"
                      >
                        <Maximize2 size={14} /> Big Picture
                      </button>
                    </div>
                    <p className="story-spread__caption">
                      <span className="story-spread__caption-emoji">{scene.heroEmoji}</span>{' '}
                      {scene.caption}
                    </p>
                  </div>

                  {/* Narrative Text Column */}
                  <div className="story-spread__content">
                    <div className="story-spread__header">
                      <span className="story-spread__page-tag">
                        Page {scene.pageNumber}
                      </span>
                      <h3 className="story-spread__heading">{scene.heading}</h3>
                      {speech.supported && (
                        <button
                          type="button"
                          className={`inline-speak-pill ${
                            isReadingScene ? 'inline-speak-pill--active' : ''
                          }`}
                          onClick={() =>
                            speech.playScene(scene.pageNumber, scene.heading, scene.text)
                          }
                          title={`Read Page ${scene.pageNumber} aloud`}
                        >
                          <Volume2 size={14} /> Hear Page
                        </button>
                      )}
                    </div>

                    <p className="story-spread__text">
                      {renderStoryTextWithVocab(scene.text)}
                    </p>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Word Treasure Chest — Interactive 10-Word Flashcards */}
          <section className="treasure-chest" aria-label="Word Treasure Chest">
            <div className="section-heading-row">
              <div>
                <h3>💎 Word Treasure Chest (10 New Words)</h3>
                <p>Tap any treasure card to hear the word and practice using it together!</p>
              </div>
              <span className="treasure-chest__progress">
                ⭐ {learnedInThisStory} / 10 Learned
              </span>
            </div>

            <div className="treasure-grid">
              {story.words.map((w, idx) => {
                const key = makeWordKey(story.id, w.word);
                const learned = learnedWords.has(key);
                const isSpeakingWord =
                  speech.activeSegmentId === `word-${w.word.toLowerCase()}`;
                return (
                  <div
                    key={w.word}
                    className={`treasure-card ${learned ? 'treasure-card--learned' : ''} ${
                      isSpeakingWord ? 'speaking-highlight' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="treasure-card__main"
                      onClick={() => handleTapVocab(w)}
                    >
                      <div className="treasure-card__top">
                        <span className="treasure-card__num">{idx + 1}</span>
                        <strong className="treasure-card__word">{w.word}</strong>
                        <Volume2 size={16} className="treasure-card__speaker" />
                      </div>
                      <p className="treasure-card__meaning">{w.meaning}</p>
                    </button>
                    <button
                      type="button"
                      className={`treasure-card__check ${
                        learned ? 'treasure-card__check--on' : ''
                      }`}
                      onClick={() => onToggleWordLearned(key)}
                      aria-label={learned ? `Unmark ${w.word}` : `Mark ${w.word} learned`}
                    >
                      {learned ? '⭐ Learned!' : '☆ Mark Learned'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Story Explorer Comprehension Check (3 Questions) */}
          <section className="comprehension-card" aria-label="Comprehension Check">
            <div className="comprehension-card__header">
              <div>
                <h3>🧠 Story Explorer Comprehension Check</h3>
                <p>
                  Ask your 5-year-old these 3 fun questions after finishing the story!
                </p>
              </div>
            </div>

            <div className="comprehension-list">
              {(
                [
                  {
                    id: 'recall',
                    badge: '🔍 Question 1 • Story Recall',
                    text: story.questions.recall,
                  },
                  {
                    id: 'vocabulary',
                    badge: '💬 Question 2 • Vocabulary in Context',
                    text: story.questions.vocabulary,
                  },
                  {
                    id: 'connection',
                    badge: '🌟 Question 3 • Creative Connection',
                    text: story.questions.connection,
                  },
                ] as const
              ).map((q) => {
                const done = Boolean(checkedQuestions[q.id]);
                const segId = `question-${q.id}`;
                const speaking = speech.activeSegmentId === segId;
                return (
                  <div
                    key={q.id}
                    className={`question-box ${done ? 'question-box--done' : ''} ${
                      speaking ? 'speaking-highlight' : ''
                    }`}
                  >
                    <div className="question-box__top">
                      <span className="question-box__badge">{q.badge}</span>
                      {speech.supported && (
                        <button
                          type="button"
                          className="inline-speak-pill"
                          onClick={() => speech.speakText(q.text, segId)}
                        >
                          <Volume2 size={13} /> Read Question
                        </button>
                      )}
                    </div>
                    <p className="question-box__text">{q.text}</p>
                    <button
                      type="button"
                      className={`question-done-btn ${done ? 'question-done-btn--on' : ''}`}
                      onClick={() =>
                        setCheckedQuestions((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                      }
                    >
                      <CheckCircle2 size={16} />
                      <span>{done ? 'We Talked About It! 🎉' : 'Mark Discussed'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Finish Story Celebration Button */}
            <div className="finish-story-banner">
              <button
                type="button"
                className={`finish-story-btn ${isCompleted ? 'finish-story-btn--done' : ''}`}
                onClick={() => onToggleStoryComplete(story.id)}
              >
                <Star size={20} fill={isCompleted ? '#422006' : 'none'} />
                <span>
                  {isCompleted
                    ? 'Hooray! Story Star Collected ⭐'
                    : 'Finish Story & Collect Star! ⭐'}
                </span>
              </button>
            </div>
          </section>

          {/* Big Previous / Next Story Tab Footer Navigation */}
          <nav className="story-bottom-nav" aria-label="Story navigation">
            {prevStory ? (
              <button
                type="button"
                className="story-nav-card"
                onClick={() => onSelectStory(prevStory.id)}
              >
                <ChevronLeft size={24} />
                <div className="story-nav-card__text">
                  <span>Previous Story (#{prevStory.id})</span>
                  <strong>
                    {prevStory.coverEmoji} {prevStory.title}
                  </strong>
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextStory ? (
              <button
                type="button"
                className="story-nav-card story-nav-card--next"
                onClick={() => onSelectStory(nextStory.id)}
              >
                <div className="story-nav-card__text">
                  <span>Next Story (#{nextStory.id})</span>
                  <strong>
                    {nextStory.coverEmoji} {nextStory.title}
                  </strong>
                </div>
                <ChevronRight size={24} />
              </button>
            ) : (
              <div />
            )}
          </nav>

          {/* Collapsible Parent Bonus: Original Gemini Storybook Gem Prompt */}
          <section className="parent-prompt-box">
            <button
              type="button"
              className="parent-prompt-box__toggle"
              onClick={() => setPromptOpen((v) => !v)}
            >
              <span className="parent-prompt-box__title">
                <BookOpen size={16} />
                Parent Bonus: View / Copy Gemini Storybook Gem Prompt
              </span>
              {promptOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {promptOpen && (
              <div className="parent-prompt-box__body">
                <div className="parent-prompt-box__actions">
                  <span>Paste into Gemini Storybook Gem if you want to generate another illustrated edition:</span>
                  <button
                    type="button"
                    className="copy-prompt-btn"
                    onClick={handleCopyPrompt}
                  >
                    {copiedPrompt ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedPrompt ? 'Copied!' : 'Copy Prompt'}</span>
                  </button>
                </div>
                <pre className="parent-prompt-box__pre">{buildGeminiPrompt(story)}</pre>
              </div>
            )}
          </section>
        </article>
      </div>

      {/* Floating Word Meaning Popover (appears when tapping any bolded vocabulary word!) */}
      {activeWordPopup && (
        <div className="word-toast" role="status" aria-live="polite">
          <div className="word-toast__left">
            <span className="word-toast__spark">💎</span>
            <div>
              <div className="word-toast__word-row">
                <strong>{activeWordPopup.word}</strong>
                <span className="word-toast__saved">⭐ Added to Word Chest</span>
              </div>
              <p className="word-toast__meaning">{activeWordPopup.meaning}</p>
            </div>
          </div>
          <div className="word-toast__actions">
            {speech.supported && (
              <button
                type="button"
                className="word-toast__speak-btn"
                onClick={() =>
                  speech.speakWord(activeWordPopup.word, activeWordPopup.meaning)
                }
                aria-label={`Hear ${activeWordPopup.word}`}
              >
                <Volume2 size={18} /> Hear Again
              </button>
            )}
            <button
              type="button"
              className="icon-circle-btn"
              onClick={() => setActiveWordPopup(null)}
              aria-label="Close word definition"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Big Picture Storybook Lightbox */}
      {lightboxScene && lightboxPageIdx !== null && (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Illustration for Page ${lightboxScene.pageNumber}`}
          onClick={() => setLightboxPageIdx(null)}
        >
          <div className="photo-lightbox__card" onClick={(e) => e.stopPropagation()}>
            <div className="photo-lightbox__top">
              <div className="photo-lightbox__title">
                <span>{lightboxScene.heroEmoji}</span>
                <h3>
                  Page {lightboxScene.pageNumber}: {lightboxScene.heading}
                </h3>
              </div>
              <button
                type="button"
                className="icon-circle-btn"
                onClick={() => setLightboxPageIdx(null)}
                aria-label="Close big picture"
              >
                <X size={20} />
              </button>
            </div>

            <div className="photo-lightbox__stage">
              <div className="photo-lightbox__art-wrap">
                <StorySceneArt scene={lightboxScene} storyId={story.id} />
              </div>

              <button
                type="button"
                className="hero-nav-btn hero-nav-btn--prev"
                onClick={() =>
                  setLightboxPageIdx(
                    (lightboxPageIdx - 1 + story.scenes.length) % story.scenes.length
                  )
                }
                aria-label="Previous page illustration"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="hero-nav-btn hero-nav-btn--next"
                onClick={() =>
                  setLightboxPageIdx((lightboxPageIdx + 1) % story.scenes.length)
                }
                aria-label="Next page illustration"
              >
                <ChevronRight size={28} />
              </button>
            </div>

            <div className="photo-lightbox__footer">
              <p className="photo-lightbox__caption">
                {lightboxScene.text.replace(/\*\*/g, '')}
              </p>
              {speech.supported && (
                <button
                  type="button"
                  className="btn-read-aloud"
                  onClick={() =>
                    speech.playScene(
                      lightboxScene.pageNumber,
                      lightboxScene.heading,
                      lightboxScene.text
                    )
                  }
                >
                  <Volume2 size={18} /> Hear Page
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
