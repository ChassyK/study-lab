/* Gideon · area privata. Apre sealed.bin con il PIN (vedi tools/private.py).
   Il contenuto nel sito è cifrato: senza PIN giusto non c'è nulla da leggere, nemmeno nel codice della pagina.
   Dopo lo sblocco la chiave resta solo in questa scheda del browser (sessionStorage) e sparisce chiudendola. */
(() => {
  const form = document.getElementById("pv-form");
  if (!form) return;
  const input = document.getElementById("pv-pin");
  const msg = document.getElementById("pv-msg");
  const btn = form.querySelector("button");
  const root = document.documentElement;
  const KEY = "gideon:private";
  const ITER = Number(form.dataset.iter) || 600000;
  const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("is-bad", !!bad); };
  const b64 = { enc: u => btoa(String.fromCharCode(...u)), dec: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)) };

  if (!(window.crypto && crypto.subtle)) {
    root.classList.remove("pv-auto");
    say("This browser cannot open the private area. Use a recent browser over https.", true);
    return;
  }

  let blobP;
  const blob = () => blobP || (blobP = fetch(form.dataset.sealed, { cache: "no-store" }).then(r => {
    if (!r.ok) throw new Error("fetch");
    return r.arrayBuffer();
  }).then(b => new Uint8Array(b)));

  async function derive(pin, salt) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin.trim().toLowerCase()), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITER }, base, 512));
  }

  /* restituisce l'HTML in chiaro, oppure null se la chiave non è quella giusta */
  async function open(bytes, keys) {
    if (bytes.length < 68 || String.fromCharCode(...bytes.slice(0, 3)) !== "GS1") throw new Error("format");
    const iv = bytes.slice(19, 35), sig = bytes.slice(35, 67), ct = bytes.slice(67);
    const signed = new Uint8Array(32 + ct.length);
    signed.set(bytes.slice(3, 35)); signed.set(ct, 32);
    const mac = await crypto.subtle.importKey("raw", keys.slice(32), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!(await crypto.subtle.verify("HMAC", mac, sig, signed))) return null;
    const aes = await crypto.subtle.importKey("raw", keys.slice(0, 32), "AES-CBC", false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-CBC", iv }, aes, ct));
  }

  function show(page) {
    document.open();
    document.write(page);
    document.close();
  }

  async function unlock(pin) {
    const bytes = await blob();
    const keys = await derive(pin, bytes.slice(3, 19));
    const page = await open(bytes, keys);
    if (page === null) return false;
    try { sessionStorage.setItem(KEY, b64.enc(keys)); } catch {}
    show(page);
    return true;
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!input.value.trim()) { say("Enter the PIN.", true); input.focus(); return; }
    btn.disabled = true; say("Opening…");
    try {
      if (!(await unlock(input.value))) { say("Wrong PIN. Try again.", true); input.select(); }
    } catch {
      say("Could not load the page. Check the connection and try again.", true);
    }
    btn.disabled = false;
  });

  /* già sbloccata in questa scheda: riapre senza richiedere il PIN */
  (async () => {
    let saved = null;
    try { saved = sessionStorage.getItem(KEY); } catch {}
    if (saved) {
      try {
        const page = await open(await blob(), b64.dec(saved));
        if (page !== null) { show(page); return; }
      } catch {}
      try { sessionStorage.removeItem(KEY); } catch {}
    }
    root.classList.remove("pv-auto");
    input.focus({ preventScroll: true });
  })();
})();
