/* Study Lab — interazioni. Nessuna dipendenza. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("sl:" + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("sl:" + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem("sl:" + k); } catch {} },
  };

  /* binario di lettura + voce attiva nell'indice */
  const fill = $(".rail-fill");
  const art = $(".lesson");
  if (fill && art) {
    const wide = () => matchMedia("(min-width: 961px)").matches;
    const onScroll = () => {
      const r = art.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / (total || 1)));
      fill.style[wide() ? "height" : "width"] = (p * 100).toFixed(1) + "%";
      fill.style[wide() ? "width" : "height"] = "100%";
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
  }
  const tocLinks = $$(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    const map = new Map(tocLinks.map(a => [decodeURIComponent(a.hash.slice(1)), a]));
    const io = new IntersectionObserver(es => {
      es.forEach(e => {
        if (e.isIntersecting) {
          tocLinks.forEach(a => a.classList.remove("on"));
          map.get(e.target.id)?.classList.add("on");
        }
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    map.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* video YouTube: carica il player solo al clic */
  $$(".yt").forEach(fig => {
    $(".yt-play", fig)?.addEventListener("click", () => {
      const f = document.createElement("iframe");
      f.src = `https://www.youtube-nocookie.com/embed/${fig.dataset.id}?autoplay=1&rel=0&start=${fig.dataset.start || 0}`;
      f.allow = "accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.title = "Video";
      $(".yt-play", fig).replaceWith(f);
    });
  });

  /* quiz: conta il primo tentativo (salvato nel browser) */
  $$("section#quiz").forEach(sec => {
    const key = "quiz:" + sec.dataset.key;
    const qs = $$(".q", sec);
    const score = $(".score", sec);
    let first = store.get(key) || {};          // { indiceDomanda: indiceScelto }
    const reveal = (q, chosen) => {
      const ans = +q.dataset.answer;
      $$(".opt", q).forEach((b, j) => {
        b.disabled = true;
        b.classList.toggle("right", j === ans);
        b.classList.toggle("wrong", j === chosen && j !== ans);
      });
      $(".why", q).hidden = false;
    };
    const render = () => {
      const done = Object.keys(first).length;
      const ok = qs.filter((q, i) => i in first && first[i] === +q.dataset.answer).length;
      score.textContent = !done ? "" : done < qs.length
        ? `Primo tentativo: ${ok} giuste su ${done} risposte (${qs.length - done} da fare)`
        : `Risultato: ${ok} su ${qs.length}${ok === qs.length ? " — perfetto." : ". Rileggi i perché delle sbagliate."}`;
    };
    qs.forEach((q, i) => {
      $$(".opt", q).forEach((b, j) => b.addEventListener("click", () => {
        if (!(i in first)) { first[i] = j; store.set(key, first); }
        reveal(q, j);
        render();
      }));
      if (i in first) reveal(q, first[i]);
    });
    render();
    $(".reset", sec)?.addEventListener("click", () => {
      first = {}; store.del(key);
      qs.forEach(q => {
        $$(".opt", q).forEach(b => { b.disabled = false; b.classList.remove("right", "wrong"); });
        $(".why", q).hidden = true;
      });
      render();
      qs[0]?.scrollIntoView({ block: "center" });
    });
  });

  /* scenari "Decidi tu" */
  $$(".scenario").forEach(sc => {
    $$(".choice", sc).forEach(b => b.addEventListener("click", () => {
      const out = b.nextElementSibling;
      const open = out.hidden;
      out.hidden = !open;
      out.classList.add(b.dataset.good === "1" ? "good" : "bad");
      b.setAttribute("aria-expanded", String(open));
      const link = $(".lesson-link", sc);
      if (link) link.hidden = false;
    }));
  });

  /* flashcard */
  $$(".deck").forEach(deck => {
    const cards = $$(".card", deck);
    const pos = $(".pos", deck);
    let i = 0;
    const show = n => {
      i = (n + cards.length) % cards.length;
      cards.forEach((c, j) => { c.classList.toggle("cur", j === i); c.classList.remove("flip"); });
      pos.textContent = `${i + 1} / ${cards.length}`;
    };
    cards.forEach(c => {
      c.addEventListener("click", () => c.classList.toggle("flip"));
      c.addEventListener("keydown", e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); c.classList.toggle("flip"); } });
    });
    $(".prev", deck)?.addEventListener("click", () => show(i - 1));
    $(".next", deck)?.addEventListener("click", () => show(i + 1));
    deck.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") show(i + 1);
      if (e.key === "ArrowLeft") show(i - 1);
    });
    show(0);
  });

  /* filtro glossario */
  $$(".gl-filter").forEach(inp => {
    const sec = inp.closest("section");
    const terms = $$(".term", sec);
    const empty = $(".empty", sec);
    inp.addEventListener("input", () => {
      const q = inp.value.trim().toLowerCase();
      let n = 0;
      terms.forEach(t => { const hit = !q || t.textContent.toLowerCase().includes(q); t.hidden = !hit; n += hit; });
      if (empty) empty.hidden = n > 0;
    });
  });

  /* home: filtri semestre + ricerca */
  const q = $("#q");
  if (q) {
    const base = $(".brand").getAttribute("href");
    const results = $("#results");
    const none = $("#noresults");
    const sems = $$(".sem");
    let index = null;
    let sem = "all";
    const segBtns = $$(".seg button");
    const applySem = () => sems.forEach(s => { s.hidden = sem !== "all" && s.dataset.sem !== sem; });
    segBtns.forEach(b => b.addEventListener("click", () => {
      sem = b.dataset.sem;
      segBtns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      applySem();
      run();
    }));
    const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const mark = (s, t) => { const i = norm(s).indexOf(t); return i < 0 ? esc(s) : esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + t.length)) + "</mark>" + esc(s.slice(i + t.length)); };
    const run = async () => {
      const t = norm(q.value.trim());
      if (!t) { results.hidden = true; none.hidden = true; sems.forEach(s => s.classList.remove("dim")); applySem(); return; }
      if (!index) { try { index = await (await fetch(base + "search.json")).json(); } catch { index = []; } }
      const hits = index.filter(x => {
        const semOk = sem === "all" || String(x.sem || "") === sem || !x.sem;
        return semOk && norm([x.t, x.s, x.c, ...(x.g || []), ...(x.h || [])].join(" ")).includes(t);
      }).slice(0, 30);
      results.innerHTML = hits.map(x => {
        const term = (x.g || []).find(g => norm(g).includes(t));
        const head = (x.h || []).find(h => norm(h).includes(t));
        return `<li data-course="${x.k}"><a href="${base}${x.u}${term ? "#glossario" : ""}"><strong>${mark(x.t, t)}</strong><small>${esc(x.c)} · ${x.d}</small>${term ? `<span>Termine: ${mark(term, t)}</span>` : head ? `<span>Sezione: ${mark(head, t)}</span>` : ""}</a></li>`;
      }).join("");
      results.hidden = !hits.length;
      none.hidden = !!hits.length;
    };
    q.addEventListener("input", run);
  }
})();
