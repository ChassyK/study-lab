/* Gideon — ricerca nelle fonti pubblicate e prosecuzione facoltativa in ChatGPT. */
(() => {
  const home = document.querySelector(".brand");
  const main = document.querySelector("main");
  if (!home || !main) return;
  const site = new URL(home.href);
  const content = ".lesson-grid > article.prose, .brief, #glossario, .assessment-body";
  const tidy = value => value.replace(/\s+/g, " ").trim();
  const normalize = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ignored = new Set(("che chi cos cosa cosae significa significato frase passaggio paragrafo senso importante riferimento come quando dove quale quali perche per delle della dello degli nella nelle nello sono essere questo questa queste quello una uno nei nel alla allo del dai dal sul con fra tra suo sua gli anche piu fammi spiegami spiegare dimmi puoi vorrei devo capire vuol dire definizione fa fai posso possiamo possono potrei differenza differenze esempio esempi parole semplice semplici dettaglio effetti effettivamente altro facendo faccio approfondisci spiegazione what which when where how with from into does mean the and this that can tell about explain difference differences between was for are you please simple terms example examples impact could would should why give help il la di da al ai le lo mi tu he she is it si on of to a an un").split(" "));
  const aliases = new Map([
    ["tariff", "tariffs", "dazio", "dazi", "daziale", "daziali"],
    ["sanction", "sanctions", "sanzione", "sanzioni"],
    ["supply-chain", "filiera", "filiere"],
    ["resilience", "resilienza"],
    ["trade", "commercio", "commerciale", "commerciali"],
    ["import", "imports", "importazione", "importazioni"],
    ["export", "exports", "esportazione", "esportazioni"],
    ["company", "companies", "firma", "firm", "firms", "impresa", "imprese", "azienda", "aziende"],
    ["regulation", "regulations", "regolazione", "regolamento", "regolamenti"],
    ["national-security", "sicurezza-nazionale"],
    ["foreignness", "estraneita"],
    ["geoeconomics", "geoeconomia"],
    ["geopolitics", "geopolitica", "geopolitico", "geopolitici", "geopolitiche"],
    ["corruption", "corruzione"],
    ["bribery", "tangente", "tangenti"],
    ["risk", "risks", "rischio", "rischi"],
    ["evaluation", "valutazione", "valutare"],
    ["model", "models", "modello", "modelli"],
    ["dataset", "datasets"],
    ["training", "addestramento"],
  ].flatMap(group => group.map(word => [word, group[0]])));
  const tokens = value => {
    const normalized = normalize(value).replace(/\bsupply[\s-]+chains?\b/g, "supply-chain")
      .replace(/\b(?:national security|sicurezza nazionale)\b/g, "national-security");
    return [...new Set((normalized.match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || [])
      .filter(word => word.length >= 2 && !ignored.has(word))
      .map(word => aliases.get(word) || word))];
  };
  const stem = word => word.length >= 6 ? word.replace(/[aeios]$/, "") : word;
  const matches = (word, haystack) => haystack.has(word) || haystack.has(stem(word));
  const words = text => new Set(tokens(text).flatMap(word => [word, stem(word)]));
  const pageLanguage = main.lang || document.documentElement.lang || "it";
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
        passages.push(makePassage({ text, term, heading }, url, title, pageLanguage));
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

  function makePassage(entry, url, docTitle, lang, course = "") {
    return { ...entry, docTitle, lang, course, url: url.href, path: url.pathname, vocab: words(entry.term + " " + entry.text),
      topic: words(entry.term + " " + entry.heading + " " + docTitle) };
  }

  let corpus;
  function loadCorpus() {
    if (!corpus) {
      corpus = fetch(new URL("tutor-passages.json", site), { signal: AbortSignal.timeout(7000) })
        .then(response => {
          if (!response.ok) throw new Error("Indice del tutor non disponibile");
          return response.json();
        })
        .then(data => {
          if (data.version !== 1) throw new Error("Versione dell’indice sconosciuta");
          return data.documents.flatMap(doc => {
            const url = new URL(doc.url, site);
            if (url.origin !== site.origin || !url.pathname.startsWith(site.pathname)) return [];
            return doc.passages.map(entry => {
              const source = new URL(url);
              source.hash = entry.anchor;
              return makePassage(entry, source, doc.title, doc.lang, doc.course);
            });
          });
        })
        .catch(error => {
          corpus = null;
          throw error;
        });
    }
    return corpus;
  }

  function definitionScore(entry, matched) {
    if (entry.term) return matched.filter(word => matches(word, words(entry.term))).length;
    const subjects = entry.text.split(/[.!?;]\s+/).flatMap(sentence => {
      const definition = sentence.match(/^\s*(.{1,72}?)\s+(?:è|sono|significa|indica|is|are|means|refers to)\s+/iu);
      return definition ? [...words(definition[1])] : [];
    });
    const vocabulary = new Set(subjects);
    return matched.filter(word => matches(word, vocabulary)).length;
  }

  function rankPassages(query, candidates, active, language, define) {
    const frequencies = new Map(query.map(word => [word, 0]));
    for (const entry of candidates) {
      for (const word of query) {
        if (matches(word, entry.vocab)) frequencies.set(word, frequencies.get(word) + 1);
      }
    }
    const total = Math.max(candidates.length, 1);
    const weights = new Map(query.map(word => [word, 1 + Math.log((total + 1) / (1 + frequencies.get(word)))]));
    const fullWeight = query.reduce((sum, word) => sum + weights.get(word), 0);
    const pathname = location.pathname;
    return candidates.flatMap(entry => {
      const matched = query.filter(word => matches(word, entry.vocab));
      if (!matched.length) return [];
      const coverage = matched.reduce((sum, word) => sum + weights.get(word), 0) / fullWeight;
      if (coverage < .50 || matched.length < Math.min(2, query.length)) return [];
      const samePage = entry.path === pathname;
      const sameSection = samePage && active && new URL(entry.url).hash.slice(1) === active;
      const exactTerm = entry.term && tokens(entry.term).join(" ") === query.join(" ");
      const topicHits = matched.filter(word => matches(word, entry.topic)).length;
      const definitions = define ? definitionScore(entry, matched) * 3 : 0;
      const overview = entry.url.endsWith("#inbreve") ? -3 : 0;
      const score = coverage * 18 + definitions + overview + topicHits * 1.3 + (exactTerm ? 8 : 0) +
        (samePage ? 2 : 0) + (sameSection ? 1 : 0) + (entry.lang === language ? 3 : 0);
      return [{ ...entry, matched, coverage, score }];
    }).sort((a, b) => b.score - a.score);
  }

  function excerpt(entry) {
    if (entry.term || entry.text.length <= 650) return entry.text;
    const sentences = typeof Intl.Segmenter === "function" ?
      Array.from(new Intl.Segmenter(entry.lang === "en" ? "en" : "it", { granularity: "sentence" })
        .segment(entry.text), piece => piece.segment) :
      (entry.text.match(/[^.!?]+(?:[.!?]+|$)/g) || [entry.text]);
    // Include both sides of a comparison when they fall in neighbouring sentences.
    const windows = sentences.map((_, i) => tidy(sentences.slice(i, i + 3).join(" ")));
    const scored = windows.map(text => {
      const available = words(text);
      return { text, score: entry.matched.filter(word => matches(word, available)).length };
    }).sort((a, b) => b.score - a.score || a.text.length - b.text.length);
    const text = scored[0]?.text || entry.text;
    return text.length <= 780 ? text : text.slice(0, 779).replace(/\s+\S*$/, "") + "…";
  }

  function lessonLinks(entries) {
    const seen = new Set();
    return entries.filter(entry => {
      if (seen.has(entry.path)) return false;
      seen.add(entry.path);
      return true;
    });
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
<textarea id="tutor-q" rows="2" maxlength="800" placeholder="Es. Che differenza c’è tra dazio e sanzione?"></textarea>
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
      context.textContent = heading ? title + " · " + tidy(heading.textContent) :
        main.classList.contains("lesson") ? title : "Lezioni e altri materiali di Gideon";
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
  function answerLanguage(question) {
    if (/\b(?:in inglese|in english)\b/iu.test(question)
      || /^(?:what|why|how|when|where|which|explain|compare|can you|give me)\b/iu.test(question)) return "en";
    if (/\b(?:in italiano|in italian)\b/iu.test(question)) return "it";
    return pageLanguage === "en" ? "en" : "it";
  }

  function addSource(entry, root) {
    const label = entry.heading || entry.docTitle || "Apri la fonte";
    const a = append("a", label, root);
    a.href = entry.url;
    if (new URL(a.href).pathname === location.pathname) a.addEventListener("click", () => toggle(false));
  }

  function continueLink(question, language, entries, quote = "") {
    const url = new URL("https://chatgpt.com/");
    const instructions = language === "en"
      ? "Answer in plain English. Connect the answer to the cited course topics only where relevant. Cite verifiable sources for facts and distinguish course material from outside knowledge. If the evidence is incomplete, say what is uncertain."
      : "Rispondi in italiano chiaro, mantenendo i termini tecnici in inglese. Collega la risposta ai temi delle lezioni citate quando pertinente. Cita fonti verificabili per i fatti e distingui gli appunti dalle conoscenze esterne. Se manca evidenza, spiega cosa resta incerto.";
    const sources = entries.slice(0, 2).map(entry =>
      "- " + (entry.heading || entry.docTitle) + " · " + entry.url + "\n" + excerpt(entry).slice(0, 420));
    const prompt = [question || (language === "en" ? "Explain this passage." : "Spiega questo passaggio."),
      instructions, ...(quote ? ["Passaggio scelto: " + quote.slice(0, 450)] : []),
      ...(sources.length ? ["Materiali pubblici di Gideon:\n" + sources.join("\n\n")] : [])].join("\n\n");
    url.searchParams.set("q", prompt);
    const a = append("a", language === "en" ? "Continue with ChatGPT" : "Continua con ChatGPT");
    a.href = url.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "tutor-continue";
  }

  function showAnswer(best, related, question, language, selectedQuote = "") {
    output.replaceChildren();
    output.dataset.tutorResult = "answer";
    append("strong", best.term ? (language === "en" ? "From the glossary" : "Dal glossario") :
      (language === "en" ? "From the study materials" : "Dagli appunti"));
    const explain = append("p", selectedQuote || excerpt(best));
    explain.lang = best.lang;
    addSource(best, append("p", ""));
    if (related.length) {
      append("strong", language === "en" ? "Related course topics" : "Temi collegati nelle lezioni");
      const list = append("ul", "");
      for (const entry of related) {
        const li = append("li", "", list);
        addSource(entry, li);
        const quote = excerpt(entry);
        const snippet = quote.length > 290 ? quote.slice(0, 290).replace(/\s+\S*$/, "") + "…" : quote;
        append("p", snippet, li).lang = entry.lang;
      }
    }
    continueLink(question, language, [best, ...related], selectedQuote);
  }

  async function ask(question) {
    const current = ++request;
    const language = answerLanguage(question);
    delete output.dataset.tutorResult;
    output.removeAttribute("aria-busy");
    if (!question && !selected) {
      output.textContent = language === "en" ? "Enter a question or select a passage." :
        "Scrivi una domanda o seleziona un passaggio.";
      input.focus();
      return;
    }
    const wanted = tokens(question).slice(0, 18);
    const active = section || activeSection();
    const chosen = selected ? passages.find(entry => entry.text.includes(selected)) : null;
    if (!wanted.length && chosen) return showAnswer(chosen, [], question, language, selected);
    output.setAttribute("aria-busy", "true");
    output.textContent = language === "en" ? "Looking through the study materials…" : "Cerco nei materiali di Gideon…";
    let candidates = passages;
    let indexAvailable = true;
    if (wanted.length) {
      try {
        candidates = await loadCorpus();
        candidates = [...passages, ...candidates];
      } catch {
        indexAvailable = false;
      }
    }
    if (current !== request) return;
    output.removeAttribute("aria-busy");
    const define = /\b(?:difference|compare|define|definitions?|what is|what are|differenza|confronta|definisci|significa)\b/iu.test(question);
    const ranked = wanted.length ? rankPassages(wanted, candidates, active, language, define) : [];
    const [best, ...others] = lessonLinks(ranked.filter(item => item.coverage >= .57));
    if (best) {
      const related = others.filter(item => item.coverage >= Math.max(.62, best.coverage - .16)).slice(0, 2);
      return showAnswer(best, related, question, language);
    }
    output.replaceChildren();
    output.dataset.tutorResult = "fallback";
    if (language === "en") {
      append("p", indexAvailable ? "The study materials don’t provide a direct answer. Continue in ChatGPT for a broader explanation." :
        "The study index is temporarily unavailable. You can continue in ChatGPT.");
    } else {
      append("p", indexAvailable ? "I materiali del corso non contengono una risposta diretta. Puoi continuare in ChatGPT con la tua domanda." :
        "L’indice delle lezioni non è disponibile in questo momento. Puoi continuare in ChatGPT.");
    }
    const context = chosen ? [chosen] : [];
    if (chosen) addSource(chosen, append("p", language === "en" ? "Selected passage: " : "Passaggio selezionato: "));
    continueLink(question, language, context, chosen ? selected : "");
  }
  form.addEventListener("submit", event => { event.preventDefault(); void ask(input.value.trim()); });
  const cards = [...main.querySelectorAll("#flashcard .card")];
  review.hidden = !cards.length;
  let cardIndex = 0;
  review.addEventListener("click", () => {
    request++;
    output.removeAttribute("aria-busy");
    delete output.dataset.tutorResult;
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
