/* Panel de administración — se muestra solo en  …/#admin */
(function () {
  const app = document.getElementById('app');
  const TABS = [
    ['videos', 'Videos'], ['devocional', 'Devocional'], ['eventos', 'Eventos'],
    ['anuncios', 'Anuncios'], ['peticiones', 'Peticiones']
  ];
  let tabActiva = 'videos';

  function render() {
    if (location.hash !== '#admin') { app.innerHTML = ''; return; }
    app.innerHTML =
      '<div class="admin-top">Centro Cristiano El Recreo · Administración</div>' +
      '<div class="tabs">' + TABS.map(function (t) {
        return '<button class="tab' + (t[0] === tabActiva ? ' activa' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</div><div class="panel" id="panel"></div>';
    app.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () { tabActiva = b.dataset.tab; render(); };
    });
    ({ videos: vistaVideos, devocional: vistaDevocional, eventos: vistaEventos,
       anuncios: vistaAnuncios, peticiones: vistaPeticiones })[tabActiva](document.getElementById('panel'));
  }
  window.addEventListener('hashchange', render);
  render();

  function msg(el, texto, tipo) { el.textContent = texto || ''; el.className = 'estado ' + (tipo || ''); }

  // ═════════════════════════ VIDEOS ═════════════════════════
  function vistaVideos(p) {
    p.innerHTML =
      '<div class="tarjeta"><h3>Agregar video</h3>' +
      '<p class="nota">Pega el link de YouTube. La app lo mostrará arriba de todos (título y canal los toma de YouTube).</p>' +
      '<div class="fila"><input class="crece" id="vUrl" type="url" placeholder="https://www.youtube.com/watch?v=...">' +
      '<button class="btn" id="vAdd">Agregar</button></div><div class="estado" id="vMsg"></div></div>' +
      '<div class="tarjeta"><h3>Videos publicados</h3><ul class="lista" id="vLista"><li>Cargando…</li></ul></div>';
    const url = p.querySelector('#vUrl'), m = p.querySelector('#vMsg'), lista = p.querySelector('#vLista');

    async function cargar() {
      try {
        const r = await llamar('listar_videos_admin');
        lista.innerHTML = r.videos.length ? r.videos.map(function (v) {
          return '<li><div class="txt"><a href="' + esc(v.url) + '" target="_blank" rel="noopener">' + esc(v.url) + '</a>' +
            '<div class="sub">' + esc(v.fecha) + '</div></div>' +
            '<span class="pill' + (v.activo ? '' : ' off') + '">' + (v.activo ? 'visible' : 'oculto') + '</span>' +
            '<button class="btn sec chico" data-t="' + esc(v.id) + '" data-a="' + v.activo + '">' + (v.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(v.id) + '">Borrar</button></li>';
        }).join('') : '<li>Aún no hay videos.</li>';
        lista.querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () { await llamar('toggle_video_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargar(); };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este video de la lista?')) { await llamar('eliminar_video', { id: b.dataset.d }); cargar(); } };
        });
      } catch (e) { lista.innerHTML = '<li class="estado mal">' + esc(e.message) + '</li>'; }
    }
    p.querySelector('#vAdd').onclick = async function () {
      if (!url.value.trim()) return;
      msg(m, 'Guardando…');
      try { await llamar('agregar_video', { url: url.value.trim() }); url.value = ''; msg(m, 'Video agregado ✔', 'ok'); cargar(); }
      catch (e) { msg(m, e.message, 'mal'); }
    };
    cargar();
  }

  // ═════════════════════════ DEVOCIONAL ═════════════════════════
  function vistaDevocional(p) {
    p.innerHTML =
      '<div class="dev-grid"><div>' +
      '<div class="tarjeta"><h3>Nuevo devocional</h3>' +
      '<label>Cita</label><input type="text" id="dCita" placeholder="Salmos 34 : 1">' +
      '<label>Versículo</label><textarea id="dVers" placeholder="Bendeciré a Jehová en todo tiempo; Su alabanza estará de continuo en mi boca"></textarea>' +
      '<label>Cuerpo (reflexión)</label><textarea id="dCuerpo" placeholder="Que tu agradecimiento y alabanza a Dios, no estén sujetas a una buena respuesta."></textarea>' +
      '<div class="fila" style="margin-top:12px"><label style="margin:0">Color del texto</label><input type="color" id="dColor" value="#1E2B6B"></div>' +
      '<div class="fila" style="margin-top:14px"><button class="btn" id="dPub">Publicar devocional</button></div>' +
      '<div class="estado" id="dMsg"></div></div>' +
      '<div class="tarjeta"><h3>Fondo del año</h3>' +
      '<p class="nota">Imagen vacía (con el logo, el paisaje, etc.). Se guarda en Drive y se usa para todos los devocionales hasta que la cambies.</p>' +
      '<input type="file" id="fFile" accept="image/*"><div class="fila" style="margin-top:10px"><button class="btn sec" id="fSave">Guardar como fondo</button></div>' +
      '<div class="estado" id="fMsg"></div></div>' +
      '</div><div><canvas class="vista" id="dCanvas"></canvas></div></div>' +
      '<div class="tarjeta"><h3>Últimos publicados</h3><ul class="lista" id="dLista"><li>Cargando…</li></ul></div>';

    const $ = function (id) { return p.querySelector('#' + id); };
    const canvas = $('dCanvas');
    let fondoImg = null, fondoArchivo = null;

    function pintar() {
      dibujarDevocional(canvas, fondoImg, { cita: $('dCita').value, versiculo: $('dVers').value, cuerpo: $('dCuerpo').value, color: $('dColor').value });
    }
    ['dCita', 'dVers', 'dCuerpo', 'dColor'].forEach(function (id) { $(id).oninput = pintar; });

    function imagenDesdeSrc(src) {
      return new Promise(function (res, rej) { const i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    }

    async function iniciar() {
      await cargarFuentesDevocional();
      pintar();
      try {
        const r = await llamar('obtener_fondo');
        if (!r.vacio) { fondoImg = await imagenDesdeSrc('data:' + r.tipo + ';base64,' + r.base64); }
        else msg($('fMsg'), 'Todavía no hay fondo guardado. Sube uno.', '');
      } catch (e) { msg($('fMsg'), 'No se pudo leer el fondo: ' + e.message, 'mal'); }
      pintar();
      cargarLista();
    }

    $('fFile').onchange = async function (ev) {
      const f = ev.target.files[0]; if (!f) return;
      fondoArchivo = f;
      fondoImg = await imagenDesdeSrc(URL.createObjectURL(f));
      msg($('fMsg'), 'Vista previa con esa imagen. Pulsa "Guardar como fondo" para dejarla fija.', '');
      pintar();
    };
    $('fSave').onclick = async function () {
      if (!fondoArchivo) { msg($('fMsg'), 'Primero elige una imagen.', 'mal'); return; }
      msg($('fMsg'), 'Subiendo fondo…');
      try {
        const a = await leerArchivoBase64(fondoArchivo);
        await llamar('guardar_fondo', { imagenBase64: a.base64, imagenTipo: a.tipo, imagenNombre: a.nombre });
        fondoArchivo = null; msg($('fMsg'), 'Fondo guardado ✔', 'ok');
      } catch (e) { msg($('fMsg'), e.message, 'mal'); }
    };

    $('dPub').onclick = async function () {
      if (!fondoImg) { msg($('dMsg'), 'Falta el fondo (súbelo abajo).', 'mal'); return; }
      if (!$('dVers').value.trim() && !$('dCuerpo').value.trim()) { msg($('dMsg'), 'Escribe el versículo o el cuerpo.', 'mal'); return; }
      const btn = $('dPub'); btn.disabled = true; msg($('dMsg'), 'Generando imagen y subiendo a Drive…');
      try {
        pintar();
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        await llamar('guardar_devocional', {
          cita: $('dCita').value, versiculo: $('dVers').value, cuerpo: $('dCuerpo').value,
          imagenBase64: base64, imagenTipo: 'image/jpeg'
        });
        msg($('dMsg'), 'Publicado ✔ La app lo mostrará en su próxima revisión.', 'ok');
        cargarLista();
      } catch (e) { msg($('dMsg'), e.message, 'mal'); }
      btn.disabled = false;
    };

    async function cargarLista() {
      const lista = $('dLista');
      try {
        const r = await llamar('listar_devocionales_admin');
        lista.innerHTML = r.devocionales.length ? r.devocionales.map(function (d, i) {
          return '<li><img class="mini" src="' + esc(d.imagenUrl) + '" alt="">' +
            '<div class="txt"><b>' + esc(d.cita || '(sin cita)') + '</b>' + (i === 0 ? ' <span class="pill">vigente</span>' : '') +
            '<div class="sub">' + esc(d.fecha) + '</div></div>' +
            '<button class="btn mal chico" data-d="' + esc(d.id) + '">Borrar</button></li>';
        }).join('') : '<li>Aún no hay devocionales.</li>';
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este devocional?')) { await llamar('eliminar_devocional', { id: b.dataset.d }); cargarLista(); } };
        });
      } catch (e) { lista.innerHTML = '<li class="estado mal">' + esc(e.message) + '</li>'; }
    }
    iniciar();
  }

  // ═════════════════════════ EVENTOS ═════════════════════════
  function vistaEventos(p) {
    p.innerHTML =
      '<div class="tarjeta"><h3>Nuevo evento (flyer)</h3>' +
      '<label>Etiqueta</label><input type="text" id="eEt" placeholder="Ej. Vigilia de jóvenes — sábado 7 pm">' +
      '<label>Imagen del flyer</label><input type="file" id="eFile" accept="image/*">' +
      '<div class="fila" style="margin-top:14px"><button class="btn" id="eAdd">Publicar evento</button></div><div class="estado" id="eMsg"></div></div>' +
      '<div class="tarjeta"><h3>Eventos</h3><ul class="lista" id="eLista"><li>Cargando…</li></ul></div>';
    const lista = p.querySelector('#eLista'), m = p.querySelector('#eMsg');

    async function cargar() {
      try {
        const r = await llamar('listar_eventos_admin');
        lista.innerHTML = r.eventos.length ? r.eventos.map(function (ev) {
          return '<li><img class="mini" src="' + esc(ev.imagenUrl) + '" alt="">' +
            '<div class="txt"><b>' + esc(ev.etiqueta) + '</b><div class="sub">' + esc(ev.fecha) + '</div></div>' +
            '<span class="pill' + (ev.activo ? '' : ' off') + '">' + (ev.activo ? 'visible' : 'oculto') + '</span>' +
            '<button class="btn sec chico" data-t="' + esc(ev.id) + '" data-a="' + ev.activo + '">' + (ev.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(ev.id) + '">Borrar</button></li>';
        }).join('') : '<li>Aún no hay eventos.</li>';
        lista.querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () { await llamar('toggle_evento_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargar(); };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este evento y su imagen?')) { await llamar('eliminar_evento', { id: b.dataset.d }); cargar(); } };
        });
      } catch (e) { lista.innerHTML = '<li class="estado mal">' + esc(e.message) + '</li>'; }
    }
    p.querySelector('#eAdd').onclick = async function () {
      const et = p.querySelector('#eEt').value.trim(), f = p.querySelector('#eFile').files[0];
      if (!et || !f) { msg(m, 'Escribe la etiqueta y elige la imagen.', 'mal'); return; }
      msg(m, 'Subiendo a Drive…');
      try {
        const a = await leerArchivoBase64(f);
        await llamar('guardar_evento', { etiqueta: et, activo: true, imagenBase64: a.base64, imagenTipo: a.tipo, imagenNombre: a.nombre });
        p.querySelector('#eEt').value = ''; p.querySelector('#eFile').value = '';
        msg(m, 'Evento publicado ✔', 'ok'); cargar();
      } catch (e) { msg(m, e.message, 'mal'); }
    };
    cargar();
  }

  // ═════════════════════════ ANUNCIOS ═════════════════════════
  function vistaAnuncios(p) {
    p.innerHTML =
      '<div class="tarjeta"><h3 id="aTit">Nuevo anuncio</h3>' +
      '<label>Tipo</label><select id="aTipo"><option value="general">General</option><option value="predicador">Predicador</option></select>' +
      '<label>Título</label><input type="text" id="aTitulo"><label>Contenido</label><textarea id="aCont"></textarea>' +
      '<div class="fila" style="margin-top:10px"><label style="margin:0"><input type="checkbox" id="aFlot"> Flotante (máx. 2 activos)</label>' +
      '<label style="margin:0"><input type="checkbox" id="aAct" checked> Activo</label></div>' +
      '<div class="fila" style="margin-top:14px"><button class="btn" id="aSave">Guardar</button><button class="btn sec" id="aCancel" style="display:none">Cancelar edición</button></div>' +
      '<div class="estado" id="aMsg"></div></div>' +
      '<div class="tarjeta"><h3>Anuncios</h3><ul class="lista" id="aLista"><li>Cargando…</li></ul></div>';
    const $ = function (id) { return p.querySelector('#' + id); };
    let editId = null, cache = [];

    function limpiar() {
      editId = null; $('aTit').textContent = 'Nuevo anuncio'; $('aTitulo').value = ''; $('aCont').value = '';
      $('aTipo').value = 'general'; $('aFlot').checked = false; $('aAct').checked = true; $('aCancel').style.display = 'none';
    }
    async function cargar() {
      try {
        const r = await llamar('listar_anuncios_admin'); cache = r.anuncios;
        $('aLista').innerHTML = cache.length ? cache.map(function (a) {
          return '<li><div class="txt"><b>' + esc(a.titulo) + '</b> <span class="sub">(' + esc(a.tipo) + (a.flotante ? ', flotante' : '') + ')</span>' +
            '<div class="sub">' + esc(a.contenido).slice(0, 120) + '</div></div>' +
            '<span class="pill' + (a.activo ? '' : ' off') + '">' + (a.activo ? 'activo' : 'oculto') + '</span>' +
            '<button class="btn sec chico" data-e="' + esc(a.id) + '">Editar</button>' +
            '<button class="btn sec chico" data-t="' + esc(a.id) + '" data-a="' + a.activo + '">' + (a.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(a.id) + '">Borrar</button></li>';
        }).join('') : '<li>Aún no hay anuncios.</li>';
        $('aLista').querySelectorAll('[data-e]').forEach(function (b) {
          b.onclick = function () {
            const a = cache.find(function (x) { return x.id === b.dataset.e; }); editId = a.id;
            $('aTit').textContent = 'Editar anuncio'; $('aTipo').value = a.tipo; $('aTitulo').value = a.titulo;
            $('aCont').value = a.contenido; $('aFlot').checked = a.flotante; $('aAct').checked = a.activo; $('aCancel').style.display = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          };
        });
        $('aLista').querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () {
            try { await llamar('toggle_anuncio_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargar(); }
            catch (e) { msg($('aMsg'), e.message, 'mal'); }
          };
        });
        $('aLista').querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () { if (confirm('¿Borrar este anuncio?')) { await llamar('eliminar_anuncio', { id: b.dataset.d }); cargar(); } };
        });
      } catch (e) { $('aLista').innerHTML = '<li class="estado mal">' + esc(e.message) + '</li>'; }
    }
    $('aCancel').onclick = limpiar;
    $('aSave').onclick = async function () {
      msg($('aMsg'), 'Guardando…');
      try {
        await llamar('guardar_anuncio', {
          id: editId, tipo: $('aTipo').value, titulo: $('aTitulo').value, contenido: $('aCont').value,
          flotante: $('aFlot').checked, activo: $('aAct').checked
        });
        limpiar(); msg($('aMsg'), 'Guardado ✔', 'ok'); cargar();
      } catch (e) { msg($('aMsg'), e.message, 'mal'); }
    };
    cargar();
  }

  // ═════════════════════════ PETICIONES ═════════════════════════
  function vistaPeticiones(p) {
    p.innerHTML = '<div class="tarjeta"><h3>Peticiones de oración</h3><ul class="lista" id="pLista"><li>Cargando…</li></ul></div>';
    llamar('obtener_peticiones').then(function (r) {
      p.querySelector('#pLista').innerHTML = r.peticiones.length ? r.peticiones.map(function (x) {
        return '<li><div class="txt">' + esc(x.texto) + '<div class="sub">' + esc(x.fecha) + '</div></div></li>';
      }).join('') : '<li>Aún no hay peticiones.</li>';
    }).catch(function (e) { p.querySelector('#pLista').innerHTML = '<li class="estado mal">' + esc(e.message) + '</li>'; });
  }
})();
