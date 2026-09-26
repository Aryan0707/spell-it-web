// Private-code sync: the encryption key never reaches the server.
(() => {
  "use strict";
  const CONFIG = "spellit_sync_v1";
  let code = localStorage.getItem(CONFIG) || "";
  let bridge, pending = null, running = false, generation = 0;
  let available = false;
  const encoder = new TextEncoder();
  const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
  const bytes = text => new Uint8Array(text.match(/../g).map(h => parseInt(h, 16)));
  const b64 = buffer => {
    const data = new Uint8Array(buffer);
    let str = "";
    for (let i = 0; i < data.length; i += 8192) str += String.fromCharCode(...data.subarray(i, i + 8192));
    return btoa(str);
  };
  const unb64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const digest = async text => hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text))));
  function status(text) { window.dispatchEvent(new CustomEvent("spellit-sync-status", { detail: { text, linked: !!code, available } })); }
  async function keyFor(secret) { return crypto.subtle.importKey("raw", bytes(secret), "AES-GCM", false, ["encrypt", "decrypt"]); }
  async function seal(snapshot, secret) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(secret), encoder.encode(JSON.stringify(snapshot)));
    return { iv: b64(iv), ciphertext: b64(ciphertext) };
  }
  async function unseal(payload, secret) {
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(payload.iv) }, await keyFor(secret), unb64(payload.ciphertext));
    return SpellLearning.validateSnapshot(JSON.parse(new TextDecoder().decode(plaintext)));
  }
  async function request(secret, method = "GET", body) {
    const response = await fetch("/api/sync", {
      method, cache: "no-store", signal: AbortSignal.timeout(12000),
      headers: { Authorization: `Bearer ${await digest("spellit-auth:" + secret)}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 409) return { conflict: true };
    if (!response.ok) throw new Error(response.status === 429 ? "Sync is busy. Please try again later." : "Sync couldn't connect. Your progress is saved on this device.");
    return response.json();
  }
  async function sync() {
    if (!code || !bridge || running || bridge.isBusy() || !navigator.onLine) return;
    running = true;
    const secret = code, expected = generation;
    status("Syncing…");
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await request(secret);
        const remoteSnapshot = remote.payload ? await unseal(remote.payload, secret) : null;
        if (code !== secret || expected !== generation || bridge.isBusy()) return;
        const local = bridge.snapshot();
        const merged = remoteSnapshot ? SpellLearning.mergeSnapshots(local, remoteSnapshot) : local;
        if (remoteSnapshot && JSON.stringify(merged) === JSON.stringify(remoteSnapshot)) {
          bridge.apply(merged); status("Up to date"); return;
        }
        const payload = await seal(merged, secret);
        if (code !== secret || expected !== generation || bridge.isBusy()) return;
        const result = await request(secret, "PUT", { revision: remote.revision, payload });
        if (result.conflict) continue;
        // Keep edits made while the network request was in flight.
        if (code !== secret || expected !== generation) return;
        if (!bridge.isBusy()) bridge.apply(SpellLearning.mergeSnapshots(merged, bridge.snapshot()));
        else schedule();
        status("Synced just now");
        return;
      }
      throw new Error("Another device is updating. Your changes are safe here; try syncing again shortly.");
    } catch (error) { status(error.message || "Sync unavailable. Your progress is saved here."); }
    finally { running = false; }
  }
  function schedule() { clearTimeout(pending); pending = setTimeout(sync, 1500); }
  async function check() {
    try {
      const r = await fetch("/api/sync/status", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      available = r.ok && (await r.json()).sync === true;
    } catch { available = false; }
    status(available ? (code ? "Ready to sync" : "Sync is ready on this site") : "Automatic sync isn't enabled on this host yet. Backup and restore are available now.");
    return available;
  }
  async function connect(value) {
    if (!available) throw new Error("Automatic sync is not enabled on this host yet.");
    const secret = value.trim().toLowerCase().replace(/\s/g, "");
    if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Paste the complete 64-character sync code from your other device.");
    const remote = await request(secret);
    if (!remote.payload) throw new Error("No progress found for that code. Create a code on your first device and sync it before linking.");
    await unseal(remote.payload, secret);
    generation++;
    code = secret; localStorage.setItem(CONFIG, code);
    await sync();
  }
  async function create() {
    if (!available) throw new Error("Automatic sync is not enabled on this host yet.");
    if (!code) {
      code = hex(crypto.getRandomValues(new Uint8Array(32)));
      localStorage.setItem(CONFIG, code); generation++;
    }
    await sync();
    return code;
  }
  function disconnect() {
    generation++; code = ""; localStorage.removeItem(CONFIG); clearTimeout(pending);
    status("Disconnected. Your progress is still saved on this device.");
  }
  function init(adapter) {
    bridge = adapter;
    window.addEventListener("spellit-change", schedule);
    window.addEventListener("online", () => { check().then(() => sync()); });
    window.addEventListener("offline", () => status("Offline. Changes will sync when you reconnect."));
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) sync(); });
    setInterval(() => { if (!document.hidden) sync(); }, 60000);
    check().then(() => sync());
  }
  window.SpellSync = { init, check, sync, schedule, create, connect, disconnect, getCode: () => code, seal, unseal };
})();
