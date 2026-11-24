"""Prepare the static workshop site. Uses only the Python 3 standard library."""

import argparse
import gzip
import hashlib
import http.client
import json
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "dist" / "engine"
EXAMPLES = ROOT / "dist" / "examples"
FIXTURES = ROOT / "fixtures"
BLOCK = 1024 * 1024
PART_SIZE = 8 * BLOCK


def update_hash(digest, path):
    with path.open("rb") as source:
        for block in iter(lambda: source.read(BLOCK), b""):
            digest.update(block)


def matches(path, expected):
    if not path.is_file():
        return False
    digest = hashlib.sha256()
    update_hash(digest, path)
    return digest.hexdigest() == expected


def prepare_examples():
    records = json.loads((EXAMPLES / "index.json").read_text(encoding="utf-8"))
    with tempfile.TemporaryDirectory(dir=EXAMPLES) as tmp:
        for record in records:
            name = Path(record["outputFile"]).name
            target = EXAMPLES / name
            if matches(target, record["outputSha256"]):
                continue
            staged = Path(tmp) / name
            with gzip.open(FIXTURES / (name + ".gz"), "rb") as src, staged.open("wb") as dst:
                shutil.copyfileobj(src, dst, BLOCK)
            if not matches(staged, record["outputSha256"]):
                raise ValueError("Recorded output checksum mismatch: " + name)
            staged.replace(target)
    print("Recorded examples ready (SHA-256 verified).", flush=True)


def wine_ready(parts, expected):
    digest = hashlib.sha256()
    for path, size in parts:
        if not path.is_file() or path.stat().st_size != size:
            return False
        update_hash(digest, path)
    return digest.hexdigest() == expected


def prepare_wine(archive):
    manifest = json.loads((ENGINE / "manifest.json").read_text(encoding="utf-8"))
    app = ENGINE / "energyplan.zip"
    if not matches(app, manifest["appSha256"]):
        raise ValueError("Tracked EnergyPLAN archive missing or changed. Restore dist/engine/energyplan.zip from Git.")
    expected_size = manifest["totalBytes"] - app.stat().st_size
    names = manifest["rootParts"]
    sizes = [min(PART_SIZE, expected_size - off) for off in range(0, expected_size, PART_SIZE)]
    if names != ["root-%02d.bin" % i for i in range(len(sizes))]:
        raise ValueError("Unexpected filesystem part list in the manifest.")
    parts = list(zip([ENGINE / name for name in names], sizes))
    if wine_ready(parts, manifest["rootSha256"]):
        print("Wine filesystem ready (SHA-256 verified); no download needed.")
        return

    if archive is None:
        url = manifest["rootSource"]
        print("Downloading %.1f MB from %s" % (expected_size / 1_000_000, url), flush=True)
        source = urllib.request.urlopen(url, timeout=60)
    else:
        print("Using local Wine archive:", archive, flush=True)
        source = archive.open("rb")

    # Stage all parts and verify the complete upstream archive before installing any part.
    with source, tempfile.TemporaryDirectory(dir=ENGINE) as tmp:
        digest = hashlib.sha256()
        for path, size in parts:
            remaining = size
            with (Path(tmp) / path.name).open("wb") as dst:
                while remaining:
                    block = source.read(min(BLOCK, remaining))
                    if not block:
                        raise ValueError("Wine archive ended early; no downloaded parts installed.")
                    digest.update(block)
                    dst.write(block)
                    remaining -= len(block)
        if source.read(1) or digest.hexdigest() != manifest["rootSha256"]:
            raise ValueError("Wine archive size or checksum mismatch; no downloaded parts installed.")
        for path, _ in parts:
            (Path(tmp) / path.name).replace(path)
    print("Wine filesystem ready (%d parts, SHA-256 verified)." % len(parts))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--examples-only", action="store_true", help="prepare recorded examples offline; skip Wine")
    mode.add_argument("--wine-archive", type=Path, metavar="FILE", help="use an existing copy of the pinned Wine ZIP")
    args = parser.parse_args()
    prepare_examples()
    if not args.examples_only:
        prepare_wine(args.wine_archive)


if __name__ == "__main__":
    try:
        main()
    except (OSError, EOFError, ValueError, http.client.HTTPException) as error:
        sys.exit("Setup failed: %s" % error)
