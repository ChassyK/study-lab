/* Local worksheets and optional practice timing. */
(() => {
  for (const workbench of document.querySelectorAll("[data-workbench]")) {
    const key = "gideon:assessment:" + workbench.dataset.workbench;
    const fields = [...workbench.querySelectorAll("[data-draft]")];
    const feedback = workbench.querySelector("[data-save-state]");
    const download = workbench.querySelector("[data-download]");
    const value = field => field.type === "checkbox" ? field.checked : field.value;
    const title = field => field.labels[0].textContent.trim();
    let available = true;
    try {
      const draft = JSON.parse(localStorage.getItem(key)) || {};
      for (const field of fields) {
        const saved = draft[field.dataset.draft];
        if (field.type === "checkbox") field.checked = saved === true;
        else if (typeof saved === "string") field.value = saved;
      }
    } catch { available = false; }
    const update = () => {
      const finished = fields.filter(field => field.type === "checkbox" && field.checked).length;
      const maximum = fields.filter(field => field.type === "checkbox").length;
      const words = fields.filter(field => field.type !== "checkbox")
        .reduce((sum, field) => sum + (field.value.trim().match(/\S+/g)?.length || 0), 0);
      workbench.querySelector("[data-word-count]").textContent = words + " parole nella scaletta";
      const message = (available ? "Salvata nel browser" : "Salvataggio locale non disponibile") +
        " · " + finished + "/" + maximum + " controlli";
      if (feedback.textContent !== message) feedback.textContent = message;
      download.disabled = !fields.some(field => value(field));
    };
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(Object.fromEntries(fields.map(field => [field.dataset.draft, value(field)]))));
        available = true;
      } catch { available = false; }
      update();
    };
    workbench.addEventListener("input", save);
    download.addEventListener("click", () => {
      const parts = ["# " + document.querySelector("main h1").textContent, ""];
      for (const field of fields) {
        if (field.type === "checkbox") parts.push(`- [${field.checked ? "x" : " "}] ${title(field)}`);
        else parts.push("## " + title(field), field.value, "");
      }
      const objectURL = URL.createObjectURL(new Blob([parts.join("\n")], {type: "text/markdown;charset=utf-8"}));
      const link = document.createElement("a");
      link.href = objectURL;
      link.download = workbench.dataset.workbench + "-scaletta.md";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
    });
    download.hidden = false;
    const hadDraft = fields.some(field => value(field));
    if (hadDraft || !available) update();
    else {
      download.disabled = true;
      workbench.querySelector("[data-word-count]").textContent = "0 parole nella scaletta";
    }
  }

  for (const timer of document.querySelectorAll("[data-timer]")) {
    const start = Number(timer.dataset.timer) * 1000;
    const control = timer.querySelector("[data-timer-toggle]");
    const display = timer.querySelector("[data-timer-output]");
    const status = timer.querySelector("[data-timer-state]");
    let remaining = start;
    let ends = null;
    let interval;
    const draw = () => {
      const seconds = Math.ceil(remaining / 1000);
      display.value = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
    };
    const stop = () => {
      clearInterval(interval);
      ends = null;
      control.textContent = remaining > 0 && remaining < start ? "Riprendi" : "Avvia 20 min";
    };
    function tick() {
      remaining = Math.max(0, ends - Date.now());
      draw();
      if (!remaining) {
        stop();
        status.textContent = "Tempo esaurito";
      }
    }
    control.addEventListener("click", () => {
      if (ends !== null) {
        tick();
        stop();
        if (remaining) status.textContent = "In pausa";
      } else {
        if (!remaining) remaining = start;
        ends = Date.now() + remaining;
        control.textContent = "Metti in pausa";
        status.textContent = "Timer avviato";
        draw();
        interval = setInterval(tick, 250);
      }
    });
    timer.querySelector("[data-timer-reset]").addEventListener("click", () => {
      remaining = start;
      stop();
      draw();
      status.textContent = "Timer azzerato";
    });
    timer.hidden = false;
  }
})();
