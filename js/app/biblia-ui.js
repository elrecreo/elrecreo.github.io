/* Pantallas de la Biblia: libros (con búsqueda y voz), capítulos y lectura de versículos
   (resaltado, compartir, escuchar, fijar, Biblia de estudio, tamaño de letra, versiones). */
(function () {
  'use strict';
  const RC = window.RC, D = window.RCDATA, h = RC.h, B = RC.biblia;

  function consulta() {
    const q = (location.hash.split('?')[1] || '');
    const p = new URLSearchParams(q); return p;
  }

  /** Centra un elemento dentro de su panel con scroll (scrollIntoView movería también los contenedores con overflow:hidden). */
  function centrar(panel, el, suave, fraccion) {
    const pr = panel.getBoundingClientRect(), er = el.getBoundingClientRect();
    panel.scrollTo({ top: panel.scrollTop + er.top - pr.top - (pr.height - er.height) * (fraccion == null ? 0.4 : fraccion), behavior: suave ? 'smooth' : 'auto' });
  }

  // ═══════════════════ Versículos fijados (tarjetas arrastrables) ═══════════════════
  const fijados = [];
  let capaPins = null;
  function renderPins() {
    if (!capaPins) { capaPins = h('div', { class: 'rc-pins', id: 'rc-pins' }); RC.$('#rc-main').appendChild(capaPins); }
    capaPins.innerHTML = '';
    fijados.forEach(function (f, i) {
      const card = h('div', { class: 'rc-pin', style: { bottom: 'calc(' + (92 + i * 124) + 'px + env(safe-area-inset-bottom, 0px))' } },
        h('div', { class: 'f' }, h('b', { text: f.referencia }),
          h('button', { class: 'x', 'aria-label': 'Quitar versículo fijado', text: '×', onpointerdown: function (e) { e.stopPropagation(); }, onclick: function (e) { e.stopPropagation(); fijados.splice(fijados.indexOf(f), 1); renderPins(); } })),
        h('p', { text: f.texto.length > 180 ? f.texto.slice(0, 180) + '...' : f.texto }));
      // arrastrar
      let sx, sy, tx = 0, ty = 0, mov = false;
      card.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; mov = true; card.setPointerCapture(e.pointerId); });
      card.addEventListener('pointermove', function (e) { if (!mov) return; card.style.transform = 'translate(' + (tx + e.clientX - sx) + 'px,' + (ty + e.clientY - sy) + 'px)'; });
      card.addEventListener('pointerup', function (e) { mov = false; tx += e.clientX - sx; ty += e.clientY - sy; });
      card.addEventListener('dblclick', function () { location.hash = '#/biblia/' + f.libroId + '/' + f.capitulo + '?v=' + f.versiculo; });
      capaPins.appendChild(card);
    });
  }
  RC.alCambiarRuta(function (res) {
    const enBiblia = res.r.o.tab === 'biblia';
    if (capaPins) capaPins.style.display = enBiblia ? '' : 'none';
    if (!capaPins && enBiblia && fijados.length) renderPins();
  });

  // ═══════════════════ Libros ═══════════════════
  RC.ruta(/^biblia$/, { profundidad: 0, tab: 'biblia' }, function (ctx) {
    RC.barraRaiz();
    const pag = ctx.pagina;
    let micOn = false, rec = null, reiniciar = false, sugs = [], overlay = null, debounce = null, ultimoTexto = '';

    const input = h('input', { type: 'search', placeholder: 'Buscar libros o versículos', 'aria-label': 'Buscar libros o versículos', autocomplete: 'off', enterkeyhint: 'search' });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btnMic = h('button', { class: 'rc-mic', 'aria-label': 'Buscar por voz', title: 'Buscar por voz', html: RC.ico('mic'), onclick: alternarVoz });
    const barraBuscar = h('div', { class: 'rc-buscar', style: { position: 'sticky', top: '0' } }, h('div', { class: 'caja' }, h('span', { html: RC.ico('buscar'), style: { display: 'contents' } }), input), btnMic);
    const listaWrap = h('div', { class: 'rc-cont' });
    pag.appendChild(barraBuscar); pag.appendChild(listaWrap);

    function pintarLibros(filtro) {
      listaWrap.innerHTML = '';
      const ul = B.ultimaLectura();
      const f = RC.norm(filtro || '');
      if (!f && ul) {
        const l = RC.libro(ul.l);
        listaWrap.appendChild(h('button', { class: 'rc-continuar', onclick: function () { location.hash = '#/biblia/' + ul.l + '/' + ul.c; } },
          h('div', null, h('small', { text: 'CONTINUAR LEYENDO' }), h('b', { text: l.nombre + ' ' + ul.c })), h('span', { html: RC.ico('adelante'), style: { display: 'contents' } })));
      }
      [[1, 'Antiguo Testamento'], [2, 'Nuevo Testamento']].forEach(function (g) {
        const libros = D.LIBROS.filter(function (l) { return l.test === g[0] && (!f || RC.norm(l.nombre).indexOf(f) >= 0 || RC.norm(l.abrev) === f); });
        if (!libros.length) return;
        listaWrap.appendChild(h('div', { class: 'rc-test', text: g[1] }));
        const grid = h('div', { class: 'rc-libros' }, libros.map(function (l) {
          return h('button', { class: 'rc-libro', onclick: function () { location.hash = '#/biblia/' + l.id; } },
            h('span', { class: 'ab', text: l.abrev }), h('span', { class: 'nom', text: l.nombre }), h('span', { class: 'cap', text: l.caps + (l.caps === 1 ? ' cap.' : ' caps.') }));
        }));
        listaWrap.appendChild(grid);
      });
      if (!listaWrap.querySelector('.rc-libro') && f) listaWrap.appendChild(h('div', { class: 'rc-vacio', text: 'No hay libros con ese nombre.\nSi buscas un versículo, sigue escribiendo.' }));
      RC.entrada(listaWrap.querySelectorAll('.rc-libro'), 0);
    }
    pintarLibros('');

    // ── búsqueda por texto ──
    input.addEventListener('focus', function () { B.precargarBusqueda(); });
    input.addEventListener('input', function () {
      const t = input.value.trim();
      pintarLibros(t);
      clearTimeout(debounce);
      if (t.length < 3) return;
      debounce = setTimeout(function () { procesar(t, true); }, 200);
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { input.blur(); } });

    async function procesar(texto, deTecleo) {
      try {
        const s = await B.sugerir(texto);
        if (!ctx.vigente()) return;
        if (s) agregarSug(s);
        else if (deTecleo && !sugs.length && texto.length >= 10) mostrarOverlay(true);
      } catch (e) { console.error(e); RC.aviso('No se pudo buscar. Revisa tu conexión.', 'mal'); }
    }
    function agregarSug(s) {
      const i = sugs.findIndex(function (x) { return x.referencia === s.referencia; });
      if (i >= 0) sugs.splice(i, 1);
      sugs.unshift(s);
      mostrarOverlay(false);
    }
    function mostrarOverlay(sin) {
      if (!overlay) {
        overlay = h('div', { class: 'rc-sugs', style: { top: '62px' } });
        RC.$('#rc-main').appendChild(overlay);
      }
      overlay.innerHTML = '';
      const lista = h('div', { class: 'lista' });
      if (sin && !sugs.length) lista.appendChild(h('div', { class: 'sin', text: 'Sin resultados. Prueba con otras palabras o con una cita como «Juan 3:16».' }));
      sugs.forEach(function (s) {
        const t = s.texto.length > 120 ? s.texto.slice(0, 120) + '...' : s.texto;
        lista.appendChild(h('button', { class: 'rc-sug', onclick: function () { cerrarTodo(); location.hash = '#/biblia/' + s.libroId + '/' + s.capitulo + '?v=' + s.versiculo; } },
          h('b', { text: s.referencia }), h('span', { text: '“' + t + '”' })));
      });
      lista.appendChild(h('button', { class: 'cerrar-todo', text: 'Cerrar todo', onclick: function () { cerrarTodo(); if (micOn) iniciarReconocimiento(); } }));
      overlay.appendChild(lista);
      overlay.appendChild(h('div', { class: 'fondo-cerrar', onclick: function () { cerrarTodo(); } }));
    }
    function cerrarTodo() {
      sugs = []; ultimoTexto = '';
      if (overlay) { overlay.remove(); overlay = null; }
      input.value = ''; pintarLibros('');
    }

    // ── voz ──
    function alternarVoz() {
      if (!SR) { RC.aviso('Tu navegador no permite búsqueda por voz. Prueba con Chrome o Safari.', 'mal', 3600); return; }
      micOn = !micOn;
      btnMic.classList.toggle('on', micOn);
      if (micOn) { B.precargarBusqueda(); iniciarReconocimiento(); } else detenerVoz();
    }
    function iniciarReconocimiento() {
      if (!SR || !micOn) return;
      detenerRec();
      reiniciar = true;
      rec = new SR();
      rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      let tPartial = null;
      rec.onresult = function (ev) {
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i], txt = r[0].transcript.trim();
          if (!txt || txt === ultimoTexto) continue;
          if (r.isFinal) { clearTimeout(tPartial); ultimoTexto = txt; procesar(txt); }
          else if (txt.split(/\s+/).length >= 2) {
            clearTimeout(tPartial);
            tPartial = setTimeout(function () { if (txt !== ultimoTexto) { ultimoTexto = txt; procesar(txt); } }, 200);
          }
        }
      };
      rec.onerror = function (e) {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { micOn = false; reiniciar = false; btnMic.classList.remove('on'); RC.aviso('Se necesita permiso de micrófono', 'mal'); }
      };
      rec.onend = function () { if (reiniciar && micOn && ctx.vigente()) setTimeout(function () { if (reiniciar && micOn) { ultimoTexto = ''; try { rec.start(); } catch (e) { } } }, 400); };
      try { rec.start(); } catch (e) { }
    }
    function detenerRec() { reiniciar = false; if (rec) { try { rec.onend = null; rec.abort(); } catch (e) { } rec = null; } }
    function detenerVoz() { micOn = false; btnMic.classList.remove('on'); detenerRec(); }
    ctx.alSalir(function () { clearTimeout(debounce); detenerVoz(); if (overlay) overlay.remove(); });
  });

  // ═══════════════════ Capítulos ═══════════════════
  RC.ruta(/^biblia\/(\d+)$/, { profundidad: 1, tab: 'biblia', padre: '#/biblia' }, function (ctx, id) {
    const l = RC.libro(parseInt(id, 10));
    if (!l) { location.replace('#/biblia'); return; }
    RC.barra({ atras: true, titulo: l.nombre, derecha: [] });
    const grid = h('div', { class: 'rc-caps' });
    for (let c = 1; c <= l.caps; c++) {
      grid.appendChild(h('button', { class: 'rc-capbtn', text: String(c), 'aria-label': 'Capítulo ' + c, onclick: function () { location.hash = '#/biblia/' + l.id + '/' + c; } }));
    }
    ctx.pagina.appendChild(h('div', { class: 'rc-cont' }, h('div', { class: 'rc-test', text: l.nombre + ' · ' + l.caps + (l.caps === 1 ? ' capítulo' : ' capítulos') }), grid));
    RC.entrada(grid.children, 0);
    B.libro(l.id).catch(function () { });  // precarga el texto del libro
  });

  // ═══════════════════ Lectura de versículos ═══════════════════
  let estudioActivo = false;

  RC.ruta(/^biblia\/(\d+)\/(\d+)$/, { profundidad: 2, tab: 'biblia', padre: null }, async function (ctx, idS, capS) {
    const libroId = parseInt(idS, 10), cap = parseInt(capS, 10), l = RC.libro(libroId);
    if (!l || cap < 1 || cap > l.caps) { location.replace('#/biblia'); return; }
    const pag = ctx.pagina;
    const resaltarV = parseInt(consulta().get('v') || '0', 10);
    let versos = [], paso = B.fuentePaso(), sel = new Set(), colores = B.resaltados(libroId, cap);
    let hablando = false, panelColores = null, comentarios = [], versionId = B.versionActiva();
    B.marcarLectura(libroId, cap);

    // estructura
    const panelV = h('div', { class: 'panel-v' });
    const panelE = h('div', { class: 'panel-e' });
    const lect = h('div', { class: 'rc-lect' + (estudioActivo ? ' estudio' : '') }, panelV, panelE);
    pag.style.overflow = 'hidden'; pag.style.paddingBottom = '0';
    pag.appendChild(lect);

    // ── barra superior ──
    function pintarBarra() {
      if (sel.size) {
        RC.barra({
          titulo: sel.size + (sel.size === 1 ? ' versículo' : ' versículos'),
          atras: false,
          derecha: [
            { icono: 'cerrar', titulo: 'Cancelar selección', fn: limpiarSel },
            { img: 'escuchar', titulo: 'Escuchar selección', fn: escucharSel },
            { img: 'compartir', titulo: 'Compartir', fn: compartirSel },
            { img: 'pin', titulo: 'Fijar versículos', fn: fijarSel }
          ]
        });
        // el título va primero; mover botón cancelar al inicio
        return;
      }
      RC.barra({
        atras: true, titulo: l.nombre + ' ' + cap, clic: abrirMiniLibros,
        derecha: [
          { id: 'rc-btn-version', texto: B.version(versionId).nombre + ' ▾', fn: abrirVersiones },
          { img: RC.tema.actual() === 'oscuro' ? 'noche' : 'dia', titulo: 'Cambiar modo claro/oscuro', fn: function () { RC.tema.alternar(); } },
          { icono: 'mas', titulo: 'Opciones', fn: abrirOpciones }
        ]
      });
    }
    pintarBarra();
    RC.en('tema', function () { if (ctx.vigente() && !sel.size) pintarBarra(); });

    // ── pintar versículos ──
    function aplicarFuente() {
      panelV.style.setProperty('--tam', B.tamano(18, paso) + 'px');
      panelE.style.setProperty('--tam', B.tamano(14.5, paso) + 'px');
    }
    function pintarVersos() {
      panelV.innerHTML = '';
      const wrap = h('div', { class: 'rc-vers-wrap', style: { fontSize: 'var(--tam)' } });
      wrap.appendChild(h('h1', { class: 'rc-cap-tit', text: l.nombre + ' ' + cap }));
      if (!versos.length) wrap.appendChild(h('div', { class: 'rc-vacio', text: 'Este capítulo no está disponible en ' + B.version(versionId).nombre + '.' }));
      versos.forEach(function (t, i) {
        const n = i + 1; if (!t) return;
        const el = h('span', { class: 'rc-v', dataset: { v: n }, role: 'button', tabindex: '0' }, h('span', { class: 'n', text: String(n) }), h('span', { class: 't', text: t }));
        if (colores[n]) el.style.background = colores[n] + '66';
        if (sel.has(n)) el.classList.add('sel');
        wrap.appendChild(el);
      });
      // navegación entre capítulos
      const ant = vecino(-1), sig = vecino(1);
      wrap.appendChild(h('div', { class: 'rc-pie-cap' },
        h('button', { text: '‹ ' + (ant ? ant.etq : ''), disabled: !ant, onclick: function () { ir(-1); } }),
        h('button', { text: (sig ? sig.etq : '') + ' ›', disabled: !sig, onclick: function () { ir(1); } })));
      panelV.appendChild(wrap);
      aplicarFuente();
    }
    function vecino(d) {
      let lid = libroId, c = cap + d;
      if (c < 1) { lid--; if (lid < 1) return null; c = RC.libro(lid).caps; }
      else if (c > l.caps) { lid++; if (lid > 66) return null; c = 1; }
      return { libro: lid, cap: c, etq: RC.libro(lid).abrev + ' ' + c };
    }
    function ir(d) {
      const v = vecino(d); if (!v) return;
      RC.reemplazar('#/biblia/' + v.libro + '/' + v.cap, d > 0 ? 'adelante' : 'atras');
    }

    // ── selección ──
    function alternarVerso(n) {
      if (sel.has(n)) sel.delete(n); else sel.add(n);
      const el = panelV.querySelector('.rc-v[data-v="' + n + '"]'); if (el) el.classList.toggle('sel', sel.has(n));
      pintarBarra(); actualizarPanelColores();
    }
    function limpiarSel() {
      sel.clear(); panelV.querySelectorAll('.rc-v.sel').forEach(function (e) { e.classList.remove('sel'); });
      detenerHabla(); pintarBarra(); actualizarPanelColores();
    }
    panelV.addEventListener('click', function (e) {
      const el = e.target.closest('.rc-v'); if (!el) return;
      if (window.getSelection && String(window.getSelection()).length > 0) return;
      alternarVerso(parseInt(el.dataset.v, 10));
    });
    panelV.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('.rc-v'); if (!el) return; e.preventDefault(); alternarVerso(parseInt(el.dataset.v, 10));
    });
    panelV.addEventListener('contextmenu', function (e) { if (e.target.closest('.rc-v')) e.preventDefault(); });

    function actualizarPanelColores() {
      if (!sel.size) { if (panelColores) { panelColores.remove(); panelColores = null; } return; }
      if (panelColores) return;
      panelColores = h('div', { class: 'rc-colores' }, h('div', { class: 'in' },
        D.COLORES_RESALTADO.map(function (c) {
          return h('button', { class: 'c', style: { background: c + '99' }, 'aria-label': 'Resaltar', onclick: function () { aplicarColor(c); } });
        }),
        h('button', { class: 'c x', 'aria-label': 'Quitar resaltado', text: '✕', onclick: function () { aplicarColor(null); } })));
      RC.$('#rc-main').appendChild(panelColores);
    }
    function aplicarColor(c) {
      B.resaltar(libroId, cap, Array.from(sel), c); colores = B.resaltados(libroId, cap);
      limpiarSel(); pintarVersos(); restaurarMarcas();
    }
    function textoSel() {
      const arr = Array.from(sel).sort(function (a, b) { return a - b; });
      const ref = arr.length === 1 ? l.nombre + ' ' + cap + ':' + arr[0] : l.nombre + ' ' + cap + ':' + arr[0] + '-' + arr[arr.length - 1];
      return { arr: arr, ref: ref, cuerpo: arr.map(function (n) { return n + '. ' + versos[n - 1]; }).join('\n') };
    }
    function compartirSel() { const t = textoSel(); RC.compartirTexto(t.ref, t.ref + '\n\n' + t.cuerpo); }
    function fijarSel() {
      const t = textoSel();
      const i = fijados.findIndex(function (f) { return f.referencia === t.ref; }); if (i >= 0) fijados.splice(i, 1);
      if (fijados.length >= 2) fijados.shift();
      fijados.push({ referencia: t.ref, texto: t.cuerpo, libroId: libroId, capitulo: cap, versiculo: t.arr[0] });
      limpiarSel(); renderPins();
      if (capaPins) capaPins.style.display = '';
      RC.aviso('Versículo fijado: arrástralo o toca dos veces para volver a él', null, 3200);
    }

    // ── escuchar (síntesis de voz) ──
    const TTS = window.speechSynthesis;
    function detenerHabla() { if (TTS && hablando) { TTS.cancel(); } hablando = false; panelV.querySelectorAll('.rc-v.hablando').forEach(function (e) { e.classList.remove('hablando'); }); }
    function hablar(lista, intro) {
      if (!TTS) { RC.aviso('Tu navegador no puede leer en voz alta.', 'mal'); return; }
      if (hablando) { detenerHabla(); return; }
      TTS.cancel(); hablando = true;
      const voces = TTS.getVoices(), voz = voces.find(function (v) { return /^es[-_]ES/i.test(v.lang); }) || voces.find(function (v) { return /^es/i.test(v.lang); });
      const cola = (intro ? [{ t: intro, n: 0 }] : []).concat(lista.map(function (n) { return { t: versos[n - 1], n: n }; }));
      cola.forEach(function (it, k) {
        const u = new SpeechSynthesisUtterance(it.t); u.lang = 'es-ES'; if (voz) u.voice = voz;
        u.onstart = function () { panelV.querySelectorAll('.rc-v.hablando').forEach(function (e) { e.classList.remove('hablando'); }); const el = panelV.querySelector('.rc-v[data-v="' + it.n + '"]'); if (el) { el.classList.add('hablando'); centrar(panelV, el, true); } };
        if (k === cola.length - 1) u.onend = function () { hablando = false; panelV.querySelectorAll('.rc-v.hablando').forEach(function (e) { e.classList.remove('hablando'); }); };
        TTS.speak(u);
      });
    }
    function escucharSel() { hablar(textoSel().arr, null); }
    function escucharCapitulo() { const todos = []; versos.forEach(function (t, i) { if (t) todos.push(i + 1); }); hablar(todos, l.nombre + ', capítulo ' + cap); }

    // ── menús ──
    function abrirOpciones(ancla) {
      RC.popup(ancla, [
        { texto: hablando ? 'Detener lectura' : 'Escuchar capítulo', icono: 'escuchar', fn: escucharCapitulo },
        { texto: 'Biblia de estudio', icono: 'libro', fn: alternarEstudio, activo: estudioActivo },
        { texto: 'Tamaño de fuente', icono: 'fuente', fn: abrirFuente },
        { texto: 'Compartir capítulo', icono: 'compartir', fn: function () { RC.compartirTexto(l.nombre + ' ' + cap, l.nombre + ' ' + cap + '\n\n' + versos.map(function (t, i) { return (i + 1) + '. ' + t; }).join('\n')); } }
      ], 230);
    }
    function abrirFuente() {
      const lab = h('div', { style: { textAlign: 'center', fontWeight: '700', marginBottom: '10px', color: 'var(--titulo)' } });
      const etiqueta = function (p) { return p === 0 ? 'Tamaño normal' : (p > 0 ? 'Más grande (+' + p + ')' : 'Más pequeño (' + p + ')'); };
      lab.textContent = etiqueta(paso);
      const rng = h('input', { type: 'range', min: '-4', max: '4', step: '1', value: String(paso), 'aria-label': 'Tamaño de fuente' });
      rng.addEventListener('input', function () { paso = parseInt(rng.value, 10); B.ponerFuentePaso(paso); lab.textContent = etiqueta(paso); aplicarFuente(); });
      const menos = h('button', { text: 'A−', 'aria-label': 'Reducir', onclick: function () { rng.value = Math.max(-4, paso - 1); rng.dispatchEvent(new Event('input')); } });
      const mas = h('button', { text: 'A+', 'aria-label': 'Aumentar', onclick: function () { rng.value = Math.min(4, paso + 1); rng.dispatchEvent(new Event('input')); } });
      RC.hoja('Tamaño de fuente', h('div', null, lab, h('div', { class: 'rc-fuente' }, menos, rng, mas)));
    }
    function abrirVersiones(ancla) {
      RC.popup(ancla, B.versiones().map(function (v) {
        return { texto: (B.disponible(v.id) ? '' : '⬇ ') + v.completo, activo: v.id === versionId, fn: function () { cambiarVersion(v.id); } };
      }), 250);
    }
    async function cambiarVersion(id) {
      if (id === versionId) return;
      if (!B.disponible(id)) {
        RC.modal('Descargar ' + B.version(id).completo, h('p', { text: 'Esta versión (~6 MB) se descargará una sola vez. ¿Continuar?' }), [
          { texto: 'Cancelar', sec: true },
          { texto: 'Descargar', fn: function () { aplicarVersion(id, true); } }]);
      } else aplicarVersion(id, false);
    }
    async function aplicarVersion(id, descargando) {
      if (descargando) RC.aviso('Descargando ' + B.version(id).nombre + '…', null, 6000);
      try {
        const vs = await B.capitulo(libroId, cap, id);
        if (!ctx.vigente()) return;
        versionId = id; B.ponerVersion(id); versos = vs; limpiarSel(); pintarVersos(); pintarBarra();
        if (descargando) RC.aviso(B.version(id).nombre + ' lista', 'ok');
      } catch (e) { RC.aviso(e.message || 'No se pudo cambiar la versión', 'mal', 4200); }
    }
    function abrirMiniLibros() {
      const cuerpo = h('div', { class: 'rc-minilibros' });
      [[1, 'Antiguo Testamento'], [2, 'Nuevo Testamento']].forEach(function (g) {
        cuerpo.appendChild(h('h3', { text: g[1] }));
        D.LIBROS.filter(function (x) { return x.test === g[0]; }).forEach(function (x) {
          cuerpo.appendChild(h('button', { class: x.id === libroId ? 'act' : '', text: x.nombre, onclick: function () { v.cerrar(); location.hash = '#/biblia/' + x.id; } }));
        });
      });
      const v = RC.hoja('Ir a otro libro', cuerpo);
    }

    // ── Biblia de estudio ──
    function alternarEstudio() {
      estudioActivo = !estudioActivo; lect.classList.toggle('estudio', estudioActivo);
      if (estudioActivo) cargarEstudio();
    }
    async function cargarEstudio() {
      panelE.innerHTML = ''; panelE.appendChild(h('div', { class: 'rc-cargando' }, h('div', { class: 'rc-spin' })));
      try { comentarios = await B.comentarios(libroId); } catch (e) { panelE.innerHTML = ''; panelE.appendChild(h('div', { class: 'rc-vacio', text: 'No se pudo cargar la Biblia de estudio.' })); return; }
      if (!ctx.vigente()) return;
      pintarEstudio();
    }
    function pintarEstudio() {
      panelE.innerHTML = '';
      panelE.appendChild(h('div', { class: 'rc-estudio-cab' }, h('span', { text: 'Comentario Bíblico · Matthew Henry' }),
        h('button', { class: 'rc-btn-ico', 'aria-label': 'Cerrar Biblia de estudio', html: RC.ico('cerrar'), style: { width: '34px', height: '34px' }, onclick: alternarEstudio })));
      const lista = comentarios.filter(function (c) { return c[0] === cap; });
      if (!lista.length) panelE.appendChild(h('div', { class: 'rc-vacio', text: 'No hay comentario para este capítulo.' }));
      lista.forEach(function (c) {
        panelE.appendChild(h('div', { class: 'rc-com', dataset: { ini: c[1], fin: c[2] } },
          h('h3', { text: c[3], onclick: function () { irAVerso(c[1]); } }), h('p', { text: c[4] })));
      });
      panelE.style.fontSize = 'var(--tam)';
      sincronizar();
    }
    function irAVerso(n) { const el = panelV.querySelector('.rc-v[data-v="' + n + '"]'); if (el) centrar(panelV, el, true); }
    function versoCentral() {
      const r = panelV.getBoundingClientRect(), cy = r.top + r.height / 3; let mejor = null, d = 1e9;
      panelV.querySelectorAll('.rc-v').forEach(function (e) { const b = e.getBoundingClientRect(); const dd = Math.abs((b.top + b.bottom) / 2 - cy); if (dd < d) { d = dd; mejor = e; } });
      return mejor ? parseInt(mejor.dataset.v, 10) : 1;
    }
    function sincronizar() {
      if (!estudioActivo) return;
      const n = versoCentral(); let objetivo = null;
      panelE.querySelectorAll('.rc-com').forEach(function (e) { e.classList.remove('act'); if (n >= +e.dataset.ini && n <= +e.dataset.fin) objetivo = e; });
      if (objetivo) { objetivo.classList.add('act'); const pr = panelE.getBoundingClientRect(), er = objetivo.getBoundingClientRect(); panelE.scrollTo({ top: panelE.scrollTop + er.top - pr.top - pr.height / 4, behavior: 'smooth' }); }
    }
    let tScroll = null;
    panelV.addEventListener('scroll', function () { clearTimeout(tScroll); tScroll = setTimeout(sincronizar, 180); }, { passive: true });

    // ── gesto de deslizar entre capítulos ──
    let tx0 = 0, ty0 = 0, tt0 = 0;
    panelV.addEventListener('touchstart', function (e) { if (e.touches.length !== 1) return; tx0 = e.touches[0].clientX; ty0 = e.touches[0].clientY; tt0 = Date.now(); }, { passive: true });
    panelV.addEventListener('touchend', function (e) {
      if (sel.size || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - tx0, dy = Math.abs(e.changedTouches[0].clientY - ty0), dt = Date.now() - tt0;
      if (Math.abs(dx) > 70 && dy < 40 && dt < 600) ir(dx < 0 ? 1 : -1);
    }, { passive: true });
    // teclado
    function teclas(e) { if (e.target.closest && e.target.closest('input,textarea')) return; if (e.key === 'ArrowRight') ir(1); else if (e.key === 'ArrowLeft') ir(-1); else if (e.key === 'Escape' && sel.size) limpiarSel(); }
    document.addEventListener('keydown', teclas);

    ctx.alSalir(function () { detenerHabla(); if (panelColores) panelColores.remove(); document.removeEventListener('keydown', teclas); });

    function restaurarMarcas() { if (resaltarV) { const el = panelV.querySelector('.rc-v[data-v="' + resaltarV + '"]'); if (el) el.classList.add('flash'); } }

    // ── carga ──
    panelV.appendChild(h('div', { class: 'rc-cargando' }, h('div', { class: 'rc-spin' })));
    try {
      versos = await B.capitulo(libroId, cap, versionId);
    } catch (e) {
      if (!ctx.vigente()) return;
      if (versionId !== 'RV1960') { B.ponerVersion('RV1960'); versionId = 'RV1960'; try { versos = await B.capitulo(libroId, cap, 'RV1960'); RC.aviso('No se pudo cargar esa versión; se muestra RV1960', 'mal'); pintarBarra(); } catch (e2) { versos = []; } }
      else {
        panelV.innerHTML = ''; panelV.appendChild(h('div', { class: 'rc-vacio', text: 'No se pudo cargar el capítulo.\nRevisa tu conexión.' }),
          h('div', { style: { textAlign: 'center' } }, h('button', { class: 'rc-btn', text: 'Reintentar', onclick: function () { RC.reemplazar(location.hash, 'fade'); location.reload(); } })));
        return;
      }
    }
    if (!ctx.vigente()) return;
    pintarVersos();
    if (estudioActivo) cargarEstudio();
    if (resaltarV) {
      setTimeout(function () { const el = panelV.querySelector('.rc-v[data-v="' + resaltarV + '"]'); if (el) { centrar(panelV, el, false); el.classList.add('flash'); } }, 80);
    }
  });
})();
