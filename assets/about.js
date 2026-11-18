/* Gideon · About — animazioni proprie della pagina. Nessuna dipendenza.
   Comparsa dei blocchi [data-rv] e numeri [data-count] li gestisce app.js; qui c'è solo ciò che esiste in questa pagina.
   Regola: senza la classe "motion" su <html> (riduci movimento) non si anima nulla e tutto resta visibile. */
(() => {
  const root = document.documentElement;
  const motion = root.classList.contains("motion");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hasIO = "IntersectionObserver" in window;
  const smallBtn = (cls, label) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; return b; };

  /* email: un clic per copiarla */
  const live = $(".ab-live");
  $$(".ab-copy").forEach(b => {
    if (!navigator.clipboard) return;
    b.hidden = false;
    let t;
    b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
      b.textContent = "Copied";
      if (live) live.textContent = "Email address copied";
      clearTimeout(t);
      t = setTimeout(() => { b.textContent = "Copy"; if (live) live.textContent = ""; }, 1800);
    });
  });

  if (!motion || !hasIO) return;

  /* schema «da una lezione a una pagina»: due giri quando entra in vista, poi resta acceso; «Replay» lo fa ripartire */
  const fig = $(".ab-flowfig");
  if (fig) {
    const STEP = 1100, steps = $$(".ab-flow li", fig).length || 4;
    const LIT = (steps - 1) * STEP + 400;      // tutto acceso
    let timers = [], started = false;
    const replay = smallBtn("ab-replay", "Replay");
    replay.hidden = true;
    fig.append(replay);
    fig.classList.add("is-anim");
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const rest = () => { clear(); fig.classList.add("run"); replay.hidden = false; };
    const play = laps => {
      clear();
      replay.hidden = true;
      fig.classList.add("run");
      if (laps <= 1) { timers.push(setTimeout(() => { replay.hidden = false; }, LIT)); return; }
      timers.push(setTimeout(() => fig.classList.remove("run"), LIT + 1500));
      timers.push(setTimeout(() => play(laps - 1), LIT + 2100));
    };
    const again = () => { clear(); fig.classList.remove("run"); timers.push(setTimeout(() => play(1), 420)); };
    replay.addEventListener("click", again);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) { started = true; play(2); }
      else if (!e.isIntersecting && started && timers.length) rest();   // fuori vista: niente giri a vuoto, resta acceso
    }, { threshold: 0.4 }).observe(fig);
    document.addEventListener("visibilitychange", () => { if (document.hidden && started && timers.length) rest(); });
  }

  /* percorso di studi: si disegna una volta quando entra in vista */
  const route = $(".ab-route");
  if (route) {
    route.classList.add("is-anim");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { route.classList.add("is-drawn"); io.disconnect(); } },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
    io.observe(route);
  }

  /* origini: le parole passano da grigio a inchiostro mentre scorri */
  const big = $("[data-words]");
  if (big) {
    const words = big.textContent.trim().split(/\s+/);
    big.textContent = "";
    words.forEach((w, i) => {
      const s = document.createElement("span");
      s.className = "w"; s.textContent = w;
      big.append(s, i < words.length - 1 ? " " : "");
    });
    big.classList.add("is-split");
    const spans = $$(".w", big);
    let shown = 0, ticking = false;
    const paint = () => {
      ticking = false;
      const r = big.getBoundingClientRect(), vh = innerHeight;
      const from = vh * 0.86, to = vh * 0.46;                 // inizia quando entra dal basso, finisce a metà schermo
      const p = Math.max(0, Math.min(1, (from - r.top) / (from - to + r.height)));
      const n = Math.round(p * spans.length);
      if (n === shown) return;
      for (let i = Math.min(n, shown); i < Math.max(n, shown); i++) spans[i].classList.toggle("on", i < n);
      shown = n;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    paint();
  }

  /* interessi: il nastro si ferma fuori vista e ha il suo pulsante Pause/Play */
  const marq = $(".ab-marq");
  if (marq) {
    const b = smallBtn("ab-marq-btn", "Pause");
    b.addEventListener("click", () => { b.textContent = marq.classList.toggle("is-paused") ? "Play" : "Pause"; });
    marq.after(b);
    new IntersectionObserver(([e]) => marq.classList.toggle("is-off", !e.isIntersecting)).observe(marq);
  }
})();
