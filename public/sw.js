// PDFCraft Service Worker - PWA & Share Target File Opener Handler
const CACHE_NAME = 'pdfcraft-v1';
const SHARED_CACHE = 'pwa-shared-files';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Android / PWA Share Target POST
  if (event.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');
        if (file) {
          const cache = await caches.open(SHARED_CACHE);
          const headers = new Headers();
          headers.append('x-filename', encodeURIComponent(file.name || 'shared-file'));
          headers.append('content-type', file.type || 'application/octet-stream');
          
          await cache.put('/shared-file', new Response(file, { headers }));
        }
      } catch (err) {
        console.error('Error handling shared file in ServiceWorker:', err);
      }
      return Response.redirect('/?shared=true', 303);
    })());
    return;
  }
});

