import { useCallback, useEffect, useRef, useState } from 'react';
import { Story } from '../types';

export type SpeedPreset = 'slow' | 'normal' | 'fast';

interface AudioCue {
  id: string;
  start: number;
  end: number;
}

interface AudioManifest {
  model?: string;
  voice?: string;
  stories: Record<string, string>;
  cues: Record<string, AudioCue[]>;
}

type QueueStep =
  | {
      kind: 'audio';
      id: string;
      url: string;
      fallbackText: string;
      cues?: AudioCue[];
      clipStart?: number;
      clipEnd?: number;
    }
  | { kind: 'tts'; id: string; text: string };

const AUDIO_RATES: Record<SpeedPreset, number> = {
  slow: 0.85,
  normal: 0.96,
  fast: 1.12,
};

const TTS_RATES: Record<SpeedPreset, number> = {
  slow: 0.68,
  normal: 0.82,
  fast: 0.96,
};

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '');
}

export function useStorySpeech() {
  const [ttsSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [manifest, setManifest] = useState<AudioManifest>({
    stories: {},
    cues: {},
  });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>('normal');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const [activeEngine, setActiveEngine] = useState<'audio' | 'tts' | null>(null);

  const runIdRef = useRef<number>(0);
  const speedRef = useRef<SpeedPreset>(speedPreset);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const activeEngineRef = useRef<'audio' | 'tts' | null>(null);

  const hasStudioVoice = Object.keys(manifest.stories).length > 0;
  const hasStoryStudioVoice = useCallback(
    (storySlug: string) => Boolean(manifest.stories[storySlug]),
    [manifest]
  );
  const supported = ttsSupported || hasStudioVoice;

  useEffect(() => {
    let cancelled = false;
    fetch('./audio/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data === 'object') {
          setManifest({
            model: data.model,
            voice: data.voice,
            stories: data.stories || {},
            cues: data.cues || {},
          });
        }
      })
      .catch(() => {
        // Optional manifest; falls back gracefully to browser speech
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    speedRef.current = speedPreset;
    if (audioRef.current) {
      audioRef.current.playbackRate = AUDIO_RATES[speedPreset];
    }
  }, [speedPreset]);

  useEffect(() => {
    if (!ttsSupported) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      const english = available.filter((v) => v.lang.toLowerCase().startsWith('en'));
      const list = english.length > 0 ? english : available;
      setVoices(list);

      if (!selectedVoiceURI && list.length > 0) {
        const preferredNames = [
          'Samantha',
          'Google US English',
          'Karen',
          'Moira',
          'Tessa',
          'Daniel',
          'Alex',
        ];
        const match =
          preferredNames
            .map((name) => list.find((v) => v.name.includes(name)))
            .find(Boolean) || list[0];
        if (match) {
          setSelectedVoiceURI(match.voiceURI);
        }
      }
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [ttsSupported, selectedVoiceURI]);

  const clearPauseTimer = useCallback(() => {
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, []);

  const stopAudioEl = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.onended = null;
      el.onerror = null;
      el.onplay = null;
      el.ontimeupdate = null;
      el.onloadedmetadata = null;
      el.pause();
      el.currentTime = 0;
      audioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    clearPauseTimer();
    stopAudioEl();
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    activeEngineRef.current = null;
    setActiveEngine(null);
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveSegmentId(null);
  }, [ttsSupported, clearPauseTimer, stopAudioEl]);

  const pause = useCallback(() => {
    if (!isSpeaking) return;
    clearPauseTimer();
    if (activeEngineRef.current === 'audio' && audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    } else if (activeEngineRef.current === 'tts' && ttsSupported) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSpeaking, ttsSupported, clearPauseTimer]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    if (activeEngineRef.current === 'audio' && audioRef.current) {
      audioRef.current.play().catch(() => {});
      setIsPaused(false);
    } else if (activeEngineRef.current === 'tts' && ttsSupported) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isPaused, ttsSupported]);

  const runQueue = useCallback(
    (steps: QueueStep[]) => {
      if (steps.length === 0) return;

      runIdRef.current += 1;
      const currentRunId = runIdRef.current;

      clearPauseTimer();
      stopAudioEl();
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }

      setIsSpeaking(true);
      setIsPaused(false);

      const chosenVoice = voices.find((v) => v.voiceURI === selectedVoiceURI) || null;

      const finishAll = () => {
        if (runIdRef.current !== currentRunId) return;
        activeEngineRef.current = null;
        setActiveEngine(null);
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveSegmentId(null);
      };

      const speakTtsStep = (id: string, text: string, onDone: () => void) => {
        if (!ttsSupported) {
          onDone();
          return;
        }
        activeEngineRef.current = 'tts';
        setActiveEngine('tts');

        const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }
        utterance.rate = TTS_RATES[speedRef.current];
        utterance.pitch = 1.02;

        utterance.onstart = () => {
          if (runIdRef.current === currentRunId) {
            setActiveSegmentId(id);
          }
        };

        utterance.onend = () => {
          if (runIdRef.current === currentRunId) {
            onDone();
          }
        };

        utterance.onerror = () => {
          if (runIdRef.current === currentRunId) {
            finishAll();
          }
        };

        window.speechSynthesis.speak(utterance);
      };

      const playIndex = (idx: number) => {
        if (runIdRef.current !== currentRunId) return;
        if (idx >= steps.length) {
          finishAll();
          return;
        }

        const step = steps[idx];
        const advanceWithPause = () => {
          if (runIdRef.current !== currentRunId) return;
          if (idx + 1 >= steps.length) {
            finishAll();
            return;
          }
          pauseTimerRef.current = window.setTimeout(() => {
            pauseTimerRef.current = null;
            playIndex(idx + 1);
          }, 420);
        };

        if (step.kind === 'audio') {
          activeEngineRef.current = 'audio';
          setActiveEngine('audio');
          setActiveSegmentId(step.id);

          const audio = new Audio(step.url);
          audio.preload = 'auto';
          audio.playbackRate = AUDIO_RATES[speedRef.current];
          audioRef.current = audio;

          const startPlayback = () => {
            if (runIdRef.current !== currentRunId) return;
            if (typeof step.clipStart === 'number' && step.clipStart > 0) {
              try {
                audio.currentTime = step.clipStart;
              } catch {
                // ignore seek error before metadata
              }
            }
            audio.play().catch(() => {
              if (runIdRef.current === currentRunId) {
                stopAudioEl();
                speakTtsStep(step.id, step.fallbackText, advanceWithPause);
              }
            });
          };

          audio.ontimeupdate = () => {
            if (runIdRef.current !== currentRunId) return;
            const t = audio.currentTime;

            // Stop automatically at clipEnd when playing a single page slice
            if (typeof step.clipEnd === 'number' && t >= step.clipEnd + 0.08) {
              stopAudioEl();
              advanceWithPause();
              return;
            }

            // Live-highlight the active page during full-story Kokoro narration
            if (step.cues && step.cues.length > 0) {
              const activeCue = step.cues.find((c) => t >= c.start - 0.15 && t <= c.end + 0.35);
              if (activeCue) {
                setActiveSegmentId(activeCue.id);
              }
            }
          };

          audio.onended = () => {
            if (runIdRef.current === currentRunId) {
              audioRef.current = null;
              advanceWithPause();
            }
          };

          audio.onerror = () => {
            if (runIdRef.current === currentRunId) {
              audioRef.current = null;
              speakTtsStep(step.id, step.fallbackText, advanceWithPause);
            }
          };

          if (typeof step.clipStart === 'number' && step.clipStart > 0) {
            audio.onloadedmetadata = startPlayback;
            audio.load();
          } else {
            startPlayback();
          }
        } else {
          speakTtsStep(step.id, step.text, advanceWithPause);
        }
      };

      playIndex(0);
    },
    [ttsSupported, voices, selectedVoiceURI, clearPauseTimer, stopAudioEl]
  );

  const playWholeStory = useCallback(
    (story: Story) => {
      const studioAudio = manifest.stories[story.slug];
      if (studioAudio) {
        const fallbackFull = [
          `Story number ${story.id}: ${story.title}.`,
          ...story.scenes.map((s) => `${s.heading}. ${stripMarkdown(s.text)}`),
        ].join(' ');
        runQueue([
          {
            kind: 'audio',
            id: 'story-title',
            url: `./${studioAudio}`,
            fallbackText: fallbackFull,
            cues: manifest.cues[story.slug],
          },
        ]);
      } else {
        const steps: QueueStep[] = [
          {
            kind: 'tts',
            id: 'story-title',
            text: `Story number ${story.id}: ${story.title}.`,
          },
          ...story.scenes.map((scene) => ({
            kind: 'tts' as const,
            id: `scene-${scene.pageNumber}`,
            text: `${scene.heading}. ${stripMarkdown(scene.text)}`,
          })),
        ];
        runQueue(steps);
      }
    },
    [manifest, runQueue]
  );

  const playScene = useCallback(
    (storySlug: string, pageNumber: number, heading: string, text: string) => {
      const studioAudio = manifest.stories[storySlug];
      const cues = manifest.cues[storySlug];
      const segId = `scene-${pageNumber}`;
      const pageCue = cues?.find((c) => c.id === segId);

      if (studioAudio && pageCue) {
        runQueue([
          {
            kind: 'audio',
            id: segId,
            url: `./${studioAudio}`,
            fallbackText: `${heading}. ${stripMarkdown(text)}`,
            clipStart: pageCue.start,
            clipEnd: pageCue.end,
          },
        ]);
      } else {
        runQueue([
          {
            kind: 'tts',
            id: segId,
            text: `${heading}. ${stripMarkdown(text)}`,
          },
        ]);
      }
    },
    [manifest, runQueue]
  );

  const speakWord = useCallback(
    (word: string, meaning: string) => {
      runQueue([
        {
          kind: 'tts',
          id: `word-${word.toLowerCase()}`,
          text: `${word}! ${meaning}.`,
        },
      ]);
    },
    [runQueue]
  );

  const speakText = useCallback(
    (text: string, segmentId = 'single') => {
      runQueue([{ kind: 'tts', id: segmentId, text: stripMarkdown(text) }]);
    },
    [runQueue]
  );

  useEffect(() => {
    return () => {
      clearPauseTimer();
      stopAudioEl();
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported, clearPauseTimer, stopAudioEl]);

  return {
    supported,
    hasStudioVoice,
    hasStoryStudioVoice,
    activeEngine,
    speedPreset,
    setSpeedPreset,
    isSpeaking,
    isPaused,
    activeSegmentId,
    playWholeStory,
    playScene,
    speakWord,
    speakText,
    pause,
    resume,
    stop,
  };
}
