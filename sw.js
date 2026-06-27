/* Service Worker — عمل بدون إنترنت + تحديث تلقائي للنسخ الجديدة */
const CACHE = "athkar-v44";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./data/adhkar.js",
  "./data/adhkar_extra.js",
  "./data/cards.js",
  "./data/hisn.js",
  "./data/deeds.js",
  "./data/quran.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/qr.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

function isAppShell(url) {
  return url.origin === self.location.origin && (
    url.pathname.endsWith("/") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".webmanifest")
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // ملفات التطبيق الأساسية: الشبكة أولًا ليظهر التحديث فورًا، مع الرجوع للكاش دون اتصال
  if (req.mode === "navigate" || isAppShell(url)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // باقي الموارد (صور، خطوط): الكاش أولًا للسرعة
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      if (res.ok && (url.origin === self.location.origin || req.url.includes("fonts"))) {
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
