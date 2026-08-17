// 오프라인용 — 지하주차장·엘리베이터에서도 열려야 한다.
// 네트워크 우선, 실패하면 캐시. (캐시 우선으로 하면 앱을 고쳐도 폰에 옛 버전이 계속 떴다.)
const CACHE = "imjang-v5";
const SHELL = ["./", "./index.html", "./lib.js", "./sync.js", "./data/checklist.js", "./manifest.json", "./icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== location.origin) return;   // 깃허브 API 응답은 절대 캐시하지 않는다
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match("./index.html")))
  );
});
