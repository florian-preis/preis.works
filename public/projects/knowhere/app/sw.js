// Offline copy for knowhere.
//
// With a connection, the app always loads the live version, exactly as without this file, and a copy
// of every file is saved on the device as it goes. Without a connection (on a plane, say), the app
// opens from the saved copy. The app itself tells this file which files to save
// (see "Offline use" at the end of app.js), so there is no list to keep up to date here.
//
// To switch offline use off again: delete this file and the lines that register it. Browsers then
// drop the saved copy by themselves.
const CACHE = 'knowhere-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// The app sends the full list of its files once it has loaded. Files already saved are skipped,
// and saved files that are no longer on the list (from an older version) are removed.
self.addEventListener('message', (event) => {
  const list = event.data && event.data.save;
  if (!Array.isArray(list)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const wanted = new Set(list.map((u) => new URL(u, location.href).href));
    for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
    const urls = [...wanted];
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(async (url) => {
        try {
          if (await cache.match(url, { ignoreVary: true })) return;
          const res = await fetch(url);
          if (res.ok) await cache.put(url, res);
        } catch (e) { /* offline or missing: try again on the next visit */ }
      }));
    }
  })());
});

// Every request the app makes: the network first, and the saved copy when the network fails
// or takes longer than four seconds.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req, { ignoreSearch: req.mode === 'navigate', ignoreVary: true });
    const live = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    });
    if (!saved) return live;
    return Promise.race([live, new Promise((resolve) => setTimeout(() => resolve(saved), 4000))]).catch(() => saved);
  })());
});
