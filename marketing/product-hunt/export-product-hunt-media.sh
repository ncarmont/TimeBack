#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HTML_FILE="$ROOT_DIR/marketing/product-hunt/slides.html"
OUT_DIR="$ROOT_DIR/public/product-hunt"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
GALLERY_WIDTH="${GALLERY_WIDTH:-1270}"
GALLERY_HEIGHT="${GALLERY_HEIGHT:-760}"
ICON_SIZE="${ICON_SIZE:-240}"

if [ ! -x "$CHROME" ]; then
  echo "Chrome not found at: $CHROME" >&2
  echo "Set CHROME=/path/to/chrome and rerun." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

export_asset() {
  local url="$1"
  local out="$2"
  local width="$3"
  local height="$4"
  local profile="$5"

  rm -rf "$profile"
  rm -f "$out"
  "$CHROME" \
    --headless=new \
    --disable-gpu \
    --hide-scrollbars \
    --force-device-scale-factor=1 \
    --window-size="${width},${height}" \
    --virtual-time-budget=1000 \
    --disable-background-networking \
    --no-first-run \
    --user-data-dir="$profile" \
    --screenshot="$out" \
    "$url" >/tmp/timeback-product-hunt-export.log 2>&1 &

  local pid=$!
  local count=0
  while [ ! -s "$out" ] && [ "$count" -lt 80 ]; do
    sleep 0.25
    count=$((count + 1))
  done

  sleep 0.25
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true

  if [ ! -s "$out" ]; then
    echo "Failed to export $out from $url" >&2
    cat /tmp/timeback-product-hunt-export.log >&2 || true
    exit 1
  fi
}

SLUGS="hero steps ask proof results action trust outcomes"
index=1
for slug in $SLUGS; do
  padded=$(printf "%02d" "$index")
  export_asset \
    "file://${HTML_FILE}?slide=${index}" \
    "$OUT_DIR/gallery-${padded}-${slug}.png" \
    "$GALLERY_WIDTH" \
    "$GALLERY_HEIGHT" \
    "/tmp/timeback-product-hunt-${padded}"
  echo "exported gallery-${padded}-${slug}.png"
  index=$((index + 1))
done

export_asset \
  "file://${HTML_FILE}?slide=icon" \
  "$OUT_DIR/thumbnail.png" \
  "$ICON_SIZE" \
  "$ICON_SIZE" \
  "/tmp/timeback-product-hunt-icon"
echo "exported thumbnail.png"

if command -v sips >/dev/null 2>&1; then
  sips -g pixelWidth -g pixelHeight "$OUT_DIR"/*.png
fi
