/* 명제 탐구 노트 — 서비스 워커
   항상 "네트워크 먼저": 인터넷이 되면 늘 최신 화면을 보여 주고,
   인터넷이 끊겼을 때만 저장해 둔 화면을 꺼내 씁니다.
   (옛 버전이 남아 앱이 고장 나는 일을 막기 위한 방식입니다.) */
const VER = '2026-10-22c';
const CACHE = 'myeongje-' + VER;
const CORE = [
  './', './index.html', './board.html', './qr.html',
  './manifest.webmanifest', './board.webmanifest', './qr.png', './qrcode.min.js',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
  './board-192.png', './board-512.png', './board-maskable-512.png', './board-apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CORE.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('myeongje-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // 제출(POST)은 건드리지 않음
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // 구글 시트·폰트 등 외부는 그대로
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const home = await caches.match('./index.html', { ignoreSearch: true });
        if (home) return home;
      }
      throw err;
    }
  })());
});
