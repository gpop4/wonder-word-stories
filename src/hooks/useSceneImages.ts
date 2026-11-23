import { useCallback, useEffect, useState } from 'react';

interface ImageManifest {
  scenes: Record<string, string>;
}

export function useSceneImages() {
  const [scenes, setScenes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('./images/manifest.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ImageManifest | null) => {
        if (!cancelled && data && typeof data === 'object' && data.scenes) {
          setScenes(data.scenes);
        }
      })
      .catch(() => {
        // Optional manifest; falls back smoothly to vector scene art
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getSceneImageUrl = useCallback(
    (storySlug: string, pageNumber: number): string | null => {
      const rel = scenes[`${storySlug}-p${pageNumber}`];
      return rel ? `./${rel}` : null;
    },
    [scenes]
  );

  return {
    generatedCount: Object.keys(scenes).length,
    getSceneImageUrl,
  };
}
