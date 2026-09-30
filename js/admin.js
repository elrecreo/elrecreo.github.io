/* Panel de administración — se muestra solo en  …/#admin */
(function () {
  const app = document.getElementById('app');
  const TABS = [
    ['devocional', 'Devocional'], ['videos', 'Videos'], ['eventos', 'Eventos'], ['peticiones', 'Peticiones']
  ];
  const VISTAS = { devocional: vistaDevocional, videos: vistaVideos, eventos: vistaEventos, peticiones: vistaPeticiones };
  const ICONO_LAPIZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

  let tabActiva = 'devocional';
  let panelDevocional = null; // se conserva al cambiar de pestaña para no perder lo escrito ni recargar el fondo
  let fondoCache = null;      // imagen de fondo ya descargada

  function render() {
    if (location.hash !== '#admin') { app.innerHTML = ''; panelDevocional = null; fondoCache = null; return; }
    if (!app.querySelector('.cabecera')) {
      app.innerHTML =
        '<header class="cabecera">' +
        '<div class="marca"><img src="img/logo.png" alt="" width="44" height="44"><div><strong>Centro Cristiano El Recreo</strong><span>Administración</span></div></div>' +
        '<nav class="tabs">' + TABS.map(function (t) {
          return '<button class="tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</nav></header><main class="panel" id="panel"></main>';
      app.querySelectorAll('.tab').forEach(function (b) {
        b.onclick = function () { tabActiva = b.dataset.tab; mostrar(); };
      });
    }
    mostrar();
  }

  function mostrar() {
    app.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('activa', b.dataset.tab === tabActiva); });
    const panel = document.getElementById('panel');
    panel.innerHTML = '';
    if (tabActiva === 'devocional') {
      if (!panelDevocional) { panelDevocional = document.createElement('div'); vistaDevocional(panelDevocional); }
      panel.appendChild(panelDevocional);
    } else {
      VISTAS[tabActiva](panel);
    }
  }
  window.addEventListener('hashchange', render);
  render();

  function msg(el, texto, tipo) { el.textContent = texto || ''; el.className = 'estado ' + (tipo || ''); }
  function vacio(texto) { return '<li class="vacio">' + texto + '</li>'; }
  function errorLi(e) { return '<li class="vacio estado mal">' + esc(e.message) + '</li>'; }

  // ═════════════════════════ DEVOCIONAL ═════════════════════════
  function vistaDevocional(p) {
    p.innerHTML =
      '<section class="seccion"><div class="dev">' +
      '<div class="dev-form">' +
      '<div class="editando" id="dEditando" hidden><span>Editando el devocional vigente</span><button class="btn sec chico" id="dCancelar">Cancelar</button></div>' +
      '<h2 id="dTitulo">Nuevo devocional</h2>' +
      '<label for="dCita">Cita</label><input type="text" id="dCita" placeholder="Salmos 34 : 1" autocomplete="off">' +
      '<label for="dVers">Versículo</label><textarea id="dVers"></textarea>' +
      '<label for="dCuerpo">Reflexión</label><textarea id="dCuerpo"></textarea>' +
      '<div class="fila" style="margin-top:16px"><label for="dColor">Color del texto</label><input type="color" id="dColor" value="#5F535D"></div>' +
      '</div>' +
      '<div class="dev-vista"><canvas class="vista" id="dCanvas"></canvas></div>' +
      '<div class="dev-acciones"><div class="fila"><button class="btn" id="dPub">Publicar devocional</button><button class="btn sec" id="dDesc">Descargar imagen</button></div>' +
      '<div class="estado" id="dMsg" role="status"></div></div>' +
      '</div></section>' +
      '<section class="seccion"><h2>Publicados</h2><ul class="items" id="dLista"><li class="vacio">Cargando…</li></ul></section>' +
      '<section class="seccion"><details class="fondo" id="fDetalle"><summary>Fondo del año</summary>' +
      '<input type="file" id="fFile" accept="image/*"><div class="fila" style="margin-top:10px"><button class="btn sec" id="fSave">Guardar como fondo</button></div>' +
      '<div class="estado" id="fMsg" role="status"></div></details></section>';

    const $ = function (id) { return p.querySelector('#' + id); };
    const canvas = $('dCanvas');
    let fondoImg = fondoCache, fondoArchivo = null, editId = null, cache = [], pendiente = false;

    function pintar() {
      dibujarDevocional(canvas, fondoImg, { cita: $('dCita').value, versiculo: $('dVers').value, cuerpo: $('dCuerpo').value, color: $('dColor').value });
    }
    function programar() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; pintar(); });
    }
    ['dCita', 'dVers', 'dCuerpo', 'dColor'].forEach(function (id) { $(id).oninput = programar; });

    function imagenDesdeSrc(src) {
      return new Promise(function (res, rej) { const i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    }

    async function iniciar() {
      await cargarFuentesDevocional();
      pintar();
      cargarLista();
      if (!fondoImg) {
        try {
          const r = await llamar('obtener_fondo');
          if (!r.vacio) { fondoImg = fondoCache = await imagenDesdeSrc('data:' + r.tipo + ';base64,' + r.base64); }
          else { $('fDetalle').open = true; msg($('fMsg'), 'Todavía no hay fondo. Sube uno.', ''); }
        } catch (e) { $('fDetalle').open = true; msg($('fMsg'), 'No se pudo leer el fondo: ' + e.message, 'mal'); }
        pintar();
      }
    }

    // ── Fondo del año ──
    $('fFile').onchange = async function (ev) {
      const f = ev.target.files[0]; if (!f) return;
      fondoArchivo = f;
      fondoImg = await imagenDesdeSrc(URL.createObjectURL(f));
      msg($('fMsg'), 'Vista previa con este fondo. Falta guardarlo.', '');
      pintar();
    };
    $('fSave').onclick = async function () {
      if (!fondoArchivo) { msg($('fMsg'), 'Elige una imagen primero.', 'mal'); return; }
      msg($('fMsg'), 'Subiendo fondo…');
      try {
        const a = await leerArchivoBase64(fondoArchivo);
        await llamar('guardar_fondo', { imagenBase64: a.base64, imagenTipo: a.tipo, imagenNombre: a.nombre });
        fondoCache = fondoImg; fondoArchivo = null; msg($('fMsg'), 'Fondo guardado', 'ok');
      } catch (e) { msg($('fMsg'), e.message, 'mal'); }
    };

    // ── Validación común a publicar y descargar ──
    function listoParaGenerar() {
      if (!fondoImg) { $('fDetalle').open = true; msg($('dMsg'), 'Falta el fondo del año.', 'mal'); return false; }
      if (!$('dVers').value.trim() && !$('dCuerpo').value.trim()) { msg($('dMsg'), 'Escribe el versículo o la reflexión.', 'mal'); return false; }
      return true;
    }

    // ── Descargar (con recorte inferior) ──
    $('dDesc').onclick = function () {
      if (!listoParaGenerar()) return;
      pintar();
      canvasParaDescarga(canvas).toBlob(function (blob) {
        if (!blob) { msg($('dMsg'), 'No se pudo generar la imagen.', 'mal'); return; }
        descargarBlob(blob, 'devocional-' + nombreArchivo($('dCita').value, 'imagen') + '.jpg');
        msg($('dMsg'), 'Imagen descargada', 'ok');
      }, 'image/jpeg', 0.95);
    };

    // ── Publicar / guardar cambios ──
    $('dPub').onclick = async function () {
      if (!listoParaGenerar()) return;
      const btn = $('dPub'); btn.disabled = true;
      msg($('dMsg'), 'Generando imagen y subiendo a Drive…');
      try {
        pintar();
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        await llamar('guardar_devocional', {
          cita: $('dCita').value, versiculo: $('dVers').value, cuerpo: $('dCuerpo').value,
          imagenBase64: base64, imagenTipo: 'image/jpeg'
        });
        if (editId) {
          // El devocional editado se publica como nuevo (queda vigente) y se retira el anterior.
          try { await llamar('eliminar_devocional', { id: editId }); }
          catch (e) { msg($('dMsg'), 'Publicado, pero no se pudo borrar el anterior: ' + e.message, 'mal'); salirDeEdicion(); cargarLista(); btn.disabled = false; return; }
          salirDeEdicion();
          msg($('dMsg'), 'Cambios guardados', 'ok');
        } else {
          msg($('dMsg'), 'Publicado', 'ok');
        }
        cargarLista();
      } catch (e) { msg($('dMsg'), e.message, 'mal'); }
      btn.disabled = false;
    };

    // ── Edición del vigente ──
    function entrarEnEdicion(d) {
      editId = d.id;
      $('dCita').value = d.cita || '';
      $('dVers').value = d.versiculo || '';
      $('dCuerpo').value = d.cuerpo || '';
      $('dEditando').hidden = false;
      $('dTitulo').textContent = 'Editar devocional';
      $('dPub').textContent = 'Guardar cambios';
      if (!d.versiculo && !d.cuerpo) msg($('dMsg'), 'No llegó el texto de este devocional. Escríbelo de nuevo.', 'mal');
      else msg($('dMsg'), '');
      pintar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function salirDeEdicion() {
      editId = null;
      $('dEditando').hidden = true;
      $('dTitulo').textContent = 'Nuevo devocional';
      $('dPub').textContent = 'Publicar devocional';
    }
    $('dCancelar').onclick = function () {
      salirDeEdicion();
      $('dCita').value = ''; $('dVers').value = ''; $('dCuerpo').value = '';
      msg($('dMsg'), ''); pintar();
    };

    // ── Lista de publicados ──
    async function cargarLista() {
      const lista = $('dLista');
      try {
        const r = await llamar('listar_devocionales_admin');
        cache = r.devocionales;
        lista.innerHTML = cache.length ? cache.map(function (d, i) {
          return '<li><img class="mini" src="' + esc(d.imagenUrl) + '" alt="" loading="lazy">' +
            '<div class="txt"><b>' + esc(d.cita || '(sin cita)') + '</b>' + (i === 0 ? '<span class="marca-estado">vigente</span>' : '') +
            '<div class="sub">' + esc(d.fecha) + '</div></div>' +
            '<div class="acciones">' +
            (i === 0 ? '<button class="btn sec chico icono" data-e="' + esc(d.id) + '" title="Editar" aria-label="Editar">' + ICONO_LAPIZ + '</button>' : '') +
            '<button class="btn sec chico" data-b="' + esc(d.id) + '">Descargar</button>' +
            '<button class="btn mal chico" data-d="' + esc(d.id) + '">Borrar</button></div></li>';
        }).join('') : vacio('Aún no hay devocionales.');
        lista.querySelectorAll('[data-e]').forEach(function (b) {
          b.onclick = function () { entrarEnEdicion(cache.find(function (x) { return String(x.id) === b.dataset.e; })); };
        });
        lista.querySelectorAll('[data-b]').forEach(function (b) {
          b.onclick = function () {
            const d = cache.find(function (x) { return String(x.id) === b.dataset.b; });
            descargarDesdeUrl(d.imagenUrl, 'devocional-' + nombreArchivo(d.cita || d.fecha, 'imagen'));
          };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () {
            if (!confirm('¿Borrar este devocional?')) return;
            try { await llamar('eliminar_devocional', { id: b.dataset.d }); if (String(editId) === b.dataset.d) salirDeEdicion(); cargarLista(); }
            catch (e) { msg($('dMsg'), e.message, 'mal'); }
          };
        });
      } catch (e) { lista.innerHTML = errorLi(e); }
    }
    iniciar();
  }

  // ═════════════════════════ VIDEOS ═════════════════════════
  function vistaVideos(p) {
    p.innerHTML =
      '<section class="seccion"><h2>Agregar video</h2>' +
      '<div class="fila"><input class="crece" id="vUrl" type="url" placeholder="Link de YouTube" aria-label="Link de YouTube" autocomplete="off">' +
      '<button class="btn" id="vAdd">Agregar</button></div><div class="estado" id="vMsg" role="status"></div></section>' +
      '<section class="seccion"><h2>Publicados</h2><ul class="items" id="vLista"><li class="vacio">Cargando…</li></ul></section>';
    const url = p.querySelector('#vUrl'), m = p.querySelector('#vMsg'), lista = p.querySelector('#vLista');

    function miniatura(u) {
      const id = idYoutube(u);
      return id ? '<img src="https://i.ytimg.com/vi/' + id + '/mqdefault.jpg" alt="" loading="lazy">' : '';
    }

    async function cargar() {
      try {
        const r = await llamar('listar_videos_admin');
        lista.innerHTML = r.videos.length ? r.videos.map(function (v) {
          return '<li class="' + (v.activo ? '' : 'oculto') + '">' +
            '<a class="video" href="' + esc(v.url) + '" target="_blank" rel="noopener" aria-label="Abrir en YouTube">' + miniatura(v.url) + '</a>' +
            '<div class="txt">' + (v.titulo ? '<b>' + esc(v.titulo) + '</b><br>' : '') +
            '<a href="' + esc(v.url) + '" target="_blank" rel="noopener">' + esc(String(v.url).replace(/^https?:\/\/(www\.)?/, '')) + '</a>' +
            '<div class="sub">' + esc(v.fecha) + (v.activo ? '' : ' · oculto') + '</div></div>' +
            '<div class="acciones">' +
            '<button class="btn sec chico" data-t="' + esc(v.id) + '" data-a="' + v.activo + '">' + (v.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(v.id) + '">Borrar</button></div></li>';
        }).join('') : vacio('Aún no hay videos.');
        lista.querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () { await llamar('toggle_video_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargar(); };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este video de la lista?')) { await llamar('eliminar_video', { id: b.dataset.d }); cargar(); } };
        });
      } catch (e) { lista.innerHTML = errorLi(e); }
    }
    p.querySelector('#vAdd').onclick = async function () {
      if (!url.value.trim()) return;
      msg(m, 'Guardando…');
      try { await llamar('agregar_video', { url: url.value.trim() }); url.value = ''; msg(m, 'Video agregado', 'ok'); cargar(); }
      catch (e) { msg(m, e.message, 'mal'); }
    };
    cargar();
  }

  // ═════════════════════════ EVENTOS ═════════════════════════
  function vistaEventos(p) {
    p.innerHTML =
      '<section class="seccion"><h2>Nuevo evento</h2>' +
      '<label for="eEt">Etiqueta</label><input type="text" id="eEt" placeholder="Vigilia de jóvenes, sábado 7 pm" autocomplete="off">' +
      '<label for="eFile">Imagen del flyer</label><input type="file" id="eFile" accept="image/*">' +
      '<div class="fila" style="margin-top:16px"><button class="btn" id="eAdd">Publicar evento</button></div><div class="estado" id="eMsg" role="status"></div></section>' +
      '<section class="seccion"><h2>Publicados</h2><ul class="items" id="eLista"><li class="vacio">Cargando…</li></ul></section>';
    const lista = p.querySelector('#eLista'), m = p.querySelector('#eMsg');

    async function cargar() {
      try {
        const r = await llamar('listar_eventos_admin');
        lista.innerHTML = r.eventos.length ? r.eventos.map(function (ev) {
          return '<li class="' + (ev.activo ? '' : 'oculto') + '"><img class="mini flyer" src="' + esc(ev.imagenUrl) + '" alt="" loading="lazy">' +
            '<div class="txt"><b>' + esc(ev.etiqueta) + '</b><div class="sub">' + esc(ev.fecha) + (ev.activo ? '' : ' · oculto') + '</div></div>' +
            '<div class="acciones">' +
            '<button class="btn sec chico" data-t="' + esc(ev.id) + '" data-a="' + ev.activo + '">' + (ev.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(ev.id) + '">Borrar</button></div></li>';
        }).join('') : vacio('Aún no hay eventos.');
        lista.querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () { await llamar('toggle_evento_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargar(); };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este evento y su imagen?')) { await llamar('eliminar_evento', { id: b.dataset.d }); cargar(); } };
        });
      } catch (e) { lista.innerHTML = errorLi(e); }
    }
    p.querySelector('#eAdd').onclick = async function () {
      const et = p.querySelector('#eEt').value.trim(), f = p.querySelector('#eFile').files[0];
      if (!et || !f) { msg(m, 'Escribe la etiqueta y elige la imagen.', 'mal'); return; }
      msg(m, 'Subiendo a Drive…');
      try {
        const a = await leerArchivoBase64(f);
        await llamar('guardar_evento', { etiqueta: et, activo: true, imagenBase64: a.base64, imagenTipo: a.tipo, imagenNombre: a.nombre });
        p.querySelector('#eEt').value = ''; p.querySelector('#eFile').value = '';
        msg(m, 'Evento publicado', 'ok'); cargar();
      } catch (e) { msg(m, e.message, 'mal'); }
    };
    cargar();
  }

  // ═════════════════════════ PETICIONES ═════════════════════════
  function vistaPeticiones(p) {
    p.innerHTML = '<section class="seccion"><h2>Peticiones de oración</h2><ul class="items" id="pLista"><li class="vacio">Cargando…</li></ul></section>';
    llamar('obtener_peticiones').then(function (r) {
      p.querySelector('#pLista').innerHTML = r.peticiones.length ? r.peticiones.map(function (x) {
        return '<li style="display:block"><div class="txt peticion">' + esc(x.texto) + '<div class="sub">' + esc(x.fecha) + '</div></div></li>';
      }).join('') : vacio('Aún no hay peticiones.');
    }).catch(function (e) { p.querySelector('#pLista').innerHTML = errorLi(e); });
  }
})();
