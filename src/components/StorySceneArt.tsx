import { useId } from 'react';
import { SceneBackdrop, SceneEffect, StoryScene } from '../types';

interface StorySceneArtProps {
  scene: StoryScene;
  storyId: number;
  compact?: boolean;
  onClick?: () => void;
}

interface SkyStyle {
  top: string;
  mid: string;
  bottom: string;
  isNight?: boolean;
  hasSun?: boolean;
  hasMoon?: boolean;
  ground1: string;
  ground2: string;
}

const BACKDROP_STYLES: Record<SceneBackdrop, SkyStyle> = {
  'forest-day': {
    top: '#60a5fa',
    mid: '#bae6fd',
    bottom: '#fef3c7',
    hasSun: true,
    ground1: '#22c55e',
    ground2: '#15803d',
  },
  'forest-dusk': {
    top: '#312e81',
    mid: '#7c3aed',
    bottom: '#fb923c',
    hasMoon: true,
    isNight: true,
    ground1: '#166534',
    ground2: '#14532d',
  },
  'forest-autumn': {
    top: '#f97316',
    mid: '#fdba74',
    bottom: '#fef3c7',
    hasSun: true,
    ground1: '#d97706',
    ground2: '#92400e',
  },
  'forest-night': {
    top: '#0f172a',
    mid: '#1e1b4b',
    bottom: '#312e81',
    hasMoon: true,
    isNight: true,
    ground1: '#064e3b',
    ground2: '#022c22',
  },
  'meadow-dawn': {
    top: '#f472b6',
    mid: '#fbcfe8',
    bottom: '#fef08a',
    hasSun: true,
    ground1: '#4ade80',
    ground2: '#16a34a',
  },
  'river-day': {
    top: '#38bdf8',
    mid: '#bae6fd',
    bottom: '#e0f2fe',
    hasSun: true,
    ground1: '#22c55e',
    ground2: '#0284c7',
  },
  'jungle-bright': {
    top: '#34d399',
    mid: '#a7f3d0',
    bottom: '#fef08a',
    hasSun: true,
    ground1: '#16a34a',
    ground2: '#065f46',
  },
  'ocean-reef': {
    top: '#06b6d4',
    mid: '#0284c7',
    bottom: '#0369a1',
    hasSun: true,
    ground1: '#0e7490',
    ground2: '#f59e0b',
  },
  'ocean-deep': {
    top: '#0c4a6e',
    mid: '#082f49',
    bottom: '#020617',
    isNight: true,
    ground1: '#0f172a',
    ground2: '#1e293b',
  },
  'ocean-surface': {
    top: '#38bdf8',
    mid: '#bae6fd',
    bottom: '#e0f2fe',
    hasSun: true,
    ground1: '#0284c7',
    ground2: '#0369a1',
  },
  'ocean-arctic': {
    top: '#7dd3fc',
    mid: '#e0f2fe',
    bottom: '#f8fafc',
    hasSun: true,
    ground1: '#0284c7',
    ground2: '#bae6fd',
  },
  'beach-sunny': {
    top: '#0ea5e9',
    mid: '#7dd3fc',
    bottom: '#fef08a',
    hasSun: true,
    ground1: '#0284c7',
    ground2: '#fde047',
  },
  'space-launch': {
    top: '#0f172a',
    mid: '#1d4ed8',
    bottom: '#fb923c',
    isNight: true,
    ground1: '#334155',
    ground2: '#1e293b',
  },
  'space-moon': {
    top: '#020617',
    mid: '#0f172a',
    bottom: '#1e293b',
    isNight: true,
    ground1: '#cbd5e1',
    ground2: '#94a3b8',
  },
  'space-cosmos': {
    top: '#09090b',
    mid: '#3b0764',
    bottom: '#1e1b4b',
    isNight: true,
    ground1: '#4c1d95',
    ground2: '#2e1065',
  },
  'space-mars': {
    top: '#1e1b4b',
    mid: '#7c2d12',
    bottom: '#ea580c',
    isNight: true,
    ground1: '#c2410c',
    ground2: '#9a3412',
  },
  'space-aurora': {
    top: '#020617',
    mid: '#064e3b',
    bottom: '#1e1b4b',
    isNight: true,
    hasMoon: true,
    ground1: '#e2e8f0',
    ground2: '#cbd5e1',
  },
  'weather-rain': {
    top: '#475569',
    mid: '#94a3b8',
    bottom: '#cbd5e1',
    ground1: '#15803d',
    ground2: '#0284c7',
  },
  'weather-snow': {
    top: '#93c5fd',
    mid: '#dbeafe',
    bottom: '#f8fafc',
    ground1: '#e0f2fe',
    ground2: '#f1f5f9',
  },
  'weather-storm': {
    top: '#1e293b',
    mid: '#475569',
    bottom: '#64748b',
    isNight: true,
    ground1: '#166534',
    ground2: '#14532d',
  },
  'earth-volcano': {
    top: '#7c2d12',
    mid: '#ea580c',
    bottom: '#fde047',
    ground1: '#57534e',
    ground2: '#292524',
  },
  'earth-canyon': {
    top: '#38bdf8',
    mid: '#fdba74',
    bottom: '#fed7aa',
    hasSun: true,
    ground1: '#c2410c',
    ground2: '#9a3412',
  },
  'earth-cave': {
    top: '#1e1b4b',
    mid: '#312e81',
    bottom: '#4c1d95',
    isNight: true,
    ground1: '#334155',
    ground2: '#1e293b',
  },
  'cozy-home': {
    top: '#fef3c7',
    mid: '#fde68a',
    bottom: '#fed7aa',
    hasSun: true,
    ground1: '#d97706',
    ground2: '#b45309',
  },
  'classroom-art': {
    top: '#fce7f3',
    mid: '#e0f2fe',
    bottom: '#fef9c3',
    hasSun: true,
    ground1: '#f59e0b',
    ground2: '#d97706',
  },
  'stage-lights': {
    top: '#312e81',
    mid: '#6d28d9',
    bottom: '#c026d3',
    isNight: true,
    ground1: '#92400e',
    ground2: '#78350f',
  },
  'park-sunny': {
    top: '#38bdf8',
    mid: '#bae6fd',
    bottom: '#fef9c3',
    hasSun: true,
    ground1: '#4ade80',
    ground2: '#22c55e',
  },
  'workshop-lab': {
    top: '#dbeafe',
    mid: '#e0e7ff',
    bottom: '#fef3c7',
    hasSun: true,
    ground1: '#b45309',
    ground2: '#78350f',
  },
  'dino-jungle': {
    top: '#f59e0b',
    mid: '#fde047',
    bottom: '#bbf7d0',
    hasSun: true,
    ground1: '#65a30d',
    ground2: '#3f6212',
  },
  'dino-cliff': {
    top: '#fb923c',
    mid: '#fed7aa',
    bottom: '#bae6fd',
    hasSun: true,
    ground1: '#0284c7',
    ground2: '#a16207',
  },
  'dino-ice': {
    top: '#60a5fa',
    mid: '#bfdbfe',
    bottom: '#f8fafc',
    hasSun: true,
    ground1: '#cbd5e1',
    ground2: '#94a3b8',
  },
  'fantasy-castle': {
    top: '#4f46e5',
    mid: '#a855f7',
    bottom: '#f9a8d4',
    hasMoon: true,
    isNight: true,
    ground1: '#10b981',
    ground2: '#059669',
  },
  'fantasy-garden': {
    top: '#c084fc',
    mid: '#f9a8d4',
    bottom: '#fef08a',
    hasSun: true,
    ground1: '#34d399',
    ground2: '#059669',
  },
  'fantasy-sky': {
    top: '#3b82f6',
    mid: '#c084fc',
    bottom: '#fbcfe8',
    hasSun: true,
    ground1: '#f8fafc',
    ground2: '#e0e7ff',
  },
  'mystery-attic': {
    top: '#451a03',
    mid: '#78350f',
    bottom: '#b45309',
    isNight: true,
    ground1: '#92400e',
    ground2: '#451a03',
  },
  'mystery-night': {
    top: '#0f172a',
    mid: '#1e293b',
    bottom: '#334155',
    hasMoon: true,
    isNight: true,
    ground1: '#1e293b',
    ground2: '#0f172a',
  },
  'festival-lanterns': {
    top: '#1e1b4b',
    mid: '#581c87',
    bottom: '#ea580c',
    hasMoon: true,
    isNight: true,
    ground1: '#0c4a6e',
    ground2: '#082f49',
  },
  'festival-day': {
    top: '#ec4899',
    mid: '#fb923c',
    bottom: '#fef08a',
    hasSun: true,
    ground1: '#22c55e',
    ground2: '#15803d',
  },
};

function renderScenery(backdrop: SceneBackdrop, style: SkyStyle, palette: [string, string, string]) {
  const [, mid, accent] = palette;

  if (backdrop.startsWith('space-')) {
    return (
      <>
        {backdrop === 'space-aurora' && (
          <g opacity="0.65">
            <path
              d="M -20 90 Q 90 20 190 70 T 420 45 L 420 110 Q 300 130 190 95 T -20 130 Z"
              fill="#34d399"
              opacity="0.55"
            />
            <path
              d="M -20 65 Q 110 10 220 55 T 420 30 L 420 85 Q 290 105 210 75 T -20 95 Z"
              fill="#a855f7"
              opacity="0.45"
            />
          </g>
        )}
        {/* Distant ringed planet */}
        <g transform="translate(325, 62)" opacity="0.88">
          <ellipse cx="0" cy="0" rx="44" ry="11" fill="none" stroke="#fde047" strokeWidth="4" opacity="0.7" transform="rotate(-14)" />
          <circle cx="0" cy="0" r="22" fill={accent || '#f59e0b'} />
          <path d="M -44 0 A 44 11 0 0 0 44 0" fill="none" stroke="#fef08a" strokeWidth="4" transform="rotate(-14)" />
        </g>
        {/* Planet surface curve */}
        <path d="M -20 215 Q 200 175 420 220 L 420 280 L -20 280 Z" fill={style.ground1} />
        <path d="M -20 238 Q 180 208 420 242 L 420 280 L -20 280 Z" fill={style.ground2} />
        {backdrop === 'space-moon' && (
          <g fill="#64748b" opacity="0.35">
            <ellipse cx="85" cy="236" rx="22" ry="7" />
            <ellipse cx="305" cy="242" rx="30" ry="9" />
            <ellipse cx="205" cy="222" rx="14" ry="5" />
          </g>
        )}
      </>
    );
  }

  if (backdrop.startsWith('ocean-') || backdrop === 'beach-sunny') {
    return (
      <>
        {/* Underwater caustic light beams */}
        {(backdrop === 'ocean-reef' || backdrop === 'ocean-deep') && (
          <g opacity={backdrop === 'ocean-deep' ? '0.12' : '0.24'}>
            <polygon points="60,0 130,0 90,260 20,260" fill="#ffffff" />
            <polygon points="180,0 245,0 280,260 190,260" fill="#ffffff" />
            <polygon points="310,0 365,0 390,260 320,260" fill="#ffffff" />
          </g>
        )}
        {/* Icebergs for arctic */}
        {backdrop === 'ocean-arctic' && (
          <g>
            <polygon points="15,195 65,110 120,195" fill="#ffffff" opacity="0.92" />
            <polygon points="65,110 120,195 88,195" fill="#bae6fd" opacity="0.8" />
            <polygon points="285,195 340,125 395,195" fill="#ffffff" opacity="0.9" />
          </g>
        )}
        {/* Rolling waves */}
        <path
          d="M -10 190 Q 45 174 100 190 T 210 190 T 320 190 T 430 190 L 430 280 L -10 280 Z"
          fill={style.ground1}
          opacity="0.9"
        />
        <path
          d="M -10 218 Q 55 202 120 218 T 250 218 T 380 218 T 440 218 L 440 280 L -10 280 Z"
          fill={style.ground2}
        />
        {/* Coral / kelp silhouettes */}
        {backdrop === 'ocean-reef' && (
          <g>
            <path d="M 35 260 Q 25 215 40 190 Q 50 210 48 260 Z" fill="#10b981" opacity="0.85" />
            <path d="M 55 260 Q 65 210 52 180 Q 75 200 70 260 Z" fill="#059669" opacity="0.85" />
            <circle cx="345" cy="238" r="22" fill="#f472b6" opacity="0.85" />
            <circle cx="368" cy="245" r="16" fill="#fb7185" opacity="0.85" />
            <circle cx="326" cy="248" r="14" fill="#fbbf24" opacity="0.85" />
          </g>
        )}
      </>
    );
  }

  if (backdrop === 'earth-volcano' || backdrop === 'dino-jungle') {
    return (
      <>
        <polygon points="230,210 315,72 405,210" fill="#57534e" />
        <polygon points="295,105 315,72 336,105 322,98 312,108 302,96" fill="#f97316" />
        <path d="M -20 205 Q 110 165 240 205 T 430 200 L 430 280 L -20 280 Z" fill={style.ground1} />
        <path d="M -20 232 Q 160 205 420 238 L 420 280 L -20 280 Z" fill={style.ground2} />
      </>
    );
  }

  if (backdrop === 'earth-canyon') {
    return (
      <>
        <polygon points="-10,220 20,115 95,115 125,220" fill="#ea580c" />
        <polygon points="285,220 315,98 390,98 420,220" fill="#c2410c" />
        <path d="M -20 218 Q 200 198 420 218 L 420 280 L -20 280 Z" fill={style.ground1} />
        <path d="M 145 215 Q 200 235 170 280 L 235 280 Q 255 235 235 215 Z" fill="#38bdf8" opacity="0.9" />
      </>
    );
  }

  if (backdrop === 'earth-cave') {
    return (
      <>
        {/* Stalactites hanging from ceiling */}
        <g fill="#4338ca" opacity="0.85">
          <polygon points="20,0 50,0 35,70" />
          <polygon points="75,0 98,0 86,48" />
          <polygon points="285,0 315,0 300,66" />
          <polygon points="340,0 385,0 362,88" />
        </g>
        {/* Glowing crystal clusters */}
        <g>
          <polygon points="40,255 58,192 78,255" fill="#c084fc" />
          <polygon points="64,255 78,210 94,255" fill="#e879f9" />
          <polygon points="315,255 338,185 362,255" fill="#38bdf8" />
          <polygon points="346,255 365,208 384,255" fill="#a855f7" />
        </g>
        <path d="M -10 238 Q 200 218 410 238 L 410 280 L -10 280 Z" fill={style.ground2} />
      </>
    );
  }

  if (backdrop === 'fantasy-castle') {
    return (
      <>
        {/* Fairytale Castle Silhouette */}
        <g transform="translate(270, 78)" opacity="0.85">
          <rect x="20" y="50" width="76" height="75" rx="4" fill="#e9d5ff" />
          <rect x="8" y="34" width="22" height="90" fill="#ddd6fe" />
          <rect x="84" y="34" width="22" height="90" fill="#ddd6fe" />
          <rect x="46" y="16" width="24" height="108" fill="#f3e8ff" />
          <polygon points="5,36 19,8 33,36" fill="#ec4899" />
          <polygon points="81,36 95,8 109,36" fill="#ec4899" />
          <polygon points="42,18 58,-12 74,18" fill="#f59e0b" />
          <path d="M 48 125 L 48 94 A 10 10 0 0 1 68 94 L 68 125 Z" fill="#6b21a8" />
        </g>
        <path d="M -20 202 Q 110 172 230 198 T 420 192 L 420 280 L -20 280 Z" fill={style.ground1} />
        <path d="M -20 230 Q 170 205 420 232 L 420 280 L -20 280 Z" fill={style.ground2} />
      </>
    );
  }

  if (
    backdrop === 'cozy-home' ||
    backdrop === 'classroom-art' ||
    backdrop === 'workshop-lab' ||
    backdrop === 'mystery-attic' ||
    backdrop === 'stage-lights'
  ) {
    return (
      <>
        {backdrop === 'stage-lights' ? (
          <g opacity="0.22">
            <polygon points="75,0 130,0 215,250 110,250" fill="#fde047" />
            <polygon points="275,0 330,0 295,250 190,250" fill="#38bdf8" />
          </g>
        ) : (
          /* Cozy arched window */
          <g transform="translate(286, 36)" opacity="0.72">
            <rect x="0" y="0" width="76" height="96" rx="38" fill="#e0f2fe" stroke="#ffffff" strokeWidth="6" />
            <line x1="38" y1="0" x2="38" y2="96" stroke="#ffffff" strokeWidth="5" />
            <line x1="0" y1="54" x2="76" y2="54" stroke="#ffffff" strokeWidth="5" />
          </g>
        )}
        {/* Warm wooden table / floor */}
        <rect x="0" y="198" width="400" height="82" fill={style.ground1} />
        <rect x="0" y="218" width="400" height="62" fill={style.ground2} />
        <line x1="0" y1="200" x2="400" y2="200" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" />
      </>
    );
  }

  // Default lush hills + trees / mountains / meadow / festival
  const hasTrees =
    backdrop.startsWith('forest-') ||
    backdrop === 'park-sunny' ||
    backdrop === 'meadow-dawn' ||
    backdrop === 'river-day' ||
    backdrop === 'jungle-bright';

  return (
    <>
      {/* Soft distant hills */}
      <path
        d="M -20 195 Q 95 135 205 182 T 420 170 L 420 280 L -20 280 Z"
        fill={mid || style.ground1}
        opacity="0.35"
      />
      {/* Rolling foreground hills */}
      <path
        d="M -20 205 Q 110 165 230 200 T 420 192 L 420 280 L -20 280 Z"
        fill={style.ground1}
      />
      <path
        d="M -20 232 Q 170 202 420 235 L 420 280 L -20 280 Z"
        fill={style.ground2}
      />
      {/* Winding storybook path */}
      {backdrop.startsWith('forest-') && (
        <path
          d="M 165 280 Q 190 240 205 225 T 235 198 L 248 198 Q 225 232 215 280 Z"
          fill="#fde68a"
          opacity="0.55"
        />
      )}
      {/* River ribbon */}
      {(backdrop === 'river-day' || backdrop === 'festival-lanterns') && (
        <path
          d="M -10 226 Q 115 206 230 224 T 420 220 L 420 280 L -10 280 Z"
          fill={backdrop === 'festival-lanterns' ? '#1e3a8a' : '#38bdf8'}
          opacity="0.88"
        />
      )}
      {/* Stylized layered trees */}
      {hasTrees && (
        <g opacity="0.85">
          <g transform="translate(38, 132)">
            <rect x="13" y="45" width="8" height="34" rx="3" fill="#78350f" />
            <circle cx="17" cy="36" r="24" fill={backdrop === 'forest-autumn' ? '#f97316' : '#15803d'} />
            <circle cx="8" cy="22" r="16" fill={backdrop === 'forest-autumn' ? '#facc15' : '#22c55e'} />
          </g>
          <g transform="translate(328, 126)">
            <rect x="15" y="48" width="9" height="36" rx="3" fill="#78350f" />
            <circle cx="19" cy="38" r="26" fill={backdrop === 'forest-autumn' ? '#ea580c' : '#166534'} />
            <circle cx="28" cy="24" r="17" fill={backdrop === 'forest-autumn' ? '#fbbf24' : '#22c55e'} />
          </g>
        </g>
      )}
    </>
  );
}

function renderEffect(effect: SceneEffect) {
  switch (effect) {
    case 'rainbow':
      return (
        <g opacity="0.78" fill="none" strokeWidth="7">
          <path d="M 35 190 A 165 140 0 0 1 365 190" stroke="#ef4444" />
          <path d="M 43 190 A 157 132 0 0 1 357 190" stroke="#f97316" />
          <path d="M 51 190 A 149 124 0 0 1 349 190" stroke="#facc15" />
          <path d="M 59 190 A 141 116 0 0 1 341 190" stroke="#22c55e" />
          <path d="M 67 190 A 133 108 0 0 1 333 190" stroke="#3b82f6" />
          <path d="M 75 190 A 125 100 0 0 1 325 190" stroke="#a855f7" />
        </g>
      );
    case 'fireflies':
    case 'sparkles':
    case 'embers': {
      const color = effect === 'embers' ? '#fb923c' : '#fef08a';
      return (
        <g className="scene-anim-twinkle">
          {[
            [58, 72, 4.5],
            [118, 44, 3.5],
            [276, 56, 5],
            [338, 108, 4],
            [92, 165, 3.5],
            [308, 178, 4.5],
            [160, 32, 3],
          ].map(([cx, cy, r], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r * 2.4} fill={color} opacity="0.28" />
              <circle cx={cx} cy={cy} r={r} fill="#ffffff" opacity="0.95" />
            </g>
          ))}
        </g>
      );
    }
    case 'bubbles':
      return (
        <g className="scene-anim-float" stroke="#ffffff" strokeWidth="2" fill="rgba(255,255,255,0.22)">
          <circle cx="64" cy="145" r="9" />
          <circle cx="78" cy="112" r="6" />
          <circle cx="332" cy="152" r="11" />
          <circle cx="318" cy="110" r="6" />
          <circle cx="145" cy="52" r="5" />
          <circle cx="255" cy="68" r="8" />
        </g>
      );
    case 'snow':
      return (
        <g className="scene-anim-float" fill="#ffffff" opacity="0.9">
          {[
            [45, 42, 4],
            [98, 86, 3.5],
            [155, 38, 4.5],
            [232, 64, 3.5],
            [295, 40, 4],
            [355, 92, 4.5],
            [72, 152, 3],
            [325, 162, 3.5],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case 'rain':
      return (
        <g stroke="#e0f2fe" strokeWidth="2.5" strokeLinecap="round" opacity="0.72">
          {[50, 95, 140, 185, 230, 275, 320, 360].map((x, i) => (
            <line key={i} x1={x} y1={32 + (i % 3) * 24} x2={x - 10} y2={62 + (i % 3) * 24} />
          ))}
          {[72, 125, 210, 295, 345].map((x, i) => (
            <line key={`b-${i}`} x1={x} y1={110 + (i % 2) * 25} x2={x - 10} y2={140 + (i % 2) * 25} />
          ))}
        </g>
      );
    case 'stars':
      return (
        <g className="scene-anim-twinkle" fill="#fef9c3">
          {[
            [48, 36, 3],
            [102, 64, 2.5],
            [168, 28, 3.5],
            [248, 46, 3],
            [302, 26, 2.5],
            [365, 58, 3.5],
            [76, 118, 2],
            [340, 128, 2.5],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case 'sunbeams':
      return (
        <g opacity="0.24" stroke="#fef08a" strokeWidth="6" strokeLinecap="round">
          <line x1="68" y1="48" x2="135" y2="128" />
          <line x1="68" y1="48" x2="175" y2="95" />
          <line x1="68" y1="48" x2="92" y2="148" />
        </g>
      );
    case 'wind':
      return (
        <g fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.68">
          <path d="M 30 78 Q 90 62 145 78 T 230 68" />
          <path d="M 190 120 Q 255 104 315 118 T 375 105" />
        </g>
      );
    case 'leaves':
    case 'petals': {
      const fills = effect === 'leaves' ? ['#f97316', '#facc15', '#ea580c'] : ['#f472b6', '#fbcfe8', '#fde047'];
      return (
        <g className="scene-anim-float">
          {[
            [68, 62, 22],
            [128, 108, -18],
            [282, 54, 34],
            [342, 116, -26],
            [92, 158, 12],
          ].map(([x, y, rot], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="8"
              ry="4.5"
              fill={fills[i % fills.length]}
              transform={`rotate(${rot} ${x} ${y})`}
              opacity="0.9"
            />
          ))}
        </g>
      );
    }
    case 'hearts':
      return (
        <g className="scene-anim-float" fontSize="18" opacity="0.88">
          <text x="56" y="68">💛</text>
          <text x="322" y="64">💖</text>
          <text x="90" y="162">✨</text>
          <text x="304" y="156">💛</text>
        </g>
      );
    case 'music':
      return (
        <g className="scene-anim-float" fontSize="20" opacity="0.88">
          <text x="58" y="72">🎵</text>
          <text x="315" y="66">🎶</text>
          <text x="95" y="148">🎼</text>
          <text x="325" y="146">🎵</text>
        </g>
      );
    case 'gears':
      return (
        <g className="scene-anim-float" fontSize="20" opacity="0.72">
          <text x="52" y="66">⚙️</text>
          <text x="322" y="74">🔧</text>
          <text x="72" y="158">✨</text>
          <text x="318" y="162">⚙️</text>
        </g>
      );
  }
}

export function StorySceneArt({ scene, storyId, compact = false, onClick }: StorySceneArtProps) {
  const uid = useId().replace(/:/g, '');
  const style = BACKDROP_STYLES[scene.backdrop] ?? BACKDROP_STYLES['forest-day'];

  // Deterministic slight position variation so every page feels freshly composed
  const shift = ((storyId + scene.pageNumber) % 3) - 1; // -1, 0, 1
  const heroX = 200 + shift * 8;
  const secondaryPositions: Array<[number, number]> = [
    [76, 186],
    [324, 186],
    [108, 108],
    [296, 104],
  ];

  return (
    <div
      className={`scene-art ${compact ? 'scene-art--compact' : ''} ${onClick ? 'scene-art--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label={scene.caption}
    >
      <svg
        viewBox="0 0 400 260"
        className="scene-art__svg"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={style.top} />
            <stop offset="55%" stopColor={style.mid} />
            <stop offset="100%" stopColor={style.bottom} />
          </linearGradient>
          <radialGradient id={`halo-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="55%" stopColor={scene.palette[2] || '#fef08a'} stopOpacity="0.32" />
            <stop offset="100%" stopColor={scene.palette[2] || '#fef08a'} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Painted Sky */}
        <rect x="0" y="0" width="400" height="260" fill={`url(#sky-${uid})`} />

        {/* Subtle Sun or Crescent Moon */}
        {style.hasSun && (
          <g transform="translate(68, 48)">
            <circle cx="0" cy="0" r="34" fill="#fef08a" opacity="0.32" />
            <circle cx="0" cy="0" r="22" fill="#fde047" />
          </g>
        )}
        {style.hasMoon && (
          <g transform="translate(66, 48)">
            <circle cx="0" cy="0" r="26" fill="#fef9c3" opacity="0.2" />
            <circle cx="0" cy="0" r="18" fill="#fef08a" />
            <circle cx="7" cy="-4" r="15" fill={style.top} />
          </g>
        )}

        {/* Fluffy Storybook Clouds (daytime/non-deep-space) */}
        {!style.isNight && !scene.backdrop.startsWith('ocean-reef') && (
          <g fill="#ffffff" opacity="0.72" className="scene-anim-drift">
            <g transform="translate(148, 42)">
              <circle cx="0" cy="8" r="14" />
              <circle cx="16" cy="2" r="18" />
              <circle cx="34" cy="8" r="14" />
            </g>
            <g transform="translate(295, 58) scale(0.8)">
              <circle cx="0" cy="8" r="14" />
              <circle cx="16" cy="2" r="18" />
              <circle cx="34" cy="8" r="14" />
            </g>
          </g>
        )}

        {/* Layered Landscape Scenery */}
        {renderScenery(scene.backdrop, style, scene.palette)}

        {/* Atmospheric Storybook Effect */}
        {renderEffect(scene.effect)}

        {/* Supporting Character / Prop Vignettes */}
        {scene.secondaryEmojis.slice(0, 4).map((emoji, idx) => {
          const [x, y] = secondaryPositions[idx];
          return (
            <g key={idx} transform={`translate(${x}, ${y})`} className="scene-anim-bob-slow">
              <circle cx="0" cy="0" r="23" fill="rgba(255,255,255,0.34)" />
              <text
                x="0"
                y="9"
                textAnchor="middle"
                fontSize="28"
                style={{ filter: 'drop-shadow(0 3px 4px rgba(15,23,42,0.22))' }}
              >
                {emoji}
              </text>
            </g>
          );
        })}

        {/* Central Hero Focal Illustration Medallion */}
        <g transform={`translate(${heroX}, 136)`} className="scene-anim-bob">
          <circle cx="0" cy="0" r="66" fill={`url(#halo-${uid})`} />
          <circle
            cx="0"
            cy="0"
            r="46"
            fill="rgba(255,255,255,0.82)"
            stroke={scene.palette[2] || '#facc15'}
            strokeWidth="4"
          />
          <text
            x="0"
            y="22"
            textAnchor="middle"
            fontSize="60"
            style={{ filter: 'drop-shadow(0 5px 8px rgba(15,23,42,0.22))' }}
          >
            {scene.heroEmoji}
          </text>
        </g>
      </svg>

      {!compact && (
        <div className="scene-art__overlay-badges">
          <span className="scene-art__page-pill">Page {scene.pageNumber} of 6</span>
        </div>
      )}
    </div>
  );
}
