/* 離線快取：第一次打開時把程式、中文辨識資料存起來，之後沒有網絡也可以用 */
const VERSION = 'pf-v6';
const PRECACHE = [
  './', 'index.html', 'js/app.js', 'js/parser.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'lang/chi_sim.traineddata',
  'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract-core/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract-core/tesseract-core-lstm.wasm.js',
  'vendor/opencc/full.js', 'vendor/jspdf/jspdf.umd.min.js',
  'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js',
  'vendor/fonts/lxgw-wenkai-tc.css', 'template/form.pdf',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const FRESH = /\/(index\.html|js\/[^/]+\.js|manifest\.webmanifest)?$/;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !fonts) return;
  if (same && (req.mode === 'navigate' || FRESH.test(url.pathname))) {
    // 主程式：先試網絡（有更新就用新版），失敗才用快取
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((m) => m || caches.match('index.html'))));
    return;
  }
  // 其他檔案（程式庫、辨識資料、字型、圖示）：先用快取
  e.respondWith(caches.match(req).then((m) => m || fetch(req).then((r) => {
    if (r.ok || r.type === 'opaque') { const cp = r.clone(); caches.open(VERSION).then((c) => c.put(req, cp)); }
    return r;
  })));
});
