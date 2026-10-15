// Service Worker — Gestión de Flota · Primor
//
// Archivos propios de la app (html, js, css, version.json…): se pregunta
// SIEMPRE al servidor si han cambiado (cache: 'no-cache'). Si no han cambiado,
// el servidor contesta "304" y se usa la copia guardada (rápido); si han
// cambiado, se descarga el nuevo. Así no hace falta poner "?v=" en los archivos
// y basta con cambiar version.json para publicar una versión.
//
// Peticiones a otros sitios (CDN, Supabase…) se dejan tal cual.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).catch(() => caches.match(req))
  );
});
