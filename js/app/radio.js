/* Radio: el audio vive fuera de las pantallas, así que sigue sonando mientras navegas.
   MediaSession muestra los controles en la pantalla de bloqueo / notificación del navegador (anterior, siguiente, pausa). */
(function () {
  'use strict';
  const RC = window.RC, D = window.RCDATA, h = RC.h;
  const E = D.ESTACIONES;
  const audio = new Audio(); audio.preload = 'none';
  let actual = Math.max(0, Math.min(E.length - 1, RC.leer('estacion', 0)));
  let estado = 'detenido';   // detenido | conectando | suena
  let mini = null, pantalla = null;

  const R = RC.radio = {
    suena: function () { return estado === 'suena' || estado === 'conectando'; },
    estado: function () { return estado; },
    actual: function () { return actual; },
    elegir: function (i, reproducir) { actual = (i + E.length) % E.length; RC.guardar('estacion', actual); if (reproducir || R.suena()) R.reproducir(); else { emitir(); } },
    reproducir: function () {
      estado = 'conectando'; emitir();
      audio.src = E[actual].url;
      const p = audio.play();
      if (p && p.catch) p.catch(function (e) { if (e && e.name === 'AbortError') return; fallo(); });
      sesion();
    },
    detener: function () { audio.pause(); audio.removeAttribute('src'); audio.load(); estado = 'detenido'; emitir(); },
    alternar: function () { if (R.suena()) R.detener(); else R.reproducir(); },
    siguiente: function () { R.elegir(actual + 1, true); },
    anterior: function () { R.elegir(actual - 1, true); }
  };
  function fallo() {
    if (estado === 'detenido') return;
    estado = 'detenido'; emitir(); RC.aviso('No se pudo conectar con la emisora. Revisa tu conexión o prueba otra.', 'mal', 3600);
  }
  audio.addEventListener('playing', function () { estado = 'suena'; emitir(); });
  audio.addEventListener('waiting', function () { if (estado === 'suena') { estado = 'conectando'; emitir(); } });
  audio.addEventListener('error', function () { if (audio.getAttribute('src')) fallo(); });
  audio.addEventListener('stalled', function () { if (estado === 'suena') { estado = 'conectando'; emitir(); } });

  function sesion() {
    if (!('mediaSession' in navigator)) return;
    const e = E[actual];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: e.nombre, artist: 'Radio en vivo' + (e.frec ? ' · ' + e.frec : ''), album: D.APP_NOMBRE, artwork: [{ src: 'img/radio/' + e.img + '.jpg', sizes: '720x360', type: 'image/jpeg' }, { src: 'img/iconos/icon-512.png', sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('play', function () { R.reproducir(); });
      navigator.mediaSession.setActionHandler('pause', function () { R.detener(); });
      navigator.mediaSession.setActionHandler('stop', function () { R.detener(); });
      navigator.mediaSession.setActionHandler('previoustrack', function () { R.anterior(); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { R.siguiente(); });
    } catch (x) { }
  }
  function emitir() {
    if ('mediaSession' in navigator) { try { navigator.mediaSession.playbackState = estado === 'suena' ? 'playing' : (estado === 'detenido' ? 'none' : 'paused'); } catch (x) { } }
    if (estado !== 'detenido') sesion();
    pintarMini(); if (pantalla) pantalla();
  }

  // ── mini reproductor (visible fuera de la pantalla de radio) ──
  function pintarMini() {
    const ruta = RC.rutaActual && RC.rutaActual(), enRadio = ruta && ruta.path === 'radio';
    const root = RC.$('#recreo'); if (!root) return;
    if (!R.suena() || enRadio || (ruta && /^biblia\/\d+\/\d+$/.test(ruta.path))) { if (mini) { mini.remove(); mini = null; } return; }
    const e = E[actual], sinNav = ruta && (ruta.r.o.profundidad || 0) > 0;
    if (!mini) {
      mini = h('div', { class: 'rc-mini-radio', role: 'region', 'aria-label': 'Radio' });
      root.appendChild(mini);
    }
    mini.className = 'rc-mini-radio' + (sinNav ? ' sin-nav' : '');
    mini.innerHTML = '';
    mini.appendChild(h('img', { src: 'img/radio/' + e.img + '.jpg', alt: '' }));
    mini.appendChild(h('div', { class: 'n', role: 'button', tabindex: '0', onclick: function () { location.hash = '#/radio'; } }, h('small', { text: estado === 'conectando' ? 'CONECTANDO…' : 'EN VIVO' }), e.nombre));
    mini.appendChild(h('button', { class: 'rc-btn-ico', 'aria-label': 'Detener radio', html: RC.ico('pausa'), onclick: function () { R.detener(); } }));
  }
  RC.alCambiarRuta(function () { pintarMini(); });

  // ── pantalla de radio ──
  RC.ruta(/^radio$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Radio', derecha: [] });
    const eq = function () { return h('span', { class: 'rc-eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')); };
    const banner = h('img', { alt: '' }), envivo = h('div', { class: 'envivo', text: 'EN VIVO' });
    const nombre = h('h2'), sub = h('p'), btnPlay = h('button', { class: 'rc-btn-ico rc-play', onclick: function () { R.alternar(); } });
    const root = h('div', { class: 'rc-radio' },
      h('div', { class: 'banner' }, banner, envivo),
      h('div', { class: 'info' }, h('small', { text: 'REPRODUCIENDO AHORA' }), nombre, sub),
      h('div', { class: 'rc-ctl' },
        h('button', { class: 'rc-btn-ico', 'aria-label': 'Emisora anterior', html: RC.ico('ant'), onclick: function () { R.anterior(); } }), btnPlay,
        h('button', { class: 'rc-btn-ico', 'aria-label': 'Emisora siguiente', html: RC.ico('sig'), onclick: function () { R.siguiente(); } })),
      h('h3', { class: 'sec', text: 'CANALES DISPONIBLES' }));
    const tarjetas = E.map(function (e, i) {
      const t = h('button', { class: 'rc-est', onclick: function () { if (i === R.actual() && R.suena()) return; R.elegir(i, true); } },
        h('img', { src: 'img/radio/' + e.img + '.jpg', alt: '', loading: 'lazy' }), h('div', { class: 'n' }, e.nombre, e.frec ? h('small', { text: e.frec }) : null), eq());
      root.appendChild(t); return t;
    });
    ctx.pagina.appendChild(root);
    function pintar() {
      const e = E[R.actual()], st = R.estado();
      banner.src = 'img/radio/' + e.img + '.jpg'; nombre.textContent = e.nombre;
      sub.textContent = st === 'conectando' ? 'Conectando...' : st === 'suena' ? (e.frec || 'En vivo') : (e.frec ? e.frec + ' · Detenido' : 'Detenido');
      root.classList.toggle('suena', st === 'suena');
      btnPlay.innerHTML = RC.ico(R.suena() ? 'pausa' : 'play'); btnPlay.setAttribute('aria-label', R.suena() ? 'Detener' : 'Reproducir');
      tarjetas.forEach(function (t, i) { t.classList.toggle('act', i === R.actual() && R.suena()); t.classList.toggle('suena', st === 'suena'); });
    }
    pantalla = pintar; pintar();
    ctx.alSalir(function () { pantalla = null; });
  });
})();
