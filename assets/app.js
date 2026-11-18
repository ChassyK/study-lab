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
    const onScroll = () => {
      const r = art.getBoundingClientRect();
      const total = r.height - innerHeight;
      const p = Math.max(0, Math.min(1, -r.top / (total || 1)));
      fill.style.width = (p * 100).toFixed(1) + "%";
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
          const cur = map.get(e.target.id);
          cur?.classList.add("on");
          const ol = cur?.closest("ol");
          $$(".toc ol").forEach(o => { if (o !== ol) o.style.setProperty("--h", "0px"); });
          if (ol) { ol.style.setProperty("--y", cur.offsetTop + "px"); ol.style.setProperty("--h", cur.offsetHeight + "px"); }
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
  $$("section#quiz, .practice").forEach(sec => {
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
      if (sec.closest("[lang]")?.lang === "en") {
        score.textContent = !done ? "" : done < qs.length
          ? `First attempt: ${ok} correct out of ${done} answered (${qs.length - done} left)`
          : `Result: ${ok} out of ${qs.length}.`;
        return;
      }
      score.textContent = !done ? "" : done < qs.length
        ? `Primo tentativo: ${ok} giuste su ${done} risposte (${qs.length - done} da fare)`
        : `Risultato: ${ok} su ${qs.length}${ok === qs.length ? " — perfetto." : ". Rileggi i perché delle sbagliate."}`;
    };
    qs.forEach((q, i) => {
      $$(".opt", q).forEach((b, j) => b.addEventListener("click", () => {
        if (!(i in first)) { first[i] = j; store.set(key, first); }
        q.classList.add("live");
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
    const sems = $$(".sem[data-sem]");
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
        return `<li data-course="${x.k}"><a href="${base}${x.u}${term ? "#glossario" : ""}"><strong>${mark(x.t, t)}</strong><small>${esc(x.c)}${x.d ? ` · ${esc(x.d)}` : ""}</small>${term ? `<span>Termine: ${mark(term, t)}</span>` : head ? `<span>Sezione: ${mark(head, t)}</span>` : ""}</a></li>`;
      }).join("");
      results.hidden = !hits.length;
      none.hidden = !!hits.length;
    };
    q.addEventListener("input", run);
  }

  /* case studies: filtro per corso */
  $$(".cs-filter").forEach(grp => {
    const rows = $$(".cs-list > li");
    const btns = $$("button", grp);
    btns.forEach(b => b.addEventListener("click", () => {
      btns.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      const k = b.dataset.course;
      rows.forEach(r => { r.hidden = k !== "all" && !(r.dataset.courses || "").split(" ").includes(k); });
    }));
  });

  /* tema chiaro / scuro: segue il sistema finché non scegli tu; la scelta resta salvata nel browser */
  (() => {
    const bar = $(".topbar");
    if (!bar) return;
    const root = document.documentElement;
    const force = new URLSearchParams(location.search).get("theme");
    if (force === "dark" || force === "light") root.dataset.theme = force;
    const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const b = document.createElement("button");
    b.type = "button"; b.className = "theme-btn";
    const sun = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    const moon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
    const paint = () => { const d = isDark(); b.innerHTML = d ? sun : moon; b.setAttribute("aria-label", d ? "Passa al tema chiaro" : "Passa al tema scuro"); b.title = d ? "Tema chiaro" : "Tema scuro"; };
    const flip = () => { const t = isDark() ? "light" : "dark"; root.dataset.theme = t; store.set("theme", t); paint(); };
    b.addEventListener("click", () => {
      if (!document.startViewTransition || !root.classList.contains("motion")) return flip();
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.classList.add("theme-vt");
      const vt = document.startViewTransition(flip);
      vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${R}px at ${x}px ${y}px)`] },
        { duration: 420, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" })).catch(() => {});
      vt.finished.finally(() => root.classList.remove("theme-vt"));
    });
    bar.append(b);
    paint();
  })();

  /* movimento (18/11/2026). Tutto facoltativo: senza la classe "motion" (riduci movimento) o in stampa il sito resta fermo e completo. */
  (() => {
    const root = document.documentElement;
    const motion = root.classList.contains("motion") && !document.body.classList.contains("print");
    const escH = t => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

    /* menu: resta accesa la sezione in cui sei; il filo sotto la barra compare solo scorrendo */
    const nav = $(".gideon-nav");
    if (nav) {
      const path = location.pathname;
      const legacyMidterm = /\/midterm(?:-2)?\/$/.test(path);
      for (const link of nav.querySelectorAll("a")) {
        const destination = new URL(link.href).pathname;
        const current = legacyMidterm ? destination.endsWith("/midterms/") :
          path.startsWith(destination) && destination !== new URL($(".brand").href).pathname;
        if (!current) continue;
        link.setAttribute("aria-current", path === destination ? "page" : "location");
        link.closest(".nav-group")?.setAttribute("data-section-current", "");
      }
      document.addEventListener("click", event => {
        if (!nav.contains(event.target)) nav.querySelectorAll(".nav-group[open]").forEach(item => { item.open = false; });
      });
      nav.addEventListener("keydown", event => {
        const menu = event.target.closest(".nav-group[open]");
        if (event.key === "Escape" && menu) {
          menu.open = false;
          menu.querySelector("summary").focus();
        }
      });
    }
    const onTop = () => root.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", onTop, { passive: true });
    onTop();

    /* "/" porta alla ricerca della home */
    const sq = $("#q");
    if (sq) document.addEventListener("keydown", e => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
      e.preventDefault(); sq.focus();
    });

    /* selettori a segmenti: il fondo scorre sotto la voce scelta */
    $$(".seg").forEach(seg => {
      const place = () => {
        const b = $('button[aria-pressed="true"]', seg);
        if (!b) return;
        seg.style.setProperty("--tx", b.offsetLeft + "px"); seg.style.setProperty("--ty", b.offsetTop + "px");
        seg.style.setProperty("--tw", b.offsetWidth + "px"); seg.style.setProperty("--th", b.offsetHeight + "px");
      };
      place();
      seg.classList.add("has-thumb");
      if (motion) requestAnimationFrame(() => requestAnimationFrame(() => seg.classList.add("ready")));
      seg.addEventListener("click", () => requestAnimationFrame(place));
      addEventListener("resize", place);
      document.fonts?.ready.then(place);
    });

    /* passaggio di pagina: il titolo su cui clicchi diventa il titolo della pagina che si apre */
    document.addEventListener("click", e => {
      const a = e.target.closest?.("a[href]");
      if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
      const t = a.matches(".lessons a") ? $(".t", a) : a.matches(".latest") ? $(".latest-t", a) : a.matches(".timeline a") ? $("span", a)
        : a.matches(".results a") ? $("strong", a) : a.matches(".course-row h3 a") ? a : null;
      if (!t) return;
      $$("h1").forEach(h => { h.style.viewTransitionName = "none"; });
      t.style.viewTransitionName = "page-title";
    }, true);
    addEventListener("pageshow", e => { if (e.persisted) $$("[style*='view-transition-name']").forEach(el => { el.style.viewTransitionName = ""; }); });

    /* telefono: dei punti chiave restano i primi tre, gli altri si aprono con un tocco */
    if (!document.body.classList.contains("print")) $$(".brief .keys").forEach(ul => {
      const n = ul.children.length;
      if (n < 5) return;
      const narrow = matchMedia("(max-width: 720px)");
      let expanded = false;
      const b = document.createElement("button");
      b.type = "button"; b.className = "btn ghost keys-more"; b.textContent = `Mostra tutti i ${n} punti`;
      const place = () => { ul.classList.toggle("clamped", narrow.matches && !expanded); b.hidden = !narrow.matches || expanded; };
      b.addEventListener("click", () => { expanded = true; place(); });
      ul.after(b);
      place();
      if (narrow.addEventListener) narrow.addEventListener("change", place);
      else narrow.addListener?.(place);
    });

    if (!motion) return;

    /* titolo d'apertura: sale parola per parola */
    $$("[data-split]").forEach(h => {
      const txt = h.textContent.trim();
      h.setAttribute("aria-label", txt);
      h.innerHTML = txt.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${Math.min(i, 6)}">${escH(w)}</span></span>`).join(" ");
      h.classList.add("split");
    });

    if (!("IntersectionObserver" in window)) { $$("[data-rv]").forEach(el => el.toggleAttribute("data-rv", false)); return; }
    root.classList.add("rv-ready");

    /* comparsa allo scorrimento: solo i blocchi che all'apertura stanno sotto il bordo dello schermo
       (quelli già visibili non vengono mai nascosti: niente lampeggi) */
    const sel = ".sem > h2, .course-row, .lessons > li, .watch-item, .midterm-lessons > li, .course > section > h2, "
      + ".prose .box, .prose .diagram, .prose .table-wrap, .prose .yt, .prose .lab, .prose .dati, "
      + ".study > h2, .q, .scenario, .deck, .video, .prevnext .pn";
    const io = new IntersectionObserver(es => {
      let k = 0;
      es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        if (!el.style.getPropertyValue("--i")) el.style.setProperty("--i", Math.min(k++, 5));
        el.classList.add("rv-in");
        setTimeout(() => { el.toggleAttribute("data-rv", false); el.classList.toggle("rv-in", false); el.style.setProperty("--i", ""); }, 1100);
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    $$(sel).forEach(el => { if (!el.hasAttribute("data-rv") && el.getBoundingClientRect().top > innerHeight) el.setAttribute("data-rv", ""); });
    $$("[data-rv]").forEach(el => io.observe(el));

    /* numeri che contano fino al valore vero quando entrano nello schermo */
    $$("[data-count]").forEach(el => {
      const n = parseInt(el.dataset.count, 10);
      if (!n) return;
      el.style.fontVariantNumeric = "tabular-nums";
      const io2 = new IntersectionObserver(es => {
        if (!es[0].isIntersecting) return;
        io2.disconnect();
        const t0 = performance.now(), D = 900;
        const step = t => { const p = Math.min(1, (t - t0) / D); el.textContent = Math.round(n * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
      io2.observe(el);
    });
  })();
})();
