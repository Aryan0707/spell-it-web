const MAX_BYTES = 2_000_000;
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname === "/api/sync/status" && request.method === "GET") return json({ sync: !!env.DB });
    if (url.pathname !== "/api/sync") return json({ error: "Not found" }, 404);
    if (!env.DB) return json({ error: "Sync storage is not configured" }, 503);
    if (!["GET", "PUT"].includes(request.method)) return json({ error: "Method not allowed" }, 405);
    // Same-origin API; neither authentication tokens nor encrypted data are cacheable.
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return json({ error: "Origin not allowed" }, 403);
    const auth = request.headers.get("Authorization") || "";
    if (!/^Bearer [a-f0-9]{64}$/.test(auth)) return json({ error: "Sync code required" }, 401);
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(auth));
    const vault = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
    try {
      if (request.method === "GET") {
        const row = await env.DB.prepare("SELECT revision, payload FROM vaults WHERE id = ?").bind(vault).first();
        return json(row ? { revision: row.revision, payload: JSON.parse(row.payload) } : { revision: 0, payload: null });
      }
      if (!request.headers.get("Content-Type")?.includes("application/json")) return json({ error: "JSON required" }, 415);
      if (Number(request.headers.get("Content-Length")) > MAX_BYTES) return json({ error: "Backup too large" }, 413);
      // Bound streamed bodies, including requests without Content-Length.
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "Missing payload" }, 400);
      const chunks = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return json({ error: "Backup too large" }, 413); }
        chunks.push(value);
      }
      const body = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      let parsed;
      try { parsed = JSON.parse(new TextDecoder().decode(body)); } catch { return json({ error: "Invalid JSON" }, 400); }
      const { revision, payload } = parsed;
      if (!Number.isSafeInteger(revision) || revision < 0 || !payload ||
        typeof payload.iv !== "string" || !/^[A-Za-z0-9+/]{16}$/.test(payload.iv) ||
        typeof payload.ciphertext !== "string" || payload.ciphertext.length < 24 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload.ciphertext)) {
        return json({ error: "Invalid encrypted payload" }, 400);
      }
      const stored = JSON.stringify({ iv: payload.iv, ciphertext: payload.ciphertext });
      let result;
      if (revision === 0) {
        result = await env.DB.prepare("INSERT OR IGNORE INTO vaults (id, revision, payload, updated_at) VALUES (?, 1, ?, ?)").bind(vault, stored, Date.now()).run();
      } else {
        // Compare and swap is atomic. A stale device must merge before retrying.
        result = await env.DB.prepare("UPDATE vaults SET revision = revision + 1, payload = ?, updated_at = ? WHERE id = ? AND revision = ?").bind(stored, Date.now(), vault, revision).run();
      }
      return result.meta.changes ? json({ revision: revision + 1 }) : json({ error: "Conflict" }, 409);
    } catch {
      return json({ error: "Sync is temporarily unavailable" }, 503);
    }
  },
};
