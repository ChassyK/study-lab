/* Gideon — risposte tratte dai materiali pubblicati. */
(() => {
  const home = document.querySelector(".brand");
  const main = document.querySelector("main");
  if (!home || !main) return;
  const site = new URL(home.href);
  const content = ".lesson-grid > article.prose, .brief, #glossario";
  const tidy = value => value.replace(/\s+/g, " ").trim();
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ignored = new Set(("che chi cos cosa cosae significa significato frase passaggio paragrafo senso importante riferimento come quando dove quale quali perché perche per delle della dello degli nella nelle nello sono essere questo questa queste quello della delle una uno nei nel alla allo del dai dal sul con fra tra suo sua gli anche più piu fammi spiegami spiegare dimmi puoi vorrei devo capire vuol dire definizione what which when where how with from into does mean the and this that can tell about explain difference tra was for are you il la di da al ai le lo mi tu he she is it si on").split(" "));
  const tokens = value => [...new Set((normalize(value).match(/[a-z0-9]{2,}/g) || []).filter(x => !ignored.has(x)))];
  const stem = word => word.length >= 6 ? word.replace(/[aeio]$/, "") : word;
  const matches = (word, haystack) => haystack.has(word) || haystack.has(stem(word));
  const words = text => new Set(tokens(text).flatMap(word => [word, stem(word)]));
  const title = main.querySelector("h1")?.textContent.trim() || document.title;

  function collect(root, address) {
    const passages = [];
    for (const section of root.querySelectorAll(content)) {
      let id = section.id;
      let heading = "";
      for (const node of section.querySelectorAll("h2, h3, p, li, dt")) {
        if (node.closest("[hidden], details:not([open]), .yt")) continue;
        if (node.matches("h2, h3")) {
          if (node.id) id = node.id;
          heading = tidy(node.textContent);
          continue;
        }
        if (node.matches("li") && node.querySelector("p, li")) continue;
        const term = node.matches("dt") ? tidy(node.textContent) : "";
        const text = term ? tidy(node.nextElementSibling?.textContent || "") : tidy(node.textContent);
        if (text.length < 18) continue;
        const url = new URL(address);
        url.hash = id || "";
        url.search = "";
        passages.push({ text, term, heading, url: url.href, vocab: words(term + " " + text) });
      }
    }
    return passages;
  }

  const passages = collect(main, location.href);
  const headings = [...main.querySelectorAll(".lesson-grid > article.prose h2[id], .lesson-grid > article.prose h3[id]")];
  function activeSection() {
    const visible = headings.filter(heading => heading.getBoundingClientRect().top <= Math.min(230, innerHeight / 3));
    return visible.at(-1)?.id || "";
  }

  function findPassage(question, candidates, active) {
    const wanted = tokens(question).slice(0, 14);
    if (!wanted.length) return null;
    return candidates.map(entry => {
      const matched = wanted.filter(word => matches(word, entry.vocab));
      if (!matched.length || matched.length * 2 < wanted.length) return null;
      const name = tokens(entry.term).join(" ");
      const defined = name && wanted.join(" ") === name;
      const inHeading = words(entry.heading);
      const sameSection = active && new URL(entry.url).hash === "#" + active;
      const score = matched.length * 8 + (defined ? 9 : 0) +
        matched.filter(word => matches(word, inHeading)).length * 2 + (sameSection ? 3 : 0);
      return { ...entry, matched, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score)[0] || null;
  }

  let index;
  const related = async question => {
    if (!index) {
      const response = await fetch(new URL("search.json", site));
      if (!response.ok) return [];
      index = await response.json();
    }
    const wanted = tokens(question).slice(0, 14);
    const matchesIndex = index.map(item => {
      const vocabulary = words([item.t, item.s, ...(item.g || []), ...(item.h || [])].join(" "));
      return { item, score: wanted.filter(word => matches(word, vocabulary)).length };
    }).filter(({score}) => score && score * 2 >= wanted.length).sort((a, b) => b.score - a.score);
    return matchesIndex.slice(0, 4).map(({item}) => {
      const url = new URL(item.u, site);
      return { title: item.t, url };
    }).filter(({url}) => url.origin === site.origin && url.pathname.startsWith(site.pathname) &&
      url.pathname !== location.pathname);
  };

  function excerpt(entry) {
    if (entry.term) return entry.text;
    const sentences = entry.text.match(/[^.!?]+(?:[.!?]+|$)/g) || [entry.text];
    const scored = sentences.map((text, index) => ({
      index, score: entry.matched.filter(word => matches(word, words(text))).length
    })).sort((a, b) => b.score - a.score);
    const first = scored[0]?.index || 0;
    return tidy(sentences.slice(first, first + (sentences[first].length < 215 ? 2 : 1)).join(" ")).slice(0, 650);
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "tutor-btn";
  btn.textContent = "Chiedi a Gideon";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "gideon-tutor");
  const box = document.createElement("section");
  box.id = "gideon-tutor";
  box.className = "tutor";
  box.setAttribute("aria-labelledby", "gideon-tutor-title");
  box.hidden = true;
  box.innerHTML = `<header class="tutor-header"><h2 class="tutor-h" id="gideon-tutor-title">Chiedi a Gideon</h2>
<button type="button" class="tutor-close" aria-label="Chiudi Gideon">×</button></header>
<p class="tutor-context"></p>
<div class="tutor-selection" hidden><span>Testo selezionato incluso</span><button type="button">Rimuovi</button></div>
<form class="tutor-form">
<label for="tutor-q">Cosa vuoi capire?</label>
<textarea id="tutor-q" rows="2" maxlength="400" placeholder="Es. Che cos’è USMCA?"></textarea>
<div class="tutor-actions"><button type="submit" class="btn">Chiedi</button><button type="button" class="tutor-review chip" hidden>Fammi ripassare</button></div>
</form><div class="tutor-output" aria-live="polite" aria-atomic="true"></div>`;
  document.body.append(btn, box);
  const form = box.querySelector("form");
  const input = box.querySelector("textarea");
  const output = box.querySelector(".tutor-output");
  const context = box.querySelector(".tutor-context");
  const selectionLine = box.querySelector(".tutor-selection");
  const review = box.querySelector(".tutor-review");

  // Lascia liberi testo e flashcard durante lo scorrimento su telefono.
  const narrow = matchMedia("(max-width: 720px)");
  let lastY = scrollY, turnY = scrollY, direction = 0;
  addEventListener("scroll", () => {
    if (!narrow.matches) return;
    const y = scrollY, nextDirection = y > lastY ? 1 : y < lastY ? -1 : direction;
    if (nextDirection !== direction) { direction = nextDirection; turnY = lastY; }
    if (y < 80 || !box.hidden) btn.classList.remove("away");
    else if (direction > 0 && y - turnY >= 24) btn.classList.add("away");
    else if (direction < 0 && turnY - y >= 8) btn.classList.remove("away");
    lastY = y;
  }, { passive: true });
  btn.addEventListener("focus", () => btn.classList.remove("away"));
  narrow.addEventListener("change", () => { btn.classList.remove("away"); lastY = turnY = scrollY; direction = 0; });

  let selected = "";
  let section = "";
  let request = 0;
  function captureSelection() {
    const selection = getSelection();
    const inside = node => node?.parentElement?.closest(content);
    return selection && inside(selection.anchorNode) && inside(selection.focusNode) ?
      tidy(String(selection)).slice(0, 1200) : "";
  }
  function toggle(open) {
    if (!open) {
      request++;
      if (output.hasAttribute("aria-busy")) output.replaceChildren();
      output.removeAttribute("aria-busy");
    }
    box.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      section = activeSection();
      const heading = headings.find(item => item.id === section);
      context.textContent = heading ? title + " · " + tidy(heading.textContent) : title;
      selectionLine.hidden = !selected;
      input.focus();
    } else btn.focus();
  }
  btn.addEventListener("pointerdown", () => { if (box.hidden) selected = captureSelection(); });
  btn.addEventListener("click", event => {
    if (box.hidden && event.detail === 0) selected = captureSelection();
    toggle(box.hidden);
  });
  box.querySelector(".tutor-close").addEventListener("click", () => toggle(false));
  selectionLine.querySelector("button").addEventListener("click", () => {
    selected = "";
    selectionLine.hidden = true;
    input.focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !box.hidden) toggle(false);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const append = (tag, text, root = output) => {
    const element = document.createElement(tag);
    element.textContent = text;
    root.append(element);
    return element;
  };
  function showEntry(entry, question, label, selectedQuote) {
    output.replaceChildren();
    const quote = selectedQuote || excerpt(entry);
    const expansions = [...quote.matchAll(/\b([A-Z][A-Z0-9]{2,})\s*\(([^()]{4,120})\)/g)];
    const wanted = new Set(tokens(question));
    const expansion = expansions.find(([_, term]) => wanted.has(normalize(term)));
    append("strong", entry.term ? "Dal glossario" : label);
    if (expansion) append("p", expansion[1] + " sta per " + expansion[2] + ".");
    append("blockquote", quote);
    const a = append("a", entry.heading ? "Fonte: " + entry.heading : "Apri la fonte");
    a.href = entry.url;
    if (new URL(a.href).pathname === location.pathname) a.addEventListener("click", () => toggle(false));
  }
  async function ask(question) {
    const current = ++request;
    output.removeAttribute("aria-busy");
    if (!question && !selected) {
      output.textContent = "Scrivi una domanda o seleziona un passaggio della lezione.";
      input.focus();
      return;
    }
    const active = section || activeSection();
    const wanted = tokens(question);
    const chosen = selected ? passages.find(entry => entry.text.includes(selected)) : null;
    if (!wanted.length && chosen) {
      return showEntry(chosen, question, "Dal passaggio selezionato", selected);
    }
    const local = findPassage(question, passages, chosen ? new URL(chosen.url).hash.slice(1) : active);
    if (local) return showEntry(local, question, "Dalla pagina");
    if (!wanted.length && selected) {
      output.replaceChildren();
      append("strong", "Passaggio selezionato");
      append("blockquote", selected);
      return append("p", "Indica il termine o il punto che vuoi chiarire.");
    }
    output.setAttribute("aria-busy", "true");
    output.textContent = "Cerco nei materiali di Gideon…";
    let suggestions = [];
    let failed = false;
    try {
      suggestions = await related(question);
      let best;
      for (const {url} of suggestions.slice(0, 2)) {
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const doc = new DOMParser().parseFromString(await response.text(), "text/html");
        const found = findPassage(question, collect(doc, url.href), "");
        if (found && (!best || found.score > best.score)) best = found;
      }
      if (current !== request) return;
      output.removeAttribute("aria-busy");
      if (best) return showEntry(best, question, "Da un altro materiale di Gideon");
    } catch {
      failed = true;
    }
    if (current !== request) return;
    output.removeAttribute("aria-busy");
    output.replaceChildren();
    append("p", failed ? "La ricerca nel sito non è disponibile ora. Riprova o seleziona un passaggio." :
      "Non trovo un passaggio che risponda con sufficiente precisione. Prova con il termine della lezione o seleziona la frase.");
    if (suggestions.length) {
      const list = append("ul", "");
      for (const {title, url} of suggestions.slice(0, 3)) {
        append("a", title, append("li", "", list)).href = url.href;
      }
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); void ask(input.value.trim()); });
  const cards = [...main.querySelectorAll("#flashcard .card")];
  review.hidden = !cards.length;
  let cardIndex = 0;
  review.addEventListener("click", () => {
    request++;
    output.removeAttribute("aria-busy");
    const card = cards[cardIndex++ % cards.length];
    output.replaceChildren();
    append("strong", "Ripasso dalla lezione");
    append("p", tidy(card.querySelector(".front").textContent));
    const details = append("details", "");
    append("summary", "Mostra la risposta", details);
    append("p", tidy(card.querySelector(".back").textContent), details);
    append("a", "Apri le flashcard").href = "#flashcard";
    output.querySelector("a").addEventListener("click", () => toggle(false));
  });
})();
