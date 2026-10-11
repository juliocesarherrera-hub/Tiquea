const CACHE_NAME = 'tiquea-cache-v2';

// Archivos esenciales para que la app cargue sin red
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

// 1. Guardar archivos en memoria al instalar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Limpiar versiones viejas de caché
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Estrategia de red/caché
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a la API o métodos POST para no bloquear Gemini ni datos móviles
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  // Intentar cargar por red; si no hay internet, responder con el caché guardado
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then((response) => {
        if (response) return response;
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});