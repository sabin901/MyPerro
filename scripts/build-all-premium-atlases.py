"""Rebuild every approved premium companion and its runtime fallback."""

from pathlib import Path
from shutil import copy2
from subprocess import run
import sys

ROOT = Path(__file__).resolve().parent.parent

for companion in sorted((ROOT / "art" / "premium").iterdir()):
    if not companion.is_dir():
        continue
    run([
        sys.executable,
        str(ROOT / "scripts" / "build-premium-atlas.py"),
        str(companion / "source.png"),
        str(ROOT / "art" / "exported" / companion.name),
    ], check=True)
    print(f"rebuilt {companion.name}")

fallback = ROOT / "art" / "placeholder"
fallback.mkdir(parents=True, exist_ok=True)
copy2(ROOT / "art" / "exported" / "shiba-inu" / "atlas.png", fallback / "shiba_placeholder.png")
copy2(ROOT / "art" / "exported" / "shiba-inu" / "atlas.json", fallback / "shiba_placeholder.json")
