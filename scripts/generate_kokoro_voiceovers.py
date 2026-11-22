#!/usr/bin/env python3
"""
Generate warm studio storybook voiceovers for all 100 Wonder Word Stories
locally using Kokoro-82M (kokoro-onnx), with zero API keys or runtime costs.

Also records exact per-page audio cue timestamps (start/end seconds) in
public/audio/manifest.json so the web app can:
  1. Live-highlight each illustrated page as Kokoro reads the full story.
  2. Play any individual page ("Hear Page") directly in Kokoro's studio voice.

Usage:
  /tmp/kokoro-venv/bin/python scripts/generate_kokoro_voiceovers.py --workers 4
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
                    "36k",
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
    pause_sec: float = 0.55,
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


def write_manifest(stories: list[dict], voice: str) -> None:
    stories_map: dict[str, str] = {}
    cues_map: dict[str, list[dict]] = {}

    # Preserve existing cues from manifest if cache was cleaned
    existing_cues: dict[str, list[dict]] = {}
    if MANIFEST_PATH.exists():
        try:
            old = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
            existing_cues = old.get("cues", {}) or {}
        except Exception:
            existing_cues = {}

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

    PUBLIC_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": "kokoro-v1.0",
        "voice": voice,
        "stories": stories_map,
        "cues": cues_map,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        f"Updated {MANIFEST_PATH.relative_to(ROOT)}: "
        f"{len(stories_map)} stories, {len(cues_map)} cue tables.",
        flush=True,
    )


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
    task: tuple[str, list[tuple[str, str]], str, str, str, float],
) -> tuple[str, float, float, float]:
    slug, segments, out_str, cue_str, voice, speed = task
    t0 = time.time()
    assert _WORKER_KOKORO is not None
    samples, sr, cues = synthesize_segments(_WORKER_KOKORO, segments, voice=voice, speed=speed)
    out_path = Path(out_str)
    samples_to_m4a(samples, sr, out_path)
    cue_path = Path(cue_str)
    cue_path.parent.mkdir(parents=True, exist_ok=True)
    cue_path.write_text(json.dumps(cues), encoding="utf-8")
    dur = len(samples) / sr
    kb = out_path.stat().st_size / 1024
    return slug, dur, kb, time.time() - t0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Wonder Word Stories voiceovers with Kokoro-82M")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH)
    parser.add_argument("--voices", type=Path, default=DEFAULT_VOICES_PATH)
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--threads", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    stories = load_stories_from_ts()
    tasks = []
    for s in stories:
        slug = s["slug"]
        out_path = STORIES_AUDIO_DIR / f"{slug}.m4a"
        cue_path = CUES_CACHE_DIR / f"{slug}.json"
        if not args.force and out_path.exists() and out_path.stat().st_size > 0 and cue_path.exists():
            continue
        tasks.append(
            (slug, build_story_segments(s), str(out_path), str(cue_path), args.voice, args.speed)
        )

    if args.limit > 0:
        tasks = tasks[: args.limit]

    print(
        f"Loaded {len(stories)} stories. Generating {len(tasks)} Kokoro-82M studio voiceovers "
        f"(voice={args.voice}, speed={args.speed}, workers={args.workers}, threads={args.threads})...",
        flush=True,
    )

    if not tasks:
        write_manifest(stories, args.voice)
        return

    t_start = time.time()
    done = 0

    if args.workers <= 1:
        _init_worker(str(args.model), str(args.voices), args.threads)
        for task in tasks:
            slug, dur, kb, elapsed = _worker_job(task)
            done += 1
            print(f"  [{done}/{len(tasks)}] ✓ {slug}.m4a ({dur:.1f}s, {kb:.0f} KB in {elapsed:.1f}s)", flush=True)
            if done % 5 == 0:
                write_manifest(stories, args.voice)
    else:
        with concurrent.futures.ProcessPoolExecutor(
            max_workers=args.workers,
            initializer=_init_worker,
            initargs=(str(args.model), str(args.voices), args.threads),
        ) as ex:
            futures = [ex.submit(_worker_job, task) for task in tasks]
            for fut in concurrent.futures.as_completed(futures):
                slug, dur, kb, elapsed = fut.result()
                done += 1
                print(
                    f"  [{done}/{len(tasks)}] ✓ {slug}.m4a ({dur:.1f}s, {kb:.0f} KB in {elapsed:.1f}s)",
                    flush=True,
                )
                write_manifest(stories, args.voice)

    write_manifest(stories, args.voice)
    if len(list(STORIES_AUDIO_DIR.glob("*.m4a"))) >= len(stories):
        shutil.rmtree(CUES_CACHE_DIR, ignore_errors=True)
    print(f"\nDone! Generated {len(tasks)} story voiceovers in {time.time() - t_start:.1f}s.", flush=True)


if __name__ == "__main__":
    main()
