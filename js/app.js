(async function () {
  const $ = (id) => document.getElementById(id);
  const book = await (await fetch("data/book.json")).json();

  document.title = `${book.title} – Flipbook`;

  const total = book.numPages;
  const MIN_PAGE_W = 300;
  const ZOOM = 2.2;
  const ratio = book.width / book.height;

  const viewport = $("viewport");
  const stage = $("stage");
  const bookEl = $("book");
  const panLayer = $("pan-layer");

  // ---- Pages -------------------------------------------------------------
  book.pageFiles.forEach((src, i) => {
    const page = document.createElement("div");
    page.className = "page";
    const img = document.createElement("img");
    img.src = src;
    img.alt = `Page ${i + 1}`;
    img.decoding = "async";
    img.draggable = false;
    page.appendChild(img);

    book.links
      .filter((l) => l.page === i + 1)
      .forEach((l) => {
        const a = document.createElement("a");
        a.className = "hotspot";
        a.href = l.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.title = l.url;
        a.style.cssText = `left:${l.left}%;top:${l.top}%;width:${l.width}%;height:${l.height}%`;
        page.appendChild(a);
      });

    bookEl.appendChild(page);
  });

  // ---- Layout (book keeps page aspect ratio, fits the viewport) -----------
  function layout() {
    const availW = viewport.clientWidth - 24;
    const availH = viewport.clientHeight - 24;
    const spreadW = Math.min(availW, availH * ratio * 2);
    const w = spreadW >= MIN_PAGE_W * 2 ? spreadW : Math.min(availW, availH * ratio);
    // StPageFlip (autoSize) fills its parent's width and derives the height from the page ratio.
    stage.style.width = `${Math.floor(w)}px`;
  }
  layout();

  // ---- Page flip ---------------------------------------------------------
  const startPage = pageFromHash() ?? 1;
  const pageFlip = new St.PageFlip(bookEl, {
    width: book.width,
    height: book.height,
    size: "stretch",
    minWidth: MIN_PAGE_W,
    maxWidth: 2000,
    minHeight: 400,
    maxHeight: 3000,
    showCover: true,
    usePortrait: true,
    maxShadowOpacity: 0.5,
    flippingTime: 700,
    startPage: startPage - 1,
    mobileScrollSupport: false,
  });
  pageFlip.loadFromHTML(bookEl.querySelectorAll(".page"));

  window.addEventListener("resize", () => {
    layout();
    pageFlip.update();
    updateUI();
  });

  // ---- UI state ----------------------------------------------------------
  const indicator = $("page-indicator");
  const prevBtn = $("prev");
  const nextBtn = $("next");

  function currentLabel() {
    const idx = pageFlip.getCurrentPageIndex();
    const landscape = pageFlip.getOrientation() === "landscape";
    if (landscape && idx > 0 && idx + 1 < total) return `${idx + 1}-${idx + 2}`;
    return `${idx + 1}`;
  }

  // A lone cover is drawn in one half of the spread; shift the book so it sits centred.
  function updateCentering(idx = pageFlip.getCurrentPageIndex()) {
    let shift = 0;
    if (pageFlip.getOrientation() === "landscape") {
      if (idx === 0) shift = -25;
      else if (idx === total - 1 && total % 2 === 0) shift = 25;
    }
    bookEl.style.transform = shift ? `translateX(${shift}%)` : "";
  }

  function updateUI() {
    updateCentering();
    const idx = pageFlip.getCurrentPageIndex();
    indicator.textContent = `${currentLabel()} / ${total}`;
    prevBtn.hidden = idx <= 0;
    nextBtn.hidden = idx >= total - 1 || (pageFlip.getOrientation() === "landscape" && idx + 2 >= total && idx > 0);
    const hash = `#page/${idx + 1}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  function pageFromHash() {
    const m = location.hash.match(/^#page\/(\d+)/);
    if (!m) return null;
    return Math.min(Math.max(parseInt(m[1], 10), 1), total);
  }

  // ---- Flip sound --------------------------------------------------------
  const sounds = ["sm", "md", "lg"].map((s) => new Audio(`assets/flip-${s}.mp3`));
  let soundOn = true;
  function playFlip(distance) {
    if (!soundOn) return;
    const a = sounds[distance > 6 ? 2 : distance > 2 ? 1 : 0];
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  let lastIdx = startPage - 1;
  pageFlip.on("flip", (e) => {
    playFlip(Math.abs(e.data - lastIdx));
    lastIdx = e.data;
    resetZoom();
    updateUI();
  });
  pageFlip.on("init", updateUI);
  // "flip" only fires once the animation ends; start sliding when the flip begins instead
  pageFlip.on("changeState", (e) => {
    if (e.data === "read") return updateCentering(); // also undoes a cancelled drag
    if (e.data !== "flipping" || pageFlip.getOrientation() !== "landscape") return;
    const idx = pageFlip.getCurrentPageIndex();
    const forward = pageFlip.getFlipController().getCalculation().getDirection() === 0;
    const step = idx === 0 || (!forward && idx === 1) ? 1 : 2;
    updateCentering(Math.min(Math.max(idx + (forward ? step : -step), 0), total - 1));
  });
  updateUI();
  // enable the slide only after the first position is set, so load doesn't animate
  requestAnimationFrame(() => requestAnimationFrame(() => bookEl.classList.add("animated")));

  // ---- Navigation --------------------------------------------------------
  function goTo(page) {
    const idx = Math.min(Math.max(page, 1), total) - 1;
    pageFlip.flip(idx);
  }
  prevBtn.addEventListener("click", () => pageFlip.flipPrev());
  nextBtn.addEventListener("click", () => pageFlip.flipNext());

  window.addEventListener("hashchange", () => {
    const p = pageFromHash();
    if (p && p - 1 !== pageFlip.getCurrentPageIndex()) goTo(p);
  });

  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft": pageFlip.flipPrev(); break;
      case "ArrowRight": pageFlip.flipNext(); break;
      case "Home": goTo(1); break;
      case "End": goTo(total); break;
      case "+": case "=": if (!zoomed) toggleZoom(); break;
      case "-": if (zoomed) toggleZoom(); break;
      case "Escape":
        if (zoomed) toggleZoom();
        else closeOutline();
        break;
      default: return;
    }
  });

  // ---- Outline -----------------------------------------------------------
  const outline = $("outline");
  const outlineBtn = $("btn-outline");

  function buildList(items) {
    const ul = document.createElement("ul");
    items.forEach((item) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      const title = document.createElement("span");
      title.textContent = item.title.replace(/\s+/g, " ").trim();
      const pg = document.createElement("span");
      pg.className = "pg";
      pg.textContent = item.page;
      btn.append(title, pg);
      btn.addEventListener("click", () => {
        goTo(item.page);
        if (window.innerWidth < 700) closeOutline();
      });
      li.appendChild(btn);
      if (item.kids && item.kids.length) li.appendChild(buildList(item.kids));
      ul.appendChild(li);
    });
    return ul;
  }
  $("outline-list").replaceWith(Object.assign(buildList(book.bookmarks), { id: "outline-list" }));

  function closeOutline() {
    outline.hidden = true;
    outlineBtn.classList.remove("active");
  }
  outlineBtn.addEventListener("click", () => {
    outline.hidden = !outline.hidden;
    outlineBtn.classList.toggle("active", !outline.hidden);
  });
  $("outline-close").addEventListener("click", closeOutline);

  // ---- Zoom & pan --------------------------------------------------------
  let zoomed = false;
  let tx = 0;
  let ty = 0;

  function applyTransform() {
    stage.style.transform = zoomed ? `translate(${tx}px, ${ty}px) scale(${ZOOM})` : "";
  }
  function clampPan() {
    const maxX = (bookEl.offsetWidth * (ZOOM - 1)) / 2 + 40;
    const maxY = (bookEl.offsetHeight * (ZOOM - 1)) / 2 + 40;
    tx = Math.min(Math.max(tx, -maxX), maxX);
    ty = Math.min(Math.max(ty, -maxY), maxY);
  }
  function setZoom(on, clientX, clientY) {
    zoomed = on;
    panLayer.hidden = !on;
    $("btn-zoom").classList.toggle("active", on);
    if (on) {
      // keep the point under the cursor fixed (defaults to the centre)
      const r = viewport.getBoundingClientRect();
      const px = (clientX ?? r.left + r.width / 2) - (r.left + r.width / 2);
      const py = (clientY ?? r.top + r.height / 2) - (r.top + r.height / 2);
      tx = px * (1 - ZOOM);
      ty = py * (1 - ZOOM);
      clampPan();
    } else {
      tx = ty = 0;
    }
    applyTransform();
  }
  const toggleZoom = (x, y) => setZoom(!zoomed, x, y);
  const resetZoom = () => zoomed && setZoom(false);

  $("btn-zoom").addEventListener("click", () => toggleZoom());
  bookEl.addEventListener("dblclick", (e) => { if (!zoomed) toggleZoom(e.clientX, e.clientY); });
  panLayer.addEventListener("dblclick", () => setZoom(false));

  let drag = null;
  panLayer.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, tx, ty };
    panLayer.setPointerCapture(e.pointerId);
    panLayer.classList.add("dragging");
    stage.classList.add("dragging");
  });
  panLayer.addEventListener("pointermove", (e) => {
    if (!drag) return;
    tx = drag.tx + (e.clientX - drag.x);
    ty = drag.ty + (e.clientY - drag.y);
    clampPan();
    applyTransform();
  });
  const endDrag = () => {
    drag = null;
    panLayer.classList.remove("dragging");
    stage.classList.remove("dragging");
  };
  panLayer.addEventListener("pointerup", endDrag);
  panLayer.addEventListener("pointercancel", endDrag);

  // ---- Sound toggle & fullscreen -----------------------------------------
  $("btn-sound").addEventListener("click", (e) => {
    soundOn = !soundOn;
    e.currentTarget.setAttribute("aria-pressed", String(soundOn));
  });

  const fsBtn = $("btn-fullscreen");
  if (!document.documentElement.requestFullscreen) fsBtn.hidden = true;
  fsBtn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener("fullscreenchange", () => {
    fsBtn.classList.toggle("active", !!document.fullscreenElement);
    layout();
    pageFlip.update();
  });
})();
