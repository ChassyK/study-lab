(() => {
  const section = document.querySelector("[data-study-strip]");
  if (!section) return;
  const viewport = section.querySelector(".discovery-scroll");
  const articles = [...viewport.querySelectorAll("li")];
  const controls = section.querySelectorAll("[data-strip-action]");
  const toggle = section.querySelector('[data-strip-action="toggle"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const list = viewport.querySelector("ul");
  let firstCopy;
  let observing = false;
  let hovered = false;
  let playing = !reduce.matches;
  let touchUntil = 0;
  let resizeFrame = 0;
  let timer = 0;
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
    const start = articles[0].getBoundingClientRect().left;
    starts = articles.map(article => article.getBoundingClientRect().left - start);
    length = 0;
    if (viewport.scrollWidth > viewport.clientWidth + 1) {
      firstCopy = articles.map(article => {
        const copy = article.cloneNode(true);
        copy.setAttribute("aria-hidden", "true");
        copy.querySelector("a").tabIndex = -1;
        list.append(copy);
        return copy;
      });
      length = firstCopy[0].getBoundingClientRect().left - articles[0].getBoundingClientRect().left;
    }
    controls.forEach(control => { control.hidden = !length; });
    if (length && viewport.scrollLeft >= length) viewport.scrollLeft %= length;
    schedule();
  };

  function schedule() {
    clearTimeout(timer);
    if (observing && playing && length && !hovered && !originalFocused && !document.hidden) {
      const delay = Math.max(5800, touchUntil - performance.now());
      if (!Number.isFinite(delay)) return;
      timer = setTimeout(() => {
        step(false);
        schedule();
      }, delay);
    }
  }

  section.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") {
      hovered = true;
      schedule();
    }
  });
  section.addEventListener("pointerleave", event => {
    if (event.pointerType !== "mouse") return;
    hovered = false;
    schedule();
  });
  viewport.addEventListener("pointerdown", event => {
    if (event.pointerType !== "mouse") {
      touchUntil = Infinity;
      schedule();
    }
  }, { passive: true });
  const releaseTouch = event => {
    if (event.pointerType !== "mouse" && touchUntil === Infinity) {
      touchUntil = performance.now() + 2300;
      schedule();
    }
  };
  window.addEventListener("pointerup", releaseTouch, { passive: true });
  window.addEventListener("pointercancel", releaseTouch, { passive: true });
  viewport.addEventListener("wheel", event => {
    if (event.deltaX || event.shiftKey) {
      touchUntil = performance.now() + 2300;
      schedule();
    }
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
    viewport.scrollTo({ left: destination, behavior: reduce.matches ? "auto" : "smooth" });
  }

  section.addEventListener("click", event => {
    const control = event.target.closest("[data-strip-action]");
    if (!control) return;
    if (control === toggle) {
      setPlaying(!playing);
    } else {
      step(control.dataset.stripAction === "previous");
      schedule();
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
