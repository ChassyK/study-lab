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
        return `<li data-course="${x.k}"><a href="${base}${x.u}${term ? "#glossario" : ""}"><strong>${mark(x.t, t)}</strong><small>${esc(x.c)} · ${x.d}</small>${term ? `<span>Termine: ${mark(term, t)}</span>` : head ? `<span>Sezione: ${mark(head, t)}</span>` : ""}</a></li>`;
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

  /* tutor: apre Claude con il contesto della pagina. Nel sito non c'è nessun dato personale: quello lo conosce Claude. */
  (() => {
    const home = $(".brand");
    if (!home) return;
    const base = home.getAttribute("href");
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "tutor-btn"; btn.textContent = "Chiedi a Gideon";
    btn.setAttribute("aria-expanded", "false");
    const box = document.createElement("div");
    box.className = "tutor"; box.hidden = true;
    const modes = ["Spiegamelo con un film o un anime", "Fammi uno schema", "Mostrami un grafico o un video", "Interrogami", "Collega ai miei case studies"];
    box.innerHTML = `<p class="tutor-h">Gideon · il tuo tutor, su Claude</p>
<label for="tutor-q">Cosa vuoi capire di questa pagina?</label>
<textarea id="tutor-q" rows="3" placeholder="es. non ho capito la smile curve"></textarea>
<div class="tutor-chips">${modes.map(t => `<button type="button" class="chip" aria-pressed="false">${t}</button>`).join("")}</div>
<a class="btn" target="_blank" rel="noopener" href="https://claude.ai/new">Apri in Claude</a>
<p class="tutor-note">Si apre Claude con questa pagina già indicata. Se prima selezioni un pezzo di testo, viene incluso.</p>`;
    document.body.append(btn, box);
    const ta = $("textarea", box), go = $("a.btn", box), chips = $$(".chip", box);
    let sel = "";
    document.addEventListener("selectionchange", () => {
      const s = getSelection();
      const t = String(s).trim();
      if (t && s.anchorNode && !box.contains(s.anchorNode)) sel = t.slice(0, 600);
    });
    const build = () => {
      const site = location.origin + base;
      const want = chips.filter(c => c.getAttribute("aria-pressed") === "true").map(c => c.textContent);
      const p = [
        "Sei Gideon, il mio tutor di studio: Gideon è anche il nome del mio sito di studio (secondo anno di International Business Studies).",
        `Pagina che sto guardando: ${location.href.split("#")[0]} («${document.title}»).`,
        sel ? `Passaggio che ho selezionato: «${sel}».` : "",
        `Prima leggi questa pagina e la mappa del sito ${site}tutor.txt (lezioni, glossari, case studies).`,
        "Usa quello che sai di me (memoria, progetti, quello che guardo e salvo su social, YouTube e streaming) per spiegare con esempi presi dai miei interessi.",
        "Mostra, non solo spiegare: schemi, disegni, grafici, animazioni, video YouTube verificati, scene di film, serie, anime e manga, canzoni, citazioni, meme.",
        "Italiano semplice, termini tecnici in inglese spiegati. Separa fatti e opinioni. Chiudi con una domanda per verificare che ho capito.",
        want.length ? `Modo che preferisco adesso: ${want.join("; ")}.` : "",
        ta.value.trim() ? `La mia richiesta: ${ta.value.trim()}` : "Parti chiedendomi cosa non mi è chiaro di questa pagina.",
      ].filter(Boolean).join("\n");
      go.href = "https://claude.ai/new?q=" + encodeURIComponent(p);
      return p;
    };
    const toggle = open => { box.hidden = !open; btn.setAttribute("aria-expanded", String(open)); if (open) { build(); ta.focus(); } };
    btn.addEventListener("click", () => toggle(box.hidden));
    chips.forEach(c => c.addEventListener("click", () => { c.setAttribute("aria-pressed", String(c.getAttribute("aria-pressed") !== "true")); build(); }));
    ta.addEventListener("input", build);
    go.addEventListener("click", () => { const p = build(); try { navigator.clipboard?.writeText(p); } catch {} });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && !box.hidden) { toggle(false); btn.focus(); } });
  })();

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
    b.addEventListener("click", () => { const t = isDark() ? "light" : "dark"; root.dataset.theme = t; store.set("theme", t); paint(); });
    bar.append(b);
    paint();
  })();
})();
