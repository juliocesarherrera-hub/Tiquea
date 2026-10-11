const CACHE_NAME = 'tiquea-v5';

// Archivos requeridos para el arranque en frío sin internet
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// 1. Precargar obligatoriamente el App Shell al instalar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// 2. Activar y limpiar cachés anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Manejar peticiones de red
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a la API de Gemini y peticiones POST
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // SI ES UNA NAVEGACIÓN (Apertura de la app desde cero / Cold start)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/', responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // SIN INTERNET: Servir inmediatamente el index.html precargado
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // PARA OTROS RECURSOS (JS, CSS, Imágenes)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Actualizar en segundo plano si hay red
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});