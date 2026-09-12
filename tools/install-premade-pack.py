#!/usr/bin/env python3
"""Install the locked AXM v0.11 premade visual pack into a repo checkout.

Stdlib only. No network. It verifies the archive SHA-256 and then copies each
runtime WebP to the manifest-declared category path. Source PNGs may optionally
be retained under assets/premade/v0.11/source-png/.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACK_DIR = ROOT / "assets" / "premade" / "v0.11"
MANIFEST_PATH = PACK_DIR / "manifest.json"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("archive", type=Path)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument("--keep-source-png", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text("utf-8"))
    expected_archive = manifest["binaryPack"]["sha256"]
    observed_archive = sha256_file(args.archive)
    if observed_archive != expected_archive:
        print(json.dumps({
            "ok": False,
            "reason": "archive-sha256-mismatch",
            "expected": expected_archive,
            "observed": observed_archive,
        }, indent=2))
        return 2

    with zipfile.ZipFile(args.archive) as zf:
        names = zf.namelist()
        runtimes = {Path(name).name: name for name in names if "/runtime-webp/" in name and name.endswith(".webp")}
        sources = {Path(name).name: name for name in names if "/source-png/" in name and name.endswith(".png")}
        if len(runtimes) != manifest["binaryPack"]["runtimeWebpCount"]:
            print(json.dumps({"ok": False, "reason": "runtime-count-mismatch", "observed": len(runtimes)}, indent=2))
            return 2
        if len(sources) != manifest["binaryPack"]["sourcePngCount"]:
            print(json.dumps({"ok": False, "reason": "source-count-mismatch", "observed": len(sources)}, indent=2))
            return 2

        installed = []
        for asset in manifest["assets"]:
            member = runtimes.get(asset["file"])
            if not member:
                print(json.dumps({"ok": False, "reason": "missing-runtime", "asset": asset["id"]}, indent=2))
                return 2
            if not args.verify_only:
                target = PACK_DIR / asset["category"] / asset["file"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(zf.read(member))
                installed.append(str(target.relative_to(ROOT)))

        source_installed = 0
        if args.keep_source_png and not args.verify_only:
            target_dir = PACK_DIR / "source-png"
            target_dir.mkdir(parents=True, exist_ok=True)
            for basename, member in sorted(sources.items()):
                (target_dir / basename).write_bytes(zf.read(member))
                source_installed += 1

    print(json.dumps({
        "ok": True,
        "archiveSha256": observed_archive,
        "verifyOnly": args.verify_only,
        "runtimeInstalled": len(installed),
        "sourcePngInstalled": source_installed,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
