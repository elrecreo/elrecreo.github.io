/* Service worker de Centro Cristiano El Recreo.
   - Caché: la app abre sin internet y los datos de la Biblia se guardan al leerlos.
   - Notificaciones: clic para abrir la app y revisión periódica de «Nuevo evento» (Chrome/Android con la app instalada). */
const VERSION = 'rc-v3';
const SHELL = 'rc-shell-' + VERSION, DATOS = 'rc-datos-' + VERSION, ESTADO = 'rc-estado';
const PRECACHE = [
  './', 'index.html', 'config.js', 'css/estilos.css', 'css/app.css', 'manifest.webmanifest',
  'js/api.js', 'js/biblia.js', 'js/devocional-canvas.js', 'js/admin.js', 'js/privacidad.js',
  'js/app/datos.js', 'js/app/nucleo.js', 'js/app/biblia-datos.js', 'js/app/biblia-ui.js', 'js/app/pantallas.js', 'js/app/juego.js', 'js/app/radio.js', 'js/app/notif.js', 'js/app/arranque.js',
  'img/nav/biblia.png', 'img/nav/biblia_off.png', 'img/nav/devocionales.png', 'img/nav/devocionales_off.png', 'img/nav/video.png', 'img/nav/video_off.png', 'img/nav/juegos.png', 'img/nav/juegos_off.png', 'img/nav/menu_sandwich.png', 'img/nav/compartir.png', 'img/nav/escuchar.png', 'img/nav/pin.png', 'img/nav/dia.png', 'img/nav/noche.png',
  'img/iconos/icon-192.png', 'img/iconos/icon-512.png', 'img/iconos/logo-128.png', 'img/favicon.png', 'img/logo.png',
  'data/preguntas.json', 'data/famosos.json', 'sonidos/pin.mp3'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () { }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== SHELL && k !== DATOS && k !== ESTADO; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;       // Apps Script, YouTube, Drive, radio: siempre a la red
  const esDato = /\/data\/|\/img\/radio\/|\/img\/escuela\//.test(url.pathname);
  if (esDato) {   // caché primero (los datos casi no cambian)
    e.respondWith(caches.open(DATOS).then(function (c) { return c.match(req).then(function (r) { return r || fetch(req).then(function (res) { if (res.ok) c.put(req, res.clone()); return res; }); }); }));
    return;
  }
  // Resto: red primero (así un cambio publicado se ve enseguida) y caché si no hay conexión
  e.respondWith(fetch(req).then(function (res) { if (res.ok) { const copia = res.clone(); caches.open(SHELL).then(function (c) { c.put(req, copia); }); } return res; })
    .catch(function () { return caches.match(req, { ignoreSearch: true }).then(function (r) { return r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()); }); }));
});

// ── Notificaciones ──
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  const ruta = (e.notification.data && e.notification.data.ruta) || '#/biblia';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (const c of cs) { if ('focus' in c) { c.postMessage({ tipo: 'ir', ruta: ruta }); return c.focus(); } }
    return self.clients.openWindow('./' + ruta);
  }));
});

// La página nos pasa qué eventos ya vio / notificó para no repetir avisos
self.addEventListener('message', function (e) {
  if (e.data && e.data.tipo === 'estado') {
    e.waitUntil(caches.open(ESTADO).then(function (c) { return c.put('estado', new Response(JSON.stringify(e.data))); }));
  }
});

// Revisión periódica (solo Chrome/Android con la app instalada; el intervalo lo decide el navegador, ~12 h o más)
self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'rc-revisar') e.waitUntil(revisarEventos());
});
async function revisarEventos() {
  const c = await caches.open(ESTADO), r = await c.match('estado');
  if (!r) return;
  const st = await r.json();
  if (!st.activas || !st.init || !st.script) return;
  let json;
  try { const res = await fetch(st.script, { method: 'POST', body: JSON.stringify({ action: 'obtener_eventos' }) }); json = await res.json(); } catch (x) { return; }
  const ids = (json.eventos || []).filter(function (ev) { return ev.activo !== false && ev.id; }).map(function (ev) { return String(ev.id); });
  const nuevos = ids.filter(function (i) { return st.vistos.indexOf(i) < 0 && st.notificados.indexOf(i) < 0; });
  if (!nuevos.length) return;
  await self.registration.showNotification('Centro Cristiano el Recreo', { body: 'Nuevo evento publicado', tag: 'rc-evento-nuevo', icon: 'img/iconos/icon-192.png', badge: 'img/iconos/icon-192.png', data: { ruta: '#/eventos' } });
  st.notificados = st.notificados.concat(nuevos).slice(-300);
  await c.put('estado', new Response(JSON.stringify(st)));
}
