/* Pantallas de contenido: Devocional, Videos, Eventos, Peticiones, Donaciones, Acerca de y Escuela. */
(function () {
  'use strict';
  const RC = window.RC, D = window.RCDATA, h = RC.h;

  function vacio(emoji, texto) { return h('div', { class: 'rc-vacio' }, h('span', { class: 'em', text: emoji }), texto); }
  function cargando() { return h('div', { class: 'rc-cargando' }, h('div', { class: 'rc-spin' })); }
  function reintentar(fn) { return h('div', { style: { textAlign: 'center', marginTop: '-20px' } }, h('button', { class: 'rc-btn sec', text: 'Reintentar', onclick: fn })); }

  // ═══════════════════ DEVOCIONAL (palabra del día = una imagen) ═══════════════════
  RC.ruta(/^devocional$/, { profundidad: 0, tab: 'devocional' }, function (ctx) {
    RC.barraRaiz();
    const pag = ctx.pagina;
    const cont = h('div', { class: 'rc-dev' });
    pag.appendChild(cont);
    let guardado = RC.leer('dev', null);   // { version, url }
    let blobListo = null, blobDe = null, fab = null;

    function pintar(d, animar) {
      cont.innerHTML = '';
      if (fab) { fab.remove(); fab = null; }
      if (!d) return;
      const img = h('img', { alt: 'Palabra del día', decoding: 'async' });
      const wrap = h('div', { class: 'rc-dev-img-wrap' }, img);
      cont.appendChild(wrap);
      RC.imagen(img, RC.urlsDrive(d.url, 1080), function () { wrap.style.minHeight = '0'; },
        function () { wrap.remove(); cont.appendChild(vacio('📖', 'No se pudo mostrar la imagen de la palabra del día.\nIntenta de nuevo más tarde.')); });
      fab = h('div', { class: 'rc-dev-fab' },
        h('button', { 'aria-label': 'Compartir palabra del día', html: RC.ico('compartir'), onclick: compartir }),
        h('span', { class: 'hint', text: 'Compartir' }));
      document.getElementById('recreo').appendChild(fab);
      prepararBlob(d);
    }
    async function prepararBlob(d) {
      if (blobDe === d.version) return;
      blobDe = d.version; blobListo = null;
      try { const b = await blobPublicadoParaCompartir(await obtenerBlobImagen(d.url)); if (blobDe === d.version) blobListo = b; } catch (e) { blobListo = null; blobDe = null; }
    }
    async function compartir() {
      const d = RC.leer('dev', null); if (!d) return;
      try {
        if (!blobListo) { RC.aviso('Preparando imagen…'); await prepararBlob(d); }
        if (!blobListo) throw new Error('No se pudo preparar la imagen');
        const r = await compartirImagen(blobListo, 'palabra-del-dia.jpg');
        if (r === 'descargado') RC.aviso('Tu navegador no comparte archivos: se descargó la imagen.', 'ok', 3400);
      } catch (e) {
        if (e && e.name === 'NotAllowedError') RC.aviso('Toca de nuevo el botón para compartir.', null, 3000);
        else RC.aviso('No se pudo compartir la imagen.', 'mal');
      }
    }
    ctx.alSalir(function () { if (fab) { fab.remove(); fab = null; } });

    async function sincronizar() {
      const conBarra = !guardado || RC.sync.debeBarra('devocional', RC.sync.BARRA_DEVOCIONAL);
      if (conBarra) { RC.sync.barra(); RC.sync.spinner(true); }
      try {
        const r = await RC.api('obtener_devocional');
        if (!ctx.vigente()) return;
        if (r.vacio || !r.version || !r.imagenUrl) { if (!guardado) { cont.innerHTML = ''; cont.appendChild(vacio('📖', 'Aún no hay una palabra del día publicada.')); } }
        else if (!guardado || guardado.version !== r.version) {
          guardado = { version: r.version, url: r.imagenUrl }; RC.guardar('dev', guardado); pintar(guardado);
        }
        RC.sync.marcar('devocional');
      } catch (e) {
        if (!ctx.vigente()) return;
        if (!guardado) { cont.innerHTML = ''; cont.appendChild(vacio('📖', e.red ? 'Sin conexión.\nConéctate a internet para ver la palabra del día.' : 'No se pudo cargar la palabra del día.\nIntenta de nuevo más tarde.')); cont.appendChild(reintentar(function () { cont.innerHTML = ''; cont.appendChild(cargando()); sincronizar(); })); }
      } finally { if (ctx.vigente()) RC.sync.spinner(false); }
    }
    if (guardado) pintar(guardado); else cont.appendChild(cargando());
    sincronizar();
  });

  // ═══════════════════ VIDEOS (feed vertical) ═══════════════════
  RC.ruta(/^videos$/, { profundidad: 0, tab: 'videos' }, function (ctx) {
    RC.barraRaiz();
    const pag = ctx.pagina, POR_PAGINA = 20;
    const cont = h('div', { class: 'rc-cont', style: { paddingTop: '10px' } });
    pag.appendChild(cont);
    let lista = RC.leer('videos', []), visibles = POR_PAGINA, jugando = null;

    function metaYoutube(id) {   // título y canal desde oEmbed (si el navegador lo permite)
      return fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (j) { return { titulo: (j.title || '').trim(), canal: (j.author_name || '').trim() }; });
    }
    function detener() { if (jugando) { const m = jugando; jugando = null; m.restaurar(); } }
    function tarjeta(v, i) {
      const media = h('div', { class: 'media', role: 'button', tabindex: '0', 'aria-label': 'Reproducir ' + (v.titulo || 'video') });
      const img = h('img', { alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', src: 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg' });
      const play = h('div', { class: 'play', html: '<span><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' });
      media.appendChild(img); media.appendChild(play);
      RC.imagen(img, ['https://i.ytimg.com/vi/' + v.id + '/maxresdefault.jpg', 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg'], null, function () { media.classList.add('sin-mini'); }, 300);
      const reproducir = function () {
        detener();
        const f = h('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1&rel=0&playsinline=1', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '', title: v.titulo || 'Video', referrerpolicy: 'strict-origin-when-cross-origin' });
        media.innerHTML = ''; media.appendChild(f); media.style.cursor = 'default';
        jugando = { restaurar: function () { media.innerHTML = ''; media.appendChild(img); media.appendChild(play); media.style.cursor = ''; } };
      };
      media.addEventListener('click', function () { if (!media.querySelector('iframe')) reproducir(); });
      media.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !media.querySelector('iframe')) reproducir(); });
      const tit = h('div', { class: 'tit', text: v.titulo || '' });
      const canal = h('b', { text: v.canal || D.APP_NOMBRE });
      const el = h('article', { class: 'rc-video' }, h('div', { class: 'cab' }, h('img', { src: 'img/iconos/logo-128.png', alt: '' }), canal), media, tit);
      return { el: el, tit: tit, canal: canal };
    }
    function pintar(animar) {
      detener(); cont.innerHTML = '';
      if (!lista.length) { cont.appendChild(vacio('🎬', 'Por ahora no hay videos para mostrar.')); return; }
      lista.slice(0, visibles).forEach(function (v, i) {
        const t = tarjeta(v, i); cont.appendChild(t.el);
        if (!v.titulo && !v.meta) {
          v.meta = true;
          metaYoutube(v.id).then(function (m) { v.titulo = m.titulo; v.canal = m.canal; t.tit.textContent = m.titulo; if (m.canal) t.canal.textContent = m.canal; RC.guardar('videos', lista); }).catch(function () { });
        }
      });
      if (lista.length > visibles) cont.appendChild(h('div', { class: 'rc-vermas' }, h('button', { class: 'rc-btn sec', text: 'Ver más', onclick: function () { visibles += POR_PAGINA; pintar(); } })));
      if (animar) RC.entrada(cont.querySelectorAll('.rc-video'), 0);
    }
    async function sincronizar() {
      const conBarra = !lista.length || RC.sync.debeBarra('videos', RC.sync.BARRA_VIDEOS);
      if (conBarra) { RC.sync.barra(); RC.sync.spinner(true); }
      try {
        const r = await RC.api('obtener_videos');
        if (!ctx.vigente()) return;
        const previos = lista, cache = {}; previos.forEach(function (v) { cache[v.id] = v; });
        const nuevos = [];
        (r.videos || []).forEach(function (o) {
          const id = (o.videoId && String(o.videoId).length === 11) ? o.videoId : idYoutube(o.url);
          if (!id || nuevos.some(function (x) { return x.id === id; })) return;
          const c = cache[id];
          nuevos.push({ id: id, titulo: (c && c.titulo) || o.titulo || '', canal: (c && c.canal) || o.canal || '' });
        });
        const cambio = JSON.stringify(nuevos.map(function (v) { return v.id; })) !== JSON.stringify(previos.map(function (v) { return v.id; }));
        lista = nuevos; RC.guardar('videos', lista);
        if (cambio || !cont.children.length) {
          const hayNuevoArriba = previos.length && nuevos.length && !previos.some(function (v) { return v.id === nuevos[0].id; });
          pintar(!previos.length);
          if (hayNuevoArriba) pag.scrollTo({ top: 0, behavior: 'smooth' });
        }
        RC.sync.marcar('videos');
      } catch (e) {
        if (!ctx.vigente()) return;
        if (!lista.length) { cont.innerHTML = ''; cont.appendChild(vacio('🎬', e.red ? 'Sin conexión.\nConéctate a internet para ver los videos.' : 'No se pudieron cargar los videos.\nIntenta de nuevo más tarde.')); cont.appendChild(reintentar(function () { cont.innerHTML = ''; cont.appendChild(cargando()); sincronizar(); })); }
      } finally { if (ctx.vigente()) RC.sync.spinner(false); }
    }
    if (lista.length) pintar(true); else cont.appendChild(cargando());
    sincronizar();
    ctx.alSalir(detener);
  });

  // ═══════════════════ EVENTOS ═══════════════════
  RC.ruta(/^eventos$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Eventos', derecha: [] });
    const pag = ctx.pagina;
    const cont = h('div', { class: 'rc-cont', style: { paddingTop: '10px' } });
    pag.appendChild(cont);
    let items = RC.leer('eventos', []);

    function visor(ev) {
      const img = h('img', { alt: ev.etiqueta, onclick: function () { img.classList.toggle('zoom'); } });
      const v = h('div', { class: 'rc-visor' }, h('div', { class: 'barra' },
        h('button', { class: 'rc-btn-ico', 'aria-label': 'Cerrar', html: RC.ico('cerrar'), onclick: function () { v.remove(); } }),
        h('button', { class: 'rc-btn-ico', 'aria-label': 'Compartir', html: RC.ico('compartir'), onclick: function () { compartirEvento(ev); } })),
        h('div', { class: 'lienzo' }, img));
      RC.$('#recreo').appendChild(v);
      RC.imagen(img, RC.urlsDrive(ev.imagenUrl, 2000), null, function () { img.alt = 'No se pudo cargar la imagen'; });
    }
    async function compartirEvento(ev) {
      try {
        const blob = await obtenerBlobImagen(ev.imagenUrl);
        const r = await compartirImagen(blob, nombreArchivo(ev.etiqueta, 'evento') + '.jpg');
        if (r === 'descargado') RC.aviso('Se descargó la imagen.', 'ok');
      } catch (e) { RC.compartirTexto(ev.etiqueta, ev.etiqueta, location.origin + location.pathname + '#/eventos'); }
    }
    function pintar() {
      cont.innerHTML = '';
      if (!items.length) { cont.appendChild(vacio('📅', 'Por ahora no hay eventos publicados.\nMuy pronto aquí verás los próximos servicios y actividades de la iglesia.')); return; }
      items.forEach(function (ev) {
        const img = h('img', { alt: ev.etiqueta, loading: 'lazy' });
        const fl = h('div', { class: 'fl', role: 'button', tabindex: '0', 'aria-label': 'Ver ' + ev.etiqueta, onclick: function () { visor(ev); }, onkeydown: function (e) { if (e.key === 'Enter') visor(ev); } }, img);
        RC.imagen(img, RC.urlsDrive(ev.imagenUrl, 1200), function () { fl.style.minHeight = '0'; }, function () { fl.remove(); });
        cont.appendChild(h('article', { class: 'rc-evento' }, fl, h('div', { class: 'et', text: ev.etiqueta })));
      });
      RC.entrada(cont.querySelectorAll('.rc-evento'), 0);
    }
    if (items.length) pintar(); else cont.appendChild(cargando());
    RC.sync.barra(); RC.sync.spinner(true);
    RC.eventos.obtener().then(function (lista) {
      if (!ctx.vigente()) return;
      RC.eventos.marcarVistos(lista.map(function (e) { return e.id; }));
      if (lista.length) { if (JSON.stringify(lista) !== JSON.stringify(items) || !cont.querySelector('.rc-evento')) { items = lista; pintar(); } }
      else if (!items.length) pintar();
    }).catch(function () {
      if (!ctx.vigente()) return;
      if (!items.length) { cont.innerHTML = ''; cont.appendChild(vacio('📅', 'No se pudieron cargar los eventos.\nRevisa tu conexión e intenta de nuevo.')); cont.appendChild(reintentar(function () { RC.reemplazar('#/eventos', 'fade'); location.reload(); })); }
    }).then(function () { if (ctx.vigente()) RC.sync.spinner(false); });
  });

  // ═══════════════════ PETICIONES DE ORACIÓN ═══════════════════
  RC.ruta(/^peticiones$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Peticiones', derecha: [] });
    const pag = ctx.pagina;
    const area = h('textarea', { class: 'rc-input', id: 'pet-texto', placeholder: 'Escribe aquí lo que quieres llevar en oración...', maxlength: '2000', 'aria-label': 'Tu petición' });
    const err = h('div', { class: 'estado mal', style: { minHeight: '18px', color: 'var(--mal)', fontSize: '12.3px', margin: '6px 0' }, role: 'alert' });
    const btn = h('button', { class: 'rc-btn ancho', text: 'Enviar petición' });
    const form = h('div', { class: 'rc-form-card' },
      h('div', { class: 'rc-hero-ico', style: { background: '#FF6B7A' }, html: RC.ico('peticiones') }), h('h1', { text: 'Peticiones' }),
      h('p', { class: 'sub', text: 'Cuéntanos lo que está en tu corazón.\nEstamos aquí para orar contigo.' }),
      h('div', { class: 'campo' }, h('label', { class: 'rc-etiqueta', for: 'pet-texto', text: 'TU PETICIÓN' }), area), err, btn);
    pag.appendChild(form);
    btn.addEventListener('click', async function () {
      const texto = area.value.trim();
      if (!texto) { err.textContent = 'Por favor escribe tu petición'; area.focus(); return; }
      err.textContent = ''; btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        await RC.api('peticion', { texto: texto });
        form.innerHTML = '';
        form.appendChild(h('div', { class: 'rc-check', html: RC.ico('check').replace('<svg', '<svg style="width:40px;height:40px;stroke:#fff;fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round"') }));
        form.appendChild(h('h1', { text: '¡Petición enviada!' }));
        form.appendChild(h('p', { class: 'sub', text: 'Tu petición será tomada por quienes corresponda en el menor tiempo posible.' }));
        form.appendChild(h('div', { class: 'rc-acciones-col' },
          h('button', { class: 'rc-btn', text: 'Agregar otra petición', onclick: function () { RC.reemplazar('#/peticiones', 'fade'); } }),
          h('button', { class: 'rc-btn sec', text: 'Salir', onclick: function () { RC.atras(); } })));
      } catch (e) {
        err.textContent = e.red ? 'No se pudo enviar: revisa tu conexión e inténtalo de nuevo. Tu texto sigue aquí.' : 'No se pudo enviar la petición. Inténtalo de nuevo.';
        btn.disabled = false; btn.textContent = 'Enviar petición';
      }
    });
    setTimeout(function () { area.focus({ preventScroll: true }); }, 300);
  });

  // ═══════════════════ DONACIONES ═══════════════════
  RC.ruta(/^donaciones$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Donaciones', derecha: [] });
    const fila = function (img, etiqueta, valor, sub, nombre) {
      return h('div', { class: 'rc-card rc-don' }, h('img', { src: img, alt: '' }),
        h('div', { class: 'd' }, h('small', { text: etiqueta }), h('b', { text: valor }), h('span', { text: sub })),
        h('button', { class: 'cp', text: 'Copiar', onclick: async function (e) { const ok = await RC.copiar(valor); RC.aviso(ok ? nombre + ' copiado ✓' : 'No se pudo copiar', ok ? 'ok' : 'mal'); } }));
    };
    ctx.pagina.appendChild(h('div', { class: 'rc-form-card' }, h('div', { class: 'rc-hero-ico', style: { background: '#34D6B8' }, html: RC.ico('donar') }), h('h1', { text: 'Donaciones' }),
      h('p', { class: 'sub', text: 'Gracias por sembrar en Centro Cristiano el Recreo.' }),
      fila('img/iconos/bre_b.png', 'Llave Bre-B', D.DONACION_LLAVE, 'Transferencia por Bre-B', 'Llave'),
      fila('img/iconos/bancolombia.png', 'Cuenta de ahorros Bancolombia', D.DONACION_CUENTA, 'Transferencia bancaria', 'Número de cuenta')));
  });

  // ═══════════════════ ACERCA DE ═══════════════════
  RC.ruta(/^acerca$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Sobre nuestra iglesia', derecha: [] });
    const p = function (t, c) { return h('p', { class: c || '', text: t }); };
    ctx.pagina.appendChild(h('div', { class: 'rc-acerca' },
      h('img', { class: 'logo', src: 'img/iconos/icon-192.png', alt: 'Logo Centro Cristiano el Recreo' }), h('h1', { text: 'Centro Cristiano el Recreo' }),
      h('h2', { text: '✦  ACERCA DE LA APP  ✦' }),
      p('Centro Cristiano el Recreo nació con un propósito sencillo y profundo: poner la Palabra de Dios en las manos de cada miembro de nuestra congregación, de una manera bella, accesible y siempre disponible.'),
      p('Con Centro Cristiano el Recreo puedes leer la Biblia en múltiples versiones, como RV1960, RVA2015, NVI, NTV, LBLA, etc; también disfrutar los devocionales diarios, explorar los videos y prédicas de nuestros pastores, y mucho más que seguimos construyendo con amor para ti.'),
      h('h2', { text: '✦  NUESTRA IGLESIA  ✦' }),
      p('La iglesia Centro Cristiano el Recreo es una congregación evangélica ubicada en el barrio El Recreo, en la Cl. 2 #35A-70, en la hermosa ciudad de Cartagena de Indias, Bolívar.'),
      p('Somos parte del Concilio de las Asambleas de Dios, y bajo la visión y el liderazgo de nuestros pastores principales,'),
      p('Ps. Jesús Blanco  &  Ps. Eimi Blanco', 'past'),
      p('…la iglesia Centro Cristiano el Recreo es hoy una congregación viva, en crecimiento, con un liderazgo que cada día se multiplica para servir mejor al Señor y a su pueblo.'),
      h('h2', { text: '✦  VISIÓN  ✦' }),
      p('Ser una iglesia que impacte las familias de la comunidad y sus alrededores, por medio del verdadero fundamento, Cristo.'),
      h('h2', { text: '✦  MISIÓN  ✦' }),
      p('Formar siervos competentes y capacitados con la doctrina Bíblica, teniendo como finalidad impactar y transformar nuestra sociedad con el evangelio.'),
      p('"Yo me alegré con los que me decían: A la casa de Jehová iremos."', 'cita'), p('Salmos 122:1', 'past'),
      h('div', { style: { marginTop: '18px' } },
        h('a', { class: 'enl', href: '#/privacidad', text: 'Política de privacidad' }),
        h('a', { class: 'enl', href: D.PLAY_STORE, target: '_blank', rel: 'noopener', text: 'App en Google Play' })),
      p('Versión web 1.0', 'ver')));
  });

  // ═══════════════════ ESCUELA BÍBLICA ═══════════════════
  RC.ruta(/^escuela$/, { profundidad: 1, tab: null, padre: '#/biblia' }, function (ctx) {
    RC.barra({ atras: true, titulo: 'Escuela Bíblica', derecha: [] });
    const grid = h('div', { class: 'rc-libros-esc' }, D.DISCIPULADOS.map(function (d, i) {
      return h('button', { class: 'rc-libro-esc', 'aria-label': d.titulo, onclick: function () { location.hash = '#/escuela/' + d.id; } },
        h('div', { class: 'port' }, h('img', { src: 'img/escuela/' + d.portada, alt: 'Portada ' + d.titulo }), h('span', { class: 'num', text: String(i + 1) })),
        h('b', { text: d.titulo }), h('small', { text: d.subtitulo }));
    }));
    ctx.pagina.appendChild(h('div', { class: 'rc-cont' }, h('div', { class: 'rc-h-sec', text: 'DISCIPULADOS' }), h('p', { class: 'rc-sub', text: 'Toca un libro para abrir su guía' }), grid));
    RC.entrada(grid.children, 0);
  });
  RC.ruta(/^escuela\/([\w-]+)$/, { profundidad: 2, tab: null, padre: '#/escuela' }, function (ctx, id) {
    const d = D.DISCIPULADOS.find(function (x) { return x.id === id; });
    if (!d) { location.replace('#/escuela'); return; }
    RC.barra({ atras: true, titulo: d.titulo, derecha: [] });
    const lista = h('div');
    d.guias.forEach(function (g) {
      lista.appendChild(h('div', { class: 'rc-guia' }, h('div', { class: 't' }, h('i', { text: g.n }), h('span', { text: g.t })),
        h('ul', null, g.s.map(function (s, i) { return h('li', null, h('em', { text: g.n + '.' + (i + 1) }), h('span', { text: s })); }))));
    });
    ctx.pagina.appendChild(h('div', { class: 'rc-cont' },
      h('div', { class: 'rc-guia-cab' }, h('img', { src: 'img/escuela/' + d.portada, alt: 'Portada ' + d.titulo }), h('div', null, h('h1', { text: d.titulo }), h('p', { text: d.subtitulo }))), lista));
    RC.entrada(lista.children, 0);
  });
})();
