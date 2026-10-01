# BookStory

A static flipbook viewer recreating the look and features of a Heyzine flipbook
("Saigon Hotpot – Booklet 2026, Recruitment", 38 pages). Vanilla HTML/CSS/JS, no build step.
Page flipping is done by [StPageFlip](https://github.com/Nodlik/StPageFlip) (MIT), vendored in `js/vendor/`.

## Run

```sh
python3 -m http.server 8000
# open http://localhost:8000/  (deep link: http://localhost:8000/#page/8)
```

## Features

Cover + double-page spreads, drag / arrows / keyboard (←, →, Home, End), outline panel,
zoom (button, `+`/`-`, double-click) with pan, fullscreen, flip sound toggle, `#page/N` deep links,
single-page layout on narrow screens, clickable link areas on page 38.

## Regenerating assets

`scripts/prepare-assets.sh` downloads the source PDF, background and flip sounds, renders
`assets/pages/p-NN.jpg` (needs `curl`, `pdftoppm` from poppler, and `node`) and writes `data/book.json`
(page list, outline, link areas).

## Content notice

The booklet content (PDF, page images, logo, photos) belongs to Saigon Hotpot. It is bundled here for
personal/learning use only — make sure you have the rights before publishing it anywhere.
