#!/usr/bin/env python3
"""
Generate warm studio storybook voiceovers for all 100 Wonder Word Stories
locally using Kokoro-82M (kokoro-onnx), with zero API keys or runtime costs.

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
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
STORIES_AUDIO_DIR = PUBLIC_AUDIO_DIR / "stories"
MANIFEST_PATH = PUBLIC_AUDIO_DIR / "manifest.json"

DEFAULT_MODEL_PATH = Path("/tmp/kokoro-models/kokoro-v1.0.onnx")
DEFAULT_VOICES_PATH = Path("/tmp/kokoro-models/voices-v1.0.bin")
DEFAULT_VOICE = "af_heart"
DEFAULT_SPEED = 0.88


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
    return re.sub(r"\s+", " ", text).strip()


def build_story_segments(story: dict) -> list[str]:
    segs = [clean_text(f"Story number {story['id']}. {story['title']}.")]
    for scene in story["scenes"]:
        segs.append(clean_text(scene["text"]))
    segs.append(clean_text("The end! Now let's explore the Word Treasure Chest and answer three fun questions together!"))
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
                    "36000",
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
    kokoro: Kokoro, segments: list[str], voice: str, speed: float, pause_sec: float = 0.55
) -> tuple[np.ndarray, int]:
    chunks: list[np.ndarray] = []
    sr = 24000
    for idx, seg in enumerate(segments):
        audio, sr = kokoro.create(seg, voice=voice, speed=speed, lang="en-us")
        chunks.append(audio.astype(np.float32))
        if idx < len(segments) - 1:
            chunks.append(np.zeros(int(sr * pause_sec), dtype=np.float32))

    full = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)
    peak = float(np.max(np.abs(full)))
    if peak > 0:
        full = full * (0.9 / peak)
    return full, sr


def write_manifest(stories: list[dict], voice: str) -> None:
    stories_map = {}
    for s in stories:
        sf_path = STORIES_AUDIO_DIR / f"{s['slug']}.m4a"
        if sf_path.exists() and sf_path.stat().st_size > 0:
            stories_map[s["slug"]] = f"audio/stories/{s['slug']}.m4a"

    PUBLIC_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": "kokoro-v1.0",
        "voice": voice,
        "stories": stories_map,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {MANIFEST_PATH.relative_to(ROOT)}: {len(stories_map)} stories.")


_WORKER_KOKORO: Kokoro | None = None


def _init_worker(model_path: str, voices_path: str) -> None:
    global _WORKER_KOKORO
    _WORKER_KOKORO = Kokoro(model_path, voices_path)


def _worker_job(task: tuple[str, list[str], str, str, float]) -> tuple[str, int, float]:
    slug, segments, out_str, voice, speed = task
    t0 = time.time()
    assert _WORKER_KOKORO is not None
    samples, sr = synthesize_segments(_WORKER_KOKORO, segments, voice=voice, speed=speed)
    out_path = Path(out_str)
    samples_to_m4a(samples, sr, out_path)
    return slug, out_path.stat().st_size, time.time() - t0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default=DEFAULT_VOICE)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()

    stories = load_stories_from_ts()
    tasks = []
    for s in stories:
        out_path = STORIES_AUDIO_DIR / f"{s['slug']}.m4a"
        if not args.force and out_path.exists() and out_path.stat().st_size > 0:
            continue
        tasks.append((s["slug"], build_story_segments(s), str(out_path), args.voice, args.speed))

    if args.limit > 0:
        tasks = tasks[: args.limit]

    print(f"Generating {len(tasks)} story voiceovers using Kokoro ({args.voice}) with {args.workers} workers...")
    if not tasks:
        write_manifest(stories, args.voice)
        return

    t_start = time.time()
    done = 0
    with concurrent.futures.ProcessPoolExecutor(
        max_workers=args.workers,
        initializer=_init_worker,
        initargs=(str(DEFAULT_MODEL_PATH), str(DEFAULT_VOICES_PATH)),
    ) as ex:
        for slug, size, elapsed in ex.map(_worker_job, tasks):
            done += 1
            if done <= 5 or done % 10 == 0 or done == len(tasks):
                print(f"[{done}/{len(tasks)}] {slug}.m4a ({size/1024:.0f} KB, {elapsed:.1f}s)", flush=True)

    write_manifest(stories, args.voice)
    print(f"Done in {time.time() - t_start:.1f}s!")


if __name__ == "__main__":
    main()
