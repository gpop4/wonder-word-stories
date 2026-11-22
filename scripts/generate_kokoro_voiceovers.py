#!/usr/bin/env python3
"""
Generate warm studio storybook voiceovers + vocabulary/question voiceovers
for all 100 Wonder Word Stories locally using Kokoro-82M (kokoro-onnx).

For every story, produces:
  1. public/audio/stories/story-XXX.m4a  (Title + 6 pages + ending, with per-page cue timestamps)
  2. public/audio/words/story-XXX-words.m4a  (All 10 vocab words + meanings + 3 comprehension questions, with exact per-word & per-question cue timestamps)

All paths and cue tables are written to public/audio/manifest.json.
With --push-each-world, automatically commits and pushes to GitHub (main)
as each World (10 stories + 10 word/question sprites) finishes!

Usage:
  /tmp/kokoro-venv/bin/python scripts/generate_kokoro_voiceovers.py --workers 2 --threads 3 --push-each-world
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
STORIES_AUDIO_DIR = PUBLIC_AUDIO_DIR / "stories"
WORDS_AUDIO_DIR = PUBLIC_AUDIO_DIR / "words"
CUES_CACHE_DIR = PUBLIC_AUDIO_DIR / ".cues_cache"
MANIFEST_PATH = PUBLIC_AUDIO_DIR / "manifest.json"

DEFAULT_INT8_MODEL_PATH = Path("/tmp/kokoro-models/kokoro-v1.0.int8.onnx")
DEFAULT_FP32_MODEL_PATH = Path("/tmp/kokoro-models/kokoro-v1.0.onnx")
DEFAULT_MODEL_PATH = (
    DEFAULT_INT8_MODEL_PATH if DEFAULT_INT8_MODEL_PATH.exists() else DEFAULT_FP32_MODEL_PATH
)
DEFAULT_VOICES_PATH = Path("/tmp/kokoro-models/voices-v1.0.bin")
DEFAULT_VOICE = "af_heart"
DEFAULT_SPEED = 0.88

KEEP_UPPER = {"USA", "UK", "TV", "AI"}
CAPS_WORD_RE = re.compile(r"\b[A-Z]{2,}\b")


def load_stories_from_ts() -> list[dict]:
    esbuild_bin = ROOT / "node_modules" / ".bin" / "esbuild"
    with tempfile.NamedTemporaryFile(suffix=".mjs", delete=False) as tmp:
        bundle_path = Path(tmp.name)
    try:
        subprocess.run(
            [
                str(esbuild_bin),
                str(ROOT / "src" / "data" / "stories.ts"),
                "--bundle",
                "--format=esm",
                f"--outfile={bundle_path}",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        res = subprocess.run(
            [
                "node",
                "-e",
                f"import('{bundle_path.as_uri()}').then(m => console.log(JSON.stringify(m.ALL_STORIES)))",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(res.stdout)
    finally:
        bundle_path.unlink(missing_ok=True)


def clean_text(text: str) -> str:
    text = (
        text.replace("**", "")
        .replace("—", ", ")
        .replace("–", ", ")
        .replace("’", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    text = CAPS_WORD_RE.sub(
        lambda m: m.group(0) if m.group(0) in KEEP_UPPER else m.group(0).lower(),
        text,
    )
    return re.sub(r"\s+", " ", text).strip()


def build_story_segments(story: dict) -> list[tuple[str, str]]:
    segs: list[tuple[str, str]] = [
        ("story-title", clean_text(f"Story number {story['id']}. {story['title']}."))
    ]
    for scene in story["scenes"]:
        segs.append((f"scene-{scene['pageNumber']}", clean_text(scene["text"])))
    segs.append(
        (
            "story-end",
            clean_text(
                "The end! Now let's explore the Word Treasure Chest and talk about three fun questions together!"
            ),
        )
    )
    return segs


def build_word_segments(story: dict) -> list[tuple[str, str]]:
    segs: list[tuple[str, str]] = []
    for w in story["words"]:
        word = w["word"]
        meaning = w["meaning"]
        segs.append((f"word-{word.lower()}", clean_text(f"{word}! {meaning}.")))
    q = story["questions"]
    segs.append(("question-recall", clean_text(q["recall"])))
    segs.append(("question-vocabulary", clean_text(q["vocabulary"])))
    segs.append(("question-connection", clean_text(q["connection"])))
    return segs


def samples_to_m4a(samples: np.ndarray, sample_rate: int, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = Path(tmp.name)

    try:
        sf.write(str(wav_path), samples, sample_rate, subtype="PCM_16")
        if Path("/usr/bin/afconvert").exists():
            subprocess.run(
                [
                    "/usr/bin/afconvert",
                    "-f",
                    "m4af",
                    "-d",
                    "aac",
                    "-b",
                    "32000",
                    str(wav_path),
                    str(out_path),
                ],
                check=True,
                capture_output=True,
            )
        elif shutil.which("ffmpeg"):
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    str(wav_path),
                    "-c:a",
                    "aac",
                    "-b:a",
                    "32k",
                    str(out_path),
                ],
                check=True,
                capture_output=True,
            )
        else:
            raise RuntimeError("Neither /usr/bin/afconvert nor ffmpeg found")
    finally:
        wav_path.unlink(missing_ok=True)


def synthesize_segments(
    kokoro: Kokoro,
    segments: list[tuple[str, str]],
    voice: str,
    speed: float,
    pause_sec: float = 0.48,
) -> tuple[np.ndarray, int, list[dict]]:
    chunks: list[np.ndarray] = []
    cues: list[dict] = []
    sr = 24000
    cursor_samples = 0

    for idx, (seg_id, seg_text) in enumerate(segments):
        audio, sr = kokoro.create(seg_text, voice=voice, speed=speed, lang="en-us")
        audio = audio.astype(np.float32)
        start_sec = round(cursor_samples / sr, 2)
        cursor_samples += len(audio)
        end_sec = round(cursor_samples / sr, 2)
        cues.append({"id": seg_id, "start": start_sec, "end": end_sec})
        chunks.append(audio)

        if idx < len(segments) - 1:
            pause_samples = int(sr * pause_sec)
            chunks.append(np.zeros(pause_samples, dtype=np.float32))
            cursor_samples += pause_samples

    full = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
    peak = float(np.max(np.abs(full)))
    if peak > 0:
        full = full * (0.9 / peak)
    return full, sr, cues


def load_existing_manifest() -> dict:
    if MANIFEST_PATH.exists():
        try:
            return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def write_manifest(stories: list[dict], voice: str) -> None:
    old = load_existing_manifest()
    existing_cues = old.get("cues", {}) or {}
    existing_word_cues = old.get("wordCues", {}) or {}

    stories_map: dict[str, str] = {}
    cues_map: dict[str, list[dict]] = {}
    word_audio_map: dict[str, str] = {}
    word_cues_map: dict[str, list[dict]] = {}

    for s in stories:
        slug = s["slug"]
        sf_path = STORIES_AUDIO_DIR / f"{slug}.m4a"
        if sf_path.exists() and sf_path.stat().st_size > 0:
            stories_map[slug] = f"audio/stories/{slug}.m4a"
            cue_file = CUES_CACHE_DIR / f"{slug}.json"
            if cue_file.exists():
                cues_map[slug] = json.loads(cue_file.read_text(encoding="utf-8"))
            elif slug in existing_cues:
                cues_map[slug] = existing_cues[slug]

        wf_path = WORDS_AUDIO_DIR / f"{slug}-words.m4a"
        if wf_path.exists() and wf_path.stat().st_size > 0:
            word_audio_map[slug] = f"audio/words/{slug}-words.m4a"
            wcue_file = CUES_CACHE_DIR / f"{slug}-words.json"
            if wcue_file.exists():
                word_cues_map[slug] = json.loads(wcue_file.read_text(encoding="utf-8"))
            elif slug in existing_word_cues:
                word_cues_map[slug] = existing_word_cues[slug]

    PUBLIC_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": "kokoro-v1.0",
        "voice": voice,
        "stories": stories_map,
        "cues": cues_map,
        "wordAudio": word_audio_map,
        "wordCues": word_cues_map,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Updated manifest.json: {len(stories_map)} stories, {len(word_audio_map)} word/question sprites.",
        flush=True,
    )


def git_push_world(world_num: int, story_range: tuple[int, int]) -> None:
    lo, hi = story_range
    try:
        subprocess.run(
            ["git", "add", "public/audio/stories", "public/audio/words", "public/audio/manifest.json"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        diff = subprocess.run(
            ["git", "diff", "--cached", "--quiet"],
            cwd=ROOT,
        )
        if diff.returncode == 0:
            print(f"  World {world_num} (#{lo}-{hi}) already committed; skipping push.", flush=True)
            return

        msg = f"Add Kokoro-82M story, word & question voiceovers for World {world_num} (Stories {lo}-{hi})"
        subprocess.run(["git", "commit", "-m", msg], cwd=ROOT, check=True, capture_output=True, text=True)
        subprocess.run(
            [
                "git",
                "-c",
                "http.postBuffer=524288000",
                "-c",
                "http.version=HTTP/1.1",
                "push",
                "origin",
                "main",
            ],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        print(f"🚀 Pushed World {world_num} (Stories #{lo}-#{hi}) to GitHub Pages!", flush=True)
    except subprocess.CalledProcessError as exc:
        print(f"⚠️ Git push warning for World {world_num}: {exc.stderr or exc.stdout}", flush=True)


_WORKER_KOKORO: Kokoro | None = None


def _init_worker(model_path: str, voices_path: str, threads: int) -> None:
    global _WORKER_KOKORO
    os.environ["OMP_NUM_THREADS"] = str(threads)
    os.environ["OPENBLAS_NUM_THREADS"] = str(threads)
    os.environ["MKL_NUM_THREADS"] = str(threads)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess = ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])
    _WORKER_KOKORO = Kokoro.from_session(sess, voices_path)


def _worker_job(
    task: tuple[str, str, list[tuple[str, str]], str, str, str, float],
) -> tuple[str, str, float, float, float]:
    kind, slug, segments, out_str, cue_str, voice, speed = task
    t0 = time.time()
    assert _WORKER_KOKORO is not None
    pause = 0.55 if kind == "story" else 0.42
    samples, sr, cues = synthesize_segments(
        _WORKER_KOKORO, segments, voice=voice, speed=speed, pause_sec=pause
    )
    out_path = Path(out_str)
    samples_to_m4a(samples, sr, out_path)
    cue_path = Path(cue_str)
    cue_path.parent.mkdir(parents=True, exist_ok=True)
    cue_path.write_text(json.dumps(cues), encoding="utf-8")
    dur = len(samples) / sr
    kb = out_path.stat().st_size / 1024
    return kind, slug, dur, kb, time.time() - t0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Wonder Word Stories voiceovers with Kokoro-82M")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--voices", type=Path, default=DEFAULT_VOICES_PATH)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--threads", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--push-each-world", action="store_true")
    parser.add_argument("--worlds", default="1-10", help="World range, e.g. 1-10 or 1-2")
    args = parser.parse_args()

    lo_w, hi_w = (int(x) for x in args.worlds.split("-")) if "-" in args.worlds else (int(args.worlds), int(args.worlds))

    stories = load_stories_from_ts()
    existing_manifest = load_existing_manifest()
    existing_story_cues = existing_manifest.get("cues", {}) or {}
    existing_word_cues = existing_manifest.get("wordCues", {}) or {}

    t_all = time.time()
    print(
        f"Loaded {len(stories)} stories. Processing Worlds {lo_w}..{hi_w} with Kokoro-82M "
        f"(model={args.model.name}, voice={args.voice}, workers={args.workers}, threads={args.threads})...",
        flush=True,
    )

    with concurrent.futures.ProcessPoolExecutor(
        max_workers=args.workers,
        initializer=_init_worker,
        initargs=(str(args.model), str(args.voices), args.threads),
    ) as ex:
        for world_num in range(lo_w, hi_w + 1):
            start_id = (world_num - 1) * 10 + 1
            end_id = world_num * 10
            world_stories = [s for s in stories if start_id <= s["id"] <= end_id]

            tasks = []
            for s in world_stories:
                slug = s["slug"]
                s_out = STORIES_AUDIO_DIR / f"{slug}.m4a"
                s_cue = CUES_CACHE_DIR / f"{slug}.json"
                has_story_cue = s_cue.exists() or slug in existing_story_cues
                if args.force or not (s_out.exists() and s_out.stat().st_size > 0 and has_story_cue):
                    tasks.append(
                        ("story", slug, build_story_segments(s), str(s_out), str(s_cue), args.voice, args.speed)
                    )

                w_out = WORDS_AUDIO_DIR / f"{slug}-words.m4a"
                w_cue = CUES_CACHE_DIR / f"{slug}-words.json"
                has_word_cue = w_cue.exists() or slug in existing_word_cues
                if args.force or not (w_out.exists() and w_out.stat().st_size > 0 and has_word_cue):
                    tasks.append(
                        ("words", slug, build_word_segments(s), str(w_out), str(w_cue), args.voice, args.speed)
                    )

            print(
                f"\n=== World {world_num} (Stories #{start_id}-#{end_id}): {len(tasks)} audio clip(s) to generate ===",
                flush=True,
            )

            if tasks:
                done = 0
                futures = [ex.submit(_worker_job, task) for task in tasks]
                for fut in concurrent.futures.as_completed(futures):
                    kind, slug, dur, kb, elapsed = fut.result()
                    done += 1
                    label = f"{slug}.m4a" if kind == "story" else f"{slug}-words.m4a"
                    print(
                        f"  [W{world_num} {done}/{len(tasks)}] ✓ {label} ({dur:.1f}s, {kb:.0f} KB in {elapsed:.1f}s)",
                        flush=True,
                    )
                    write_manifest(stories, args.voice)

            write_manifest(stories, args.voice)
            if args.push_each_world:
                git_push_world(world_num, (start_id, end_id))

    print(f"\nAll requested worlds finished in {time.time() - t_all:.1f}s!", flush=True)


if __name__ == "__main__":
    main()
