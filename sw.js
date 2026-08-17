// 오프라인용 — 지하주차장·엘리베이터에서도 열려야 한다.
// 캐시 우선 + 백그라운드 갱신. 앱을 고치면 CACHE 이름의 숫자를 올린다.
const CACHE = "imjang-v2";
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
  e.respondWith(caches.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});
