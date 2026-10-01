#!/usr/bin/env bash
# Downloads the source booklet and its assets, renders page images and extracts metadata.
# Requires: curl, pdftoppm (poppler), node.
set -euo pipefail

cd "$(dirname "$0")/.."

CDN="https://cdnm.heyzine.com"
PAGE_URL="https://heyzine.com/flip-book/2e569a6cbd.html"
PDF_URL="$CDN/files/uploaded/2e569a6cbda418fcf6326b8dee2fe047bc7ce8f5.pdf"
UA="Mozilla/5.0"

mkdir -p assets/pages data

echo "Downloading page metadata..."
curl -sSL -A "$UA" "$PAGE_URL" -o data/source.html

echo "Downloading PDF..."
[ -f assets/book.pdf ] || curl -sSL -A "$UA" "$PDF_URL" -o assets/book.pdf

echo "Downloading background, thumbnail and sounds..."
curl -sSL -A "$UA" "$CDN/files/backgrounds/back5.svg" -o assets/bg.svg
curl -sSL -A "$UA" "${PDF_URL}-thumb.jpg" -o assets/thumb.jpg
for s in sm md lg; do
  curl -sSL -A "$UA" "$CDN/flipbook/snd/flip-ct-$s.mp3" -o "assets/flip-$s.mp3"
done

echo "Rendering pages..."
rm -f assets/pages/*.jpg
pdftoppm -jpeg -jpegopt quality=85 -scale-to-y 1400 -scale-to-x -1 assets/book.pdf assets/pages/p

echo "Extracting book.json..."
node scripts/extract-config.mjs

echo "Done."
