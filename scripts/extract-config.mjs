// Extracts the flipbook config embedded in data/source.html into data/book.json.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../data/source.html", import.meta.url), "utf8");
const start = html.indexOf("var flipbookcfg=");
if (start < 0) throw new Error("flipbookcfg not found in source.html");

// Parse the JSON object literal by brace matching (strings may contain braces).
let i = html.indexOf("{", start);
const begin = i;
let depth = 0;
let inStr = false;
for (; i < html.length; i++) {
  const c = html[i];
  if (inStr) {
    if (c === "\\") i++;
    else if (c === '"') inStr = false;
  } else if (c === '"') inStr = true;
  else if (c === "{") depth++;
  else if (c === "}" && --depth === 0) break;
}
const cfg = JSON.parse(html.slice(begin, i + 1));

const book = {
  title: cfg.bookmark?.list?.[0]?.title ?? "Flipbook",
  width: cfg.width,
  height: cfg.height,
  numPages: cfg.num_pages,
  pageFiles: Array.from({ length: cfg.num_pages }, (_, n) =>
    `assets/pages/p-${String(n + 1).padStart(String(cfg.num_pages).length, "0")}.jpg`),
  bookmarks: cfg.bookmark?.list ?? [],
  links: (cfg.layers ?? [])
    .filter((l) => l.type === "action" && l.action?.type === "link")
    .map((l) => ({
      page: l.page,
      url: l.action.target,
      // percentages relative to the page wrapper
      left: (l.css.left / l.wrapper.width) * 100,
      top: (l.css.top / l.wrapper.height) * 100,
      width: (l.css.width / l.wrapper.width) * 100,
      height: (l.css.height / l.wrapper.height) * 100,
    })),
};

writeFileSync(new URL("../data/book.json", import.meta.url), JSON.stringify(book, null, 2));
console.log(`book.json: ${book.numPages} pages, ${book.bookmarks.length} bookmarks, ${book.links.length} links`);
