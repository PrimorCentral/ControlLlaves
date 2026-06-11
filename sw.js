// Service Worker — Gestión de Flota · Primor
// Estrategia: network-first (siempre carga la versión más reciente)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  // Solo interceptar peticiones GET del mismo origen
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
