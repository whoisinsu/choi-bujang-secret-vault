// 11단계 설치형 웹앱의 서비스 워커입니다. 오프라인 안내 화면과 아이콘만 저장합니다.
// /api/ 요청(메모·로그인·복원)과 메모 내용·토큰은 저장하지 않고 항상 네트워크로 보냅니다.
const CACHE = 'vault-shell-v1';
const SHELL = ['/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    // 화면은 항상 네트워크에서 받고, 연결이 끊겼을 때만 오프라인 안내를 보여 줍니다.
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((hit) => hit ?? fetch(event.request)));
  }
});
