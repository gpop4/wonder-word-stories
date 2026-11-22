# 📖 Wonder Word Stories — 100 Illustrated Adventures & 1,000 Words

An interactive, kid-friendly illustrated storybook web application crafted for curious 5-to-7-year-old readers learning **1,000 rich vocabulary words** across **100 full 6-page illustrated stories** — built in the same joyful, playful spirit as [Wild World Map](https://github.com/gpop4/wild-world-map).

## ✨ Features

- **100 Dedicated Story Page Tabs (`#story-001` – `#story-100`):**
  - Every story has its own dedicated page tab with a scrollable story tab strip (filterable by World or viewing All 100 Tabs), direct URL hash links, and keyboard arrow navigation (`←` / `→`).
- **Intermixed Story Text & Custom Visuals:**
  - Each story unfolds across **6 illustrated storybook spreads** where alternating colorful layered artwork and cozy large-print storybook text flow together side-by-side.
  - Tap any illustration's **Big Picture** button to inspect it in a full-screen storybook lightbox.
- **Interactive 1,000-Word Learning System:**
  - Every story weaves **10 target vocabulary words** directly into the narrative as glowing clickable word chips.
  - Tap any highlighted word in the text (or in the **Word Treasure Chest**) to open its child-friendly definition card, hear it pronounced aloud, and unlock it in your Explorer Progress Passport!
- **Read-Aloud Studio Mode (AI Voice + Web Speech Fallback):**
  - **Read Whole Story** plays warm, expressive pre-generated Kokoro-82M studio narration (or falls back smoothly to Web Speech API).
  - **Play / Pause / Stop**, speed presets (🐢 Slow / 🦊 Normal / 🐆 Fast), **Auto-Read ON/OFF**, per-page **Hear Page** buttons, and tap-to-hear vocabulary & comprehension questions.
- **Story Explorer Comprehension Check:**
  - Every story finishes with **3 tailored comprehension questions** (🔍 Story Recall, 💬 Vocabulary in Context, 🌟 Creative Connection) with audio playback and interactive discussion checkmarks.
- **10 Watercolor Story Worlds & 1,000-Word Treasure Chest:**
  - Browse all 10 illustrated Worlds, jump to a **🎲 Surprise Story**, search any story title or any of the 1,000 vocabulary words, and track completed stories (`⭐ X/100`) and unlocked words (`💎 Y/1,000`) automatically in `localStorage`.
- **Parent Bonus:** Collapsible 1-click copy box for each story's original Gemini Storybook Gem prompt.

---

## 🛠️ Setup & Local Execution

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ and `npm`

### 1. Install Dependencies
```bash
cd /Users/madhu/adyu-projects/wonder-word-stories
npm install
```

### 2. Run Locally (Development Server)
```bash
npm run dev
```
Open the local URL printed in the terminal (typically `http://localhost:5173`) in your browser.

### 3. Pre-Generate Studio AI Voiceovers (Optional — Zero Runtime API Calls)
Pre-generated `.m4a` studio narrations live in `public/audio/stories/` and are indexed by `public/audio/manifest.json`. To regenerate or add voiceovers locally with Kokoro-82M (open-source, free, no API key required):
```bash
/tmp/kokoro-venv/bin/python scripts/generate_kokoro_voiceovers.py --workers 4
```
The script automatically skips existing clips and updates `public/audio/manifest.json`. If no studio audio clip is present for a story, the app automatically falls back to the browser's built-in Web Speech API.

### 4. Build for Production (Static Website)
```bash
npm run build
```
This outputs a standalone static website in `dist/` ready for GitHub Pages, Firebase Hosting, Netlify, or Vercel.

To preview the production build locally:
```bash
npm run preview
```

---

## 🚀 Hosting on GitHub Pages

This repository includes `.github/workflows/deploy.yml`, which automatically builds and deploys `dist/` to GitHub Pages on every push to `main`:
- Live site: `https://gpop4.github.io/wonder-word-stories/`
- Repository: `https://github.com/gpop4/wonder-word-stories`

---

## 🧹 Clean Up

To remove local build artifacts and installed dependencies:
```bash
rm -rf /Users/madhu/adyu-projects/wonder-word-stories/dist /Users/madhu/adyu-projects/wonder-word-stories/node_modules
```

To reset saved story stars and unlocked vocabulary words in your browser, clear `localStorage` for the site in your browser settings.
