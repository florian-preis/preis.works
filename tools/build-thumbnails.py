#!/usr/bin/env python3
"""
Generate WebP thumbnails for the photo gallery.

Reads  : photography/*.jpg
Writes : <dest>/photography/thumb/<same name>.webp

The thumbnails are built into the published site only. They are never committed
to the repository, so adding a photo never adds a second file to keep track of
and the repository does not grow beyond the originals.

Run by .github/workflows/deploy.yml straight after Jekyll builds, so that the
output lands inside _site alongside the pages.

Usage: python3 tools/build-thumbnails.py [destination]   (default: _site)
"""

import os
import sys
from PIL import Image, ImageOps

SOURCE_DIR = "photography"
THUMB_WIDTH = 600
THUMB_QUALITY = 78
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}


def main(destination):
    if not os.path.isdir(SOURCE_DIR):
        sys.exit(f"ERROR: source folder '{SOURCE_DIR}' not found. "
                 f"Run this from the repository root.")

    output_dir = os.path.join(destination, SOURCE_DIR, "thumb")
    os.makedirs(output_dir, exist_ok=True)

    sources = []
    skipped = []
    for name in sorted(os.listdir(SOURCE_DIR)):
        if os.path.splitext(name)[1] in IMAGE_EXTENSIONS:
            sources.append(name)
        else:
            skipped.append(name)

    written = 0
    total_in = 0
    total_out = 0

    for name in sources:
        stem = os.path.splitext(name)[0]
        source_path = os.path.join(SOURCE_DIR, name)
        target_path = os.path.join(output_dir, stem + ".webp")
        try:
            with Image.open(source_path) as im:
                im = ImageOps.exif_transpose(im).convert("RGB")
                height = round(im.height * THUMB_WIDTH / im.width)
                im.resize((THUMB_WIDTH, height), Image.LANCZOS).save(
                    target_path, "WEBP", quality=THUMB_QUALITY, method=5
                )
        except Exception as error:
            sys.exit(f"ERROR while processing '{name}': {error}")

        written += 1
        total_in += os.path.getsize(source_path)
        total_out += os.path.getsize(target_path)

    # Guard rails. If these fail we stop the build rather than publish a gallery
    # of broken images. A failed build leaves the previous site live.
    if not sources:
        sys.exit(f"ERROR: no images found in '{SOURCE_DIR}'. "
                 f"Refusing to publish an empty gallery.")
    if written != len(sources):
        sys.exit(f"ERROR: {len(sources)} images found but only {written} "
                 f"thumbnails written. Refusing to publish a partial gallery.")

    saving = (1 - total_out / total_in) * 100 if total_in else 0
    print(f"thumbnails written : {written}")
    print(f"originals          : {total_in / 1e6:.1f} MB")
    print(f"thumbnails         : {total_out / 1e6:.2f} MB  ({saving:.0f}% smaller)")
    if skipped:
        print(f"non-image files skipped: {len(skipped)} ({', '.join(skipped[:5])})")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "_site")
