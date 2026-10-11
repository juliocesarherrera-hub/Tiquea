self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Ignorar peticiones a la API o métodos POST para que los datos móviles no las bloqueen
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
});