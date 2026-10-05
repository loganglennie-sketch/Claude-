/*
 * Lets the timesheet app open with no signal (live company addresses only).
 *   - Pages: tries the network first; with no signal, shows the last copy saved on the phone.
 *   - App files (scripts, styles, icons): saved on first use; their names change with every update.
 * Timesheet data isn't handled here: the app keeps that on the phone itself and sends it later.
 */
const VERSION = "v1";
const PAGES = `pages-${VERSION}`;
const FILES = `files-${VERSION}`;
const NETWORK_WAIT_MS = 5000; // weak signal: give up waiting and use the saved copy
const MAX_FILES = 300;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PAGES, FILES];
      for (const key of await caches.keys()) if (!keep.includes(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (url.pathname.startsWith("/_next/static/") || /^\/(icons|demo)\//.test(url.pathname)) {
    event.respondWith(fromPhoneFirst(request));
  } else if (request.mode === "navigate" || request.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(request));
  }
});

async function fromPhoneFirst(request) {
  const saved = await caches.match(request);
  if (saved) return saved;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(FILES);
    await cache.put(request, response.clone());
    trim(cache);
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then(async (response) => {
    // Only keep proper pages (not sign-in redirects or errors).
    if (response.ok && !response.redirected) await cache.put(request, response.clone());
    return response;
  });
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(() => reject(new Error("slow")), NETWORK_WAIT_MS))]);
  } catch {
    const saved = (await cache.match(request)) ?? (request.mode === "navigate" ? await cache.match(request, { ignoreSearch: true }) : undefined);
    if (saved) return saved;
    // Nothing saved for this page: keep waiting for the network, or explain if there is none.
    try {
      return await network;
    } catch {
      if (request.mode !== "navigate") return Response.error();
      return new Response(
        '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>No signal</title>' +
          '<body style="font-family:system-ui,sans-serif;padding:2rem;text-align:center;background:#F6F7FB;color:#1A2033">' +
          "<h1>No signal</h1><p>This page hasn't been opened on this phone before, so it needs signal the first time.</p>" +
          '<p><a href="/timesheet" style="color:#224596;font-weight:600">Go to your timesheet</a></p>',
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_FILES))) await cache.delete(key);
}
