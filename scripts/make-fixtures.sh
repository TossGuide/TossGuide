#!/usr/bin/env bash
# Turn fixture photos into fake-camera videos for Playwright (Chromium's
# --use-file-for-fake-video-capture needs .y4m or .mjpeg). The .y4m files are large,
# so they're gitignored and rebuilt on demand (tests/e2e/global-setup.ts calls this).
#
#   scripts/make-fixtures.sh            # all tests/fixtures/*.jpg
# Requires ffmpeg (sudo apt install ffmpeg / brew install ffmpeg).
set -euo pipefail
cd "$(dirname "$0")/../tests/fixtures"
for img in *.jpg; do
  out="${img%.jpg}.y4m"
  [ -f "$out" ] && [ "$out" -nt "$img" ] && continue
  # 640x480 like a webcam, 2 s at 10 fps (Chromium loops it), letterboxed to keep the aspect ratio.
  ffmpeg -loglevel error -y -loop 1 -i "$img" -t 2 -r 10 \
    -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
    "$out"
  echo "made $out"
done
