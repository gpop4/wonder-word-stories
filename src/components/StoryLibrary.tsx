import { useMemo } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Shuffle, Sparkles, Volume2 } from 'lucide-react';
import { PHASE_MAP, PHASE_WORLDS } from '../data/phases';
import { PhaseId, Story } from '../types';
import { StorySceneArt } from './StorySceneArt';

interface StoryLibraryProps {
  stories: Story[];
  phaseFilter: 'all' | PhaseId;
  searchQuery: string;
  spotlightIndex: number;
  completedStoryIds: Set<number>;
  hasStoryStudioVoice: (slug: string) => boolean;
  getSceneImageUrl: (storySlug: string, pageNumber: number) => string | null;
  onChangePhaseFilter: (phase: 'all' | PhaseId) => void;
  onChangeSpotlightIndex: (idx: number) => void;
  onOpenStory: (storyId: number) => void;
  onSurpriseStory: () => void;
}

export function StoryLibrary({
  stories,
  phaseFilter,
  searchQuery,
  spotlightIndex,
  completedStoryIds,
  hasStoryStudioVoice,
  getSceneImageUrl,
  onChangePhaseFilter,
  onChangeSpotlightIndex,
  onOpenStory,
  onSurpriseStory,
}: StoryLibraryProps) {
  const filteredStories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stories.filter((s) => {
      if (phaseFilter !== 'all' && s.phaseId !== phaseFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.theme.toLowerCase().includes(q) ||
        String(s.id) === q ||
        s.words.some(
          (w) =>
            w.word.toLowerCase().includes(q) || w.meaning.toLowerCase().includes(q)
        )
      );
    });
  }, [stories, phaseFilter, searchQuery]);

  const safeIndex =
    filteredStories.length > 0
      ? ((spotlightIndex % filteredStories.length) + filteredStories.length) %
        filteredStories.length
      : 0;

  const featured = filteredStories[safeIndex] ?? null;
  const activePhaseWorld = phaseFilter !== 'all' ? PHASE_MAP[phaseFilter] : null;

  return (
    <div className="library-scroll">
      <div className="library-container">
        {/* Active World Banner OR 10 Worlds Showcase */}
        {activePhaseWorld ? (
          <section
            className="world-banner"
            style={{ '--world-color': activePhaseWorld.color } as React.CSSProperties}
          >
            <img
              src={activePhaseWorld.image}
              alt={activePhaseWorld.name}
              className="world-banner__img"
            />
            <div className="world-banner__scrim" />
            <div className="world-banner__content">
              <span className="world-banner__pill">
                World {activePhaseWorld.number} • Stories {activePhaseWorld.storyRange[0]}–
                {activePhaseWorld.storyRange[1]}
              </span>
              <h2>
                {activePhaseWorld.emoji} {activePhaseWorld.name}
              </h2>
              <p>{activePhaseWorld.tagline}</p>
            </div>
          </section>
        ) : (
          !searchQuery.trim() && (
            <section className="worlds-section" aria-label="10 Story Worlds">
              <div className="library-section-header">
                <div>
                  <h2>🗺️ Explore the 10 Story Worlds</h2>
                  <p>
                    Tap any illustrated world to dive into its 10 stories and 100 new words!
                  </p>
                </div>
                <button
                  type="button"
                  className="surprise-inline-btn"
                  onClick={onSurpriseStory}
                >
                  <Shuffle size={16} /> Pick a Surprise Story!
                </button>
              </div>

              <div className="worlds-grid">
                {PHASE_WORLDS.map((world) => {
                  const worldStories = stories.filter((s) => s.phaseId === world.id);
                  const completedCount = worldStories.filter((s) =>
                    completedStoryIds.has(s.id)
                  ).length;
                  return (
                    <button
                      key={world.id}
                      type="button"
                      className="world-card"
                      style={{ '--world-color': world.color } as React.CSSProperties}
                      onClick={() => {
                        onChangePhaseFilter(world.id);
                        onChangeSpotlightIndex(0);
                      }}
                    >
                      <div className="world-card__img-wrap">
                        <img
                          src={world.image}
                          alt={world.name}
                          className="world-card__img"
                          loading="lazy"
                        />
                        <span className="world-card__badge">
                          Stories {world.storyRange[0]}–{world.storyRange[1]}
                        </span>
                        {completedCount > 0 && (
                          <span className="world-card__progress">
                            ⭐ {completedCount}/10
                          </span>
                        )}
                      </div>
                      <div className="world-card__body">
                        <h3>
                          <span>{world.emoji}</span> {world.shortName}
                        </h3>
                        <p>{world.tagline}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )
        )}

        {/* Spotlight Featured Story Carousel (inspired by wild-world-map!) */}
        {featured && (
          <section className="spotlight-section" aria-label="Spotlight Story">
            <div className="library-section-header">
              <h2>✨ Story Spotlight</h2>
              <div className="spotlight-arrows">
                <span className="spotlight-counter">
                  {safeIndex + 1} / {filteredStories.length}
                </span>
                <button
                  type="button"
                  className="icon-circle-btn"
                  onClick={() =>
                    onChangeSpotlightIndex(
                      (safeIndex - 1 + filteredStories.length) % filteredStories.length
                    )
                  }
                  aria-label="Previous spotlight story"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  className="icon-circle-btn"
                  onClick={() =>
                    onChangeSpotlightIndex((safeIndex + 1) % filteredStories.length)
                  }
                  aria-label="Next spotlight story"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div
              className="spotlight-card"
              style={{ '--story-accent': featured.accentColor } as React.CSSProperties}
              onClick={() => onOpenStory(featured.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenStory(featured.id);
                }
              }}
            >
              <div className="spotlight-card__visual">
                <StorySceneArt
                  scene={featured.scenes[0]}
                  storyId={featured.id}
                  imageUrl={getSceneImageUrl(featured.slug, 1)}
                  compact
                />
                <div className="spotlight-card__pills">
                  <span className="story-badge story-badge--num">
                    Story #{featured.id}
                  </span>
                  {hasStoryStudioVoice(featured.slug) && (
                    <span className="carousel-ai-pill">✨ AI Voice</span>
                  )}
                  {completedStoryIds.has(featured.id) && (
                    <span className="carousel-star-pill">⭐ Read</span>
                  )}
                </div>
              </div>

              <div className="spotlight-card__info">
                <span className="spotlight-card__phase">
                  {PHASE_MAP[featured.phaseId]?.emoji}{' '}
                  {PHASE_MAP[featured.phaseId]?.shortName}
                </span>
                <h3>
                  {featured.coverEmoji} {featured.title}
                </h3>
                <p className="spotlight-card__excerpt">
                  {featured.scenes[0].text.replace(/\*\*/g, '')}
                </p>

                <div className="spotlight-card__words">
                  {featured.words.slice(0, 6).map((w) => (
                    <span key={w.word} className="mini-word-tag">
                      {w.word}
                    </span>
                  ))}
                  <span className="mini-word-tag mini-word-tag--more">+4 more</span>
                </div>

                <div className="spotlight-card__cta">
                  <BookOpen size={18} />
                  <span>Open Illustrated Story Tab</span>
                  <Volume2 size={18} />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Illustrated Story Cards Grid */}
        <section className="stories-grid-section" aria-label="Story Shelf">
          <div className="library-section-header">
            <h2>
              📚{' '}
              {activePhaseWorld
                ? `${activePhaseWorld.shortName} Stories (${filteredStories.length})`
                : searchQuery.trim()
                ? `Matching Stories (${filteredStories.length})`
                : `All ${filteredStories.length} Illustrated Story Tabs`}
            </h2>
          </div>

          {filteredStories.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__emoji">🔍</span>
              <h3>No matching stories or words yet!</h3>
              <p>Try searching for "dragon", "luminous", "Saturn", "volcano", or "T-Rex".</p>
            </div>
          ) : (
            <div className="story-cards-grid">
              {filteredStories.map((s) => {
                const done = completedStoryIds.has(s.id);
                const world = PHASE_MAP[s.phaseId];
                return (
                  <button
                    key={s.id}
                    type="button"
                    className={`story-card ${done ? 'story-card--done' : ''}`}
                    style={{ '--story-accent': s.accentColor } as React.CSSProperties}
                    onClick={() => onOpenStory(s.id)}
                  >
                    <div className="story-card__art">
                      <StorySceneArt
                        scene={s.scenes[0]}
                        storyId={s.id}
                        imageUrl={getSceneImageUrl(s.slug, 1)}
                        compact
                      />
                      <span className="story-card__num">
                        #{String(s.id).padStart(2, '0')}
                      </span>
                      {done && <span className="story-card__star">⭐</span>}
                    </div>
                    <div className="story-card__body">
                      <span className="story-card__phase">
                        {world?.emoji} {world?.shortName}
                      </span>
                      <h3 className="story-card__title">
                        {s.coverEmoji} {s.title}
                      </h3>
                      <div className="story-card__word-preview">
                        <Sparkles size={12} />
                        <span>
                          {s.words
                            .slice(0, 3)
                            .map((w) => w.word)
                            .join(' • ')}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
