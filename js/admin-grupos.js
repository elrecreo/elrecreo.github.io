/* Admin del devocional de Hombres y de Damas — se muestra solo en  …/#hombres  y  …/#damas
   Cada publicación es de UN tipo: texto, imagen o audio (el audio se graba aquí mismo o se sube). */
(function () {
  const cont = document.getElementById('grupos');
  if (!cont) return;

  const GRUPOS = {
    hombres: { titulo: 'HOMBRE DE VALOR', color: '#1d4f91' },
    damas:   { titulo: 'DEVOCIONAL DE MUJER A MUJER', color: '#a3365f' }
  };
  const ALIAS = { '#hombres': 'hombres', '#hombre': 'hombres', '#caballeros': 'hombres', '#caballero': 'hombres',
                  '#damas': 'damas', '#dama': 'damas', '#mujeres': 'damas', '#mujer': 'damas' };
  const MAX_ARCHIVO = 25 * 1024 * 1024;   // el script acepta ≈ 27 MB
  const MAX_GRABACION_S = 40 * 60;
  const ETIQUETA_TIPO = { texto: 'Texto', imagen: 'Imagen', audio: 'Audio' };

  let grupoActual = null, limpiar = null;

  function grupoDeHash() { return ALIAS[String(location.hash || '').toLowerCase().replace(/\/+$/, '')] || null; }

  function render() {
    if (limpiar) { try { limpiar(); } catch (e) { /* nada */ } limpiar = null; }
    const g = grupoDeHash();
    grupoActual = g;
    cont.innerHTML = '';
    if (!g) return;
    document.title = GRUPOS[g].titulo + ' — Administración';
    limpiar = montar(g, cont);
  }
  window.addEventListener('hashchange', render);
  render();

  function msg(e, texto, tipo) { e.textContent = texto || ''; e.className = 'estado ' + (tipo || ''); }
  function segundos(n) { n = Math.max(0, Math.floor(n)); return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2); }

  function blobBase64(blob) {
    return new Promise(function (res, rej) {
      const r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = function () { rej(new Error('No se pudo leer el archivo')); };
      r.readAsDataURL(blob);
    });
  }

  /** Reduce la imagen (máx. 1600 px, JPG) para que suba rápido y pese poco. */
  function comprimirImagen(archivo) {
    return new Promise(function (res, rej) {
      const url = URL.createObjectURL(archivo), img = new Image();
      img.onload = function () {
        const m = 1600, k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('No se pudo preparar la imagen')); }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('Ese archivo no parece una imagen válida')); };
      img.src = url;
    });
  }

  function montar(grupo, raiz) {
    const info = GRUPOS[grupo];
    raiz.innerHTML =
      '<header class="cabecera"><div class="marca"><img src="img/logo.png" alt="" width="44" height="44">' +
      '<div><strong>' + esc(info.titulo) + '</strong><span>Administración · Centro Cristiano El Recreo</span></div></div></header>' +
      '<main class="panel gr-panel">' +
      '<section class="seccion"><h2 id="gTitulo">Nueva publicación</h2>' +
      '<div class="editando" id="gEditando" hidden><span>Editando una publicación</span><button class="btn sec chico" id="gCancelar">Cancelar</button></div>' +
      '<div class="gr-modos" role="tablist" aria-label="Tipo de publicación">' +
      ['texto', 'imagen', 'audio'].map(function (t) { return '<button type="button" class="gr-modo" data-modo="' + t + '" role="tab">' + ETIQUETA_TIPO[t] + '</button>'; }).join('') + '</div>' +
      '<div id="gLiderCaja"></div>' +
      '<label for="gTit">Título (opcional)</label><input type="text" id="gTit" maxlength="120" autocomplete="off">' +
      '<div id="gModoTexto"><label for="gTexto" id="gTextoEt">Texto</label><textarea id="gTexto" rows="8"></textarea></div>' +
      '<div id="gModoImagen" hidden><label for="gImg">Imagen</label><input type="file" id="gImg" accept="image/*"><img id="gImgVista" class="gr-vista" alt="" hidden></div>' +
      '<div id="gModoAudio" hidden><label>Audio</label>' +
      '<div class="gr-rec"><button type="button" class="btn gr-grabar" id="gRec">● Grabar</button><span class="gr-tiempo" id="gTiempo" aria-live="off">0:00</span></div>' +
      '<div class="gr-o">o sube un archivo de audio</div><input type="file" id="gAud" accept="audio/*">' +
      '<audio id="gAudVista" class="gr-audio" controls hidden></audio>' +
      '<div class="fila" style="margin-top:8px"><button type="button" class="btn sec chico" id="gDescartar" hidden>Descartar audio</button></div></div>' +
      '<div id="gNotaMedia" class="gr-nota" hidden>Ya tiene un archivo guardado: se conserva si no eliges otro.</div>' +
      '<div class="fila" style="margin-top:18px"><button class="btn" id="gPub">Publicar</button></div>' +
      '<div class="estado" id="gMsg" role="status"></div></section>' +
      '<section class="seccion"><h2>Publicados</h2><ul class="items gr-lista" id="gLista"><li class="vacio">Cargando…</li></ul></section></main>';
    raiz.style.setProperty('--gr', info.color);

    const $ = function (id) { return raiz.querySelector('#' + id); };
    // Nombre del líder: se pide una sola vez y queda guardado en este navegador.
    const CLAVE_LIDER = 'rc:lider_admin';
    function liderGuardado() { try { return localStorage.getItem(CLAVE_LIDER) || ''; } catch (e) { return ''; } }
    function guardarLider(n) { try { localStorage.setItem(CLAVE_LIDER, n); } catch (e) { /* sin almacenamiento: se vuelve a pedir */ } }
    function olvidarLider() { try { localStorage.removeItem(CLAVE_LIDER); } catch (e) { /* nada */ } }
    let liderActual = liderGuardado();
    function pintarLider() {
      const caja = $('gLiderCaja');
      if (liderActual) {
        caja.innerHTML = '<div class="gr-lider">Publicas como <b>' + esc(liderActual) + '</b> <button type="button" class="btn sec chico" id="gCambiarLider">Cambiar</button></div>';
        $('gCambiarLider').onclick = function () { olvidarLider(); liderActual = ''; pintarLider(); $('gLider').focus(); };
      } else {
        caja.innerHTML = '<label for="gLider">Nombre del líder</label><input type="text" id="gLider" maxlength="80" autocomplete="name">';
      }
    }
    let modo = 'texto', editId = null, editMediaUrl = '', cache = [];
    let imagenBlob = null, audioBlob = null, audioUrl = null, audioNombre = 'audio.webm';
    let grabador = null, flujo = null, trozos = [], reloj = null, inicioRec = 0, cerrado = false;

    function pintarModo() {
      raiz.querySelectorAll('.gr-modo').forEach(function (b) {
        const on = b.dataset.modo === modo;
        b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
        b.disabled = !!editId && !on;   // al editar no se cambia el tipo
      });
      $('gModoTexto').hidden = false;   // el texto siempre se puede escribir (en imagen/audio es un pie opcional)
      $('gTextoEt').textContent = modo === 'texto' ? 'Texto' : 'Texto o pie (opcional)';
      $('gTexto').rows = modo === 'texto' ? 8 : 3;
      $('gModoImagen').hidden = modo !== 'imagen';
      $('gModoAudio').hidden = modo !== 'audio';
      $('gNotaMedia').hidden = !(editId && editMediaUrl && modo !== 'texto');
    }
    raiz.querySelectorAll('.gr-modo').forEach(function (b) { b.onclick = function () { if (grabador) return; modo = b.dataset.modo; pintarModo(); msg($('gMsg'), ''); }; });

    // ── Imagen ──
    $('gImg').onchange = async function (ev) {
      const f = ev.target.files[0]; imagenBlob = null; $('gImgVista').hidden = true;
      if (!f) return;
      try {
        imagenBlob = await comprimirImagen(f);
        $('gImgVista').src = URL.createObjectURL(imagenBlob); $('gImgVista').hidden = false;
      } catch (e) { msg($('gMsg'), e.message, 'mal'); ev.target.value = ''; }
    };

    // ── Audio: subir o grabar ──
    function ponerAudio(blob, nombre) {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioBlob = blob; audioNombre = nombre; audioUrl = URL.createObjectURL(blob);
      $('gAudVista').src = audioUrl; $('gAudVista').hidden = false; $('gDescartar').hidden = false;
    }
    function quitarAudio() {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioBlob = null; audioUrl = null;
      $('gAudVista').removeAttribute('src'); $('gAudVista').hidden = true; $('gDescartar').hidden = true; $('gAud').value = '';
    }
    $('gDescartar').onclick = quitarAudio;
    $('gAud').onchange = function (ev) {
      const f = ev.target.files[0]; if (!f) return;
      if (f.size > MAX_ARCHIVO) { msg($('gMsg'), 'El audio pesa más de 25 MB. Usa uno más corto o más liviano.', 'mal'); ev.target.value = ''; return; }
      ponerAudio(f, f.name); msg($('gMsg'), '');
    };

    function pararRelojYFlujo() {
      clearInterval(reloj); reloj = null;
      if (flujo) { flujo.getTracks().forEach(function (t) { t.stop(); }); flujo = null; }
    }
    function terminarGrabacion() {
      if (!grabador) return;
      const g = grabador; grabador = null;
      if (g.state !== 'inactive') g.stop();
      $('gRec').textContent = '● Grabar'; $('gRec').classList.remove('grabando');
    }
    $('gRec').onclick = async function () {
      if (grabador) { terminarGrabacion(); return; }
      if (!navigator.mediaDevices || !window.MediaRecorder) { msg($('gMsg'), 'Este navegador no puede grabar. Sube un archivo de audio.', 'mal'); return; }
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (e) { msg($('gMsg'), 'No se pudo usar el micrófono. Revisa el permiso del navegador.', 'mal'); return; }
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(function (m) { return MediaRecorder.isTypeSupported(m); }) || '';
      trozos = [];
      try { grabador = new MediaRecorder(flujo, mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined); }
      catch (e) { pararRelojYFlujo(); msg($('gMsg'), 'No se pudo iniciar la grabación.', 'mal'); return; }
      const rec = grabador;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) trozos.push(e.data); };
      rec.onstop = function () {
        pararRelojYFlujo();
        if (cerrado) return;
        const tipo = (rec.mimeType || mime || 'audio/webm').split(';')[0];
        const blob = new Blob(trozos, { type: tipo });
        if (blob.size > MAX_ARCHIVO) { msg($('gMsg'), 'La grabación quedó demasiado pesada. Graba una más corta.', 'mal'); return; }
        if (blob.size < 500) { msg($('gMsg'), 'No se grabó nada. Inténtalo otra vez.', 'mal'); return; }
        ponerAudio(blob, 'grabacion.' + (tipo.indexOf('mp4') >= 0 ? 'm4a' : tipo.indexOf('ogg') >= 0 ? 'ogg' : 'webm'));
        msg($('gMsg'), 'Escucha la grabación y, si te gusta, publica.', '');
      };
      quitarAudio();
      rec.start(1000);
      inicioRec = Date.now();
      $('gRec').textContent = '■ Detener'; $('gRec').classList.add('grabando'); $('gTiempo').textContent = '0:00';
      msg($('gMsg'), 'Grabando…', '');
      reloj = setInterval(function () {
        const s = (Date.now() - inicioRec) / 1000; $('gTiempo').textContent = segundos(s);
        if (s >= MAX_GRABACION_S) terminarGrabacion();
      }, 250);
    };

    // ── Publicar ──
    function limpiarFormulario() {
      editId = null; editMediaUrl = '';
      $('gTit').value = ''; $('gTexto').value = ''; $('gImg').value = ''; $('gImgVista').hidden = true; imagenBlob = null; quitarAudio();
      $('gEditando').hidden = true; $('gTitulo').textContent = 'Nueva publicación'; $('gPub').textContent = 'Publicar';
      pintarModo();
    }
    $('gCancelar').onclick = function () { limpiarFormulario(); msg($('gMsg'), ''); };

    $('gPub').onclick = async function () {
      if (grabador) { msg($('gMsg'), 'Detén la grabación antes de publicar.', 'mal'); return; }
      const texto = $('gTexto').value.trim(), titulo = $('gTit').value.trim();
      let lider = liderActual;
      if (!lider) {
        lider = ($('gLider') ? $('gLider').value : '').trim();
        if (!lider) { msg($('gMsg'), 'Escribe el nombre del líder.', 'mal'); $('gLider').focus(); return; }
      }
      const datos = { grupo: grupo, tipo: modo, titulo: titulo, texto: texto, lider: lider, activo: true };
      if (editId) datos.id = editId;
      try {
        if (modo === 'texto' && !texto) throw new Error('Escribe el texto del devocional.');
        if (modo === 'imagen') {
          if (!imagenBlob && !(editId && editMediaUrl)) throw new Error('Elige una imagen.');
          if (imagenBlob) { datos.archivoBase64 = await blobBase64(imagenBlob); datos.archivoTipo = 'image/jpeg'; datos.archivoNombre = 'imagen.jpg'; }
        }
        if (modo === 'audio') {
          if (!audioBlob && !(editId && editMediaUrl)) throw new Error('Graba un audio o sube un archivo.');
          if (audioBlob) { datos.archivoBase64 = await blobBase64(audioBlob); datos.archivoTipo = (audioBlob.type || 'audio/mpeg').split(';')[0]; datos.archivoNombre = audioNombre; }
        }
      } catch (e) { msg($('gMsg'), e.message, 'mal'); return; }
      const btn = $('gPub'); btn.disabled = true;
      msg($('gMsg'), datos.archivoBase64 ? 'Subiendo… (un audio largo puede tardar un momento)' : 'Guardando…');
      try {
        await llamar('guardar_devocional_grupo', datos);
        if (!liderActual) { liderActual = lider; guardarLider(lider); pintarLider(); }
        const edit = !!editId;
        limpiarFormulario();
        msg($('gMsg'), edit ? 'Cambios guardados' : 'Publicado', 'ok');
        cargarLista();
      } catch (e) { msg($('gMsg'), e.message, 'mal'); }
      btn.disabled = false;
    };

    // ── Lista ──
    function fragmento(d) {
      const t = d.titulo ? '<b>' + esc(d.titulo) + '</b> ' : '';
      let cuerpo = '';
      if (d.tipo === 'texto') cuerpo = '<div class="gr-extracto">' + esc(d.texto.length > 220 ? d.texto.slice(0, 220) + '…' : d.texto) + '</div>';
      else if (d.tipo === 'audio') cuerpo = '<div class="gr-slot-audio" data-id="' + esc(d.id) + '"></div>' + (d.texto ? '<div class="gr-extracto">' + esc(d.texto) + '</div>' : '');
      else cuerpo = (d.texto ? '<div class="gr-extracto">' + esc(d.texto) + '</div>' : '');
      return t + '<span class="marca-estado' + (d.activo ? '' : ' off') + '">' + ETIQUETA_TIPO[d.tipo] + (d.activo ? '' : ' · oculto') + '</span>' +
        '<div class="sub">' + (d.lider ? esc(d.lider) + ' · ' : '') + esc(d.fecha) + '</div>' + cuerpo;
    }
    async function cargarLista() {
      const lista = $('gLista');
      try {
        const r = await llamar('listar_devocional_grupo_admin', { grupo: grupo });
        cache = r.items || [];
        lista.innerHTML = cache.length ? cache.map(function (d, i) {
          return '<li class="' + (d.activo ? '' : 'oculto') + (d.tipo === 'imagen' ? '' : ' sin-mini') + '">' +
            (d.tipo === 'imagen' ? '<span class="mini-slot flyer" data-i="' + i + '"></span>' : '') +
            '<div class="txt">' + fragmento(d) + '</div>' +
            '<div class="acciones"><button class="btn sec chico" data-e="' + esc(d.id) + '">Editar</button>' +
            '<button class="btn sec chico" data-t="' + esc(d.id) + '" data-a="' + d.activo + '">' + (d.activo ? 'Ocultar' : 'Mostrar') + '</button>' +
            '<button class="btn mal chico" data-d="' + esc(d.id) + '">Borrar</button></div></li>';
        }).join('') : '<li class="vacio">Aún no hay publicaciones.</li>';
        lista.querySelectorAll('.gr-slot-audio').forEach(function (sl) { sl.appendChild(crearReproductorGrupo(sl.dataset.id)); });
        lista.querySelectorAll('.mini-slot').forEach(function (sl) { cargarMiniatura(sl, urlsMiniatura(cache[sl.dataset.i].mediaUrl, 320)); });
        lista.querySelectorAll('[data-e]').forEach(function (b) {
          b.onclick = function () {
            const d = cache.find(function (x) { return x.id === b.dataset.e; }); if (!d) return;
            quitarAudio(); $('gImg').value = ''; $('gImgVista').hidden = true; imagenBlob = null;
            editId = d.id; editMediaUrl = d.mediaUrl || ''; modo = d.tipo;
            $('gTit').value = d.titulo; $('gTexto').value = d.texto;
            $('gEditando').hidden = false; $('gTitulo').textContent = 'Editar publicación'; $('gPub').textContent = 'Guardar cambios';
            pintarModo(); msg($('gMsg'), ''); window.scrollTo({ top: 0, behavior: 'smooth' });
          };
        });
        lista.querySelectorAll('[data-t]').forEach(function (b) {
          b.onclick = async function () {
            b.disabled = true;
            try { await llamar('toggle_devocional_grupo_activo', { id: b.dataset.t, activo: b.dataset.a !== 'true' }); cargarLista(); }
            catch (e) { msg($('gMsg'), e.message, 'mal'); b.disabled = false; }
          };
        });
        lista.querySelectorAll('[data-d]').forEach(function (b) {
          b.onclick = async function () {
            if (!confirm('¿Borrar esta publicación y su archivo?')) return;
            try { await llamar('eliminar_devocional_grupo', { id: b.dataset.d }); if (editId === b.dataset.d) limpiarFormulario(); cargarLista(); }
            catch (e) { msg($('gMsg'), e.message, 'mal'); }
          };
        });
      } catch (e) { lista.innerHTML = '<li class="vacio estado mal">' + esc(e.message) + '</li>'; }
    }

    pintarLider();
    pintarModo();
    cargarLista();

    // al salir de la página: apagar micrófono y liberar audio
    return function () { cerrado = true; terminarGrabacion(); pararRelojYFlujo(); if (audioUrl) URL.revokeObjectURL(audioUrl); raiz.style.removeProperty('--gr'); document.title = 'Centro Cristiano El Recreo'; };
  }
})();
