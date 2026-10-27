// عامل الخدمة: شبكة أولاً (التعديلات تظهر دائماً فور رفعها)، والنسخة المخزّنة عند انقطاع الإنترنت فقط
const CACHE = 'zayna-shell-v1';
const SHELL = ['offline.html', 'images/icon-192.png', 'css/style.css'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    if (new URL(req.url).origin !== location.origin) return;   // لا نتدخل في Firebase ولا المكتبات الخارجية
    e.respondWith(
        fetch(req).then(res => {
            if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
            return res;
        }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('offline.html') : Response.error())))
    );
});
