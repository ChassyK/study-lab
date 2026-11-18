(() => {
  const section = document.querySelector("[data-study-strip]");
  if (!section) return;
  const viewport = section.querySelector(".discovery-scroll");
  const articles = [...viewport.querySelectorAll("li")];
  const controls = section.querySelectorAll("[data-strip-action]");
  const toggle = section.querySelector('[data-strip-action="toggle"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const touchPointer = matchMedia("(pointer: coarse)");
  const list = viewport.querySelector("ul");
  let firstCopy;
  let observing = false;
  let hovered = false;
  let playing = !reduce.matches;
  let touchUntil = 0;
  let manualUntil = 0;
  let nextAdvance = 0;
  let resizeFrame = 0;
  let frame = 0;
  let previousTime = 0;
  let fractional = 0;
  let length = 0;
  let starts = [];
  let originalFocused = false;

  const updateToggle = () => {
    toggle.textContent = playing ? "Pausa" : "Scorri";
    toggle.setAttribute("aria-label", playing ? "Ferma lo scorrimento automatico" : "Avvia lo scorrimento automatico");
  };
  const setPlaying = value => {
    playing = value;
    updateToggle();
    schedule();
  };

  const setup = () => {
    firstCopy?.forEach(node => node.remove());
    firstCopy = [];
    section.classList.toggle("strip-ready", articles.length > 1);
    if (articles.length < 2) return;
    const start = articles[0].offsetLeft;
    starts = articles.map(article => article.offsetLeft - start);
    length = 0;
    if (viewport.scrollWidth > viewport.clientWidth + 1) {
      firstCopy = articles.map(article => {
        const copy = article.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.querySelector("a").tabIndex = -1;
        list.append(copy);
        return copy;
      });
      length = firstCopy[0].offsetLeft - start;
    }
    controls.forEach(control => { control.hidden = !length; });
    fractional = 0;
    if (length && viewport.scrollLeft >= length) viewport.scrollLeft %= length;
    schedule();
  };

  function schedule() {
    if (!frame && observing && playing && length && !hovered && !originalFocused && !document.hidden) {
      frame = requestAnimationFrame(advance);
    }
  }

  function advance(time) {
    frame = 0;
    if (!observing || !playing || !length || hovered || originalFocused || document.hidden) {
      previousTime = 0;
      return;
    }
    if (touchPointer.matches) {
      if (!previousTime) nextAdvance = time + 5800;
      if (time >= Math.max(touchUntil, manualUntil, nextAdvance)) {
        step(false);
        nextAdvance = time + 5800;
      }
    } else if (previousTime && time >= Math.max(touchUntil, manualUntil)) {
      // Keep fractional travel separately because scrollLeft can round to a CSS pixel.
      fractional += Math.min(time - previousTime, 34) * 0.028;
      const travel = Math.floor(fractional);
      if (travel) {
        const position = viewport.scrollLeft + travel;
        viewport.scrollLeft = position >= length ? position - length : position;
        fractional -= travel;
      }
    }
    previousTime = time;
    schedule();
  }

  section.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") hovered = true;
  });
  section.addEventListener("pointerleave", event => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    schedule();
  });
  viewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse") touchUntil = Infinity;
  }, { passive: true });
  const releaseTouch = event => {
    if (event.pointerType !== "mouse" && touchUntil === Infinity) {
      touchUntil = performance.now() + 2300;
    }
  };
  window.addEventListener("pointerup", releaseTouch, { passive: true });
  window.addEventListener("pointercancel", releaseTouch, { passive: true });
  viewport.addEventListener("wheel", event => {
    if (event.deltaX || event.shiftKey) touchUntil = performance.now() + 2300;
  }, { passive: true });
  viewport.addEventListener("scroll", () => {
    if (length && viewport.scrollLeft >= length && (touchUntil === Infinity || performance.now() < touchUntil)) {
      viewport.scrollLeft %= length;
    }
  }, { passive: true });
  section.addEventListener("focusin", event => {
    originalFocused = viewport.contains(event.target) && event.target.matches(":focus-visible");
    if (originalFocused && viewport.scrollLeft >= length && length) viewport.scrollLeft %= length;
    if (event.target.matches(":focus-visible")) setPlaying(false);
  });
  section.addEventListener("focusout", () => {
    originalFocused = false;
    schedule();
  });
  function step(left) {
    if (!length) return;
    const position = viewport.scrollLeft % length;
    let destination;
    if (left) {
      destination = [...starts].reverse().find(start => start < position - 3);
      if (destination === undefined) {
        viewport.scrollLeft = position + length;
        destination = starts.at(-1);
      }
    } else {
      destination = starts.find(start => start > position + 3) ?? length;
      if (viewport.scrollLeft !== position) viewport.scrollLeft = position;
    }
    manualUntil = performance.now() + 450;
    viewport.scrollTo({ left: destination, behavior: reduce.matches ? "auto" : "smooth" });
  }

  section.addEventListener("click", event => {
    const control = event.target.closest("[data-strip-action]");
    if (!control) return;
    if (control === toggle) {
      setPlaying(!playing);
    } else {
      step(control.dataset.stripAction === "previous");
      nextAdvance = performance.now() + 5800;
    }
  });
  reduce.addEventListener("change", () => setPlaying(!reduce.matches));
  document.addEventListener("visibilitychange", schedule);
  const visibility = new IntersectionObserver(([entry]) => {
    observing = entry.isIntersecting;
    schedule();
  });
  visibility.observe(section);
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(setup);
  }).observe(viewport);
  updateToggle();
  setup();
})();
