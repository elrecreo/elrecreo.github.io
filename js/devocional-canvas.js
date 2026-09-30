/**
 * Composición del devocional sobre la imagen de fondo.
 * Posiciones en fracciones del alto (H) / ancho (W) — igual que DevocionalComposer.kt en la app.
 * Medidas tomadas del diseño de Canva: cita bajo el título, versículo al centro, reflexión debajo.
 */
const DEV_LAYOUT = {
  cita:      { cy: 0.336, size: 0.058, maxW: 0.80 },
  versiculo: { cy: 0.478, size: 0.051, maxW: 0.86, zona: [0.390, 0.585] },
  cuerpo:    { cy: 0.668, size: 0.051, maxW: 0.92, zona: [0.610, 0.735] },
  interlineado: 1.16
};
// >>> AJUSTE MANUAL <<<
// Desplazamiento vertical de TODO el texto (cita + versículo + reflexión), en fracción del alto de la imagen.
// Positivo = baja, negativo = sube, 0 = posición original del layout. Ej: 0.01 ≈ 1% del alto.
const DEV_DESPLAZAMIENTO_Y = -0.065;

// >>> AJUSTE MANUAL <<<
// Recorte por ABAJO al COMPARTIR la imagen, en fracción del alto (0.08 = 8%).
// Solo afecta a lo que se comparte; lo que se publica en Drive queda completo.
const DEV_RECORTE_ABAJO_COMPARTIR = 0.08;
// ¿Aplicar ese mismo recorte al compartir un devocional ya publicado (el de la lista)? true = sí, false = se envía completo.
const DEV_RECORTAR_PUBLICADOS = true;

const DEV_PESO = 700;      // versículo y reflexión (antes 600)
const DEV_PESO_CITA = 400; // cita en cursiva (antes 300)
const DEV_COLOR = '#5F535D'; // color por defecto (95, 83, 93); se puede cambiar en el selector del panel
const DEV_FUENTE = 'Montserrat, "Segoe UI", Arial, sans-serif';

function partirLineas(ctx, texto, anchoMax) {
  const lineas = [];
  String(texto).split('\n').forEach(function (parrafo) {
    const palabras = parrafo.trim().split(/\s+/).filter(Boolean);
    if (!palabras.length) { lineas.push(''); return; }
    let actual = palabras[0];
    for (let i = 1; i < palabras.length; i++) {
      const prueba = actual + ' ' + palabras[i];
      if (ctx.measureText(prueba).width <= anchoMax) actual = prueba;
      else { lineas.push(actual); actual = palabras[i]; }
    }
    lineas.push(actual);
  });
  return lineas;
}

function dibujarBloque(ctx, W, H, texto, cfg) {
  if (!texto) return;
  const anchoMax = cfg.maxW * W;
  const altoZona = (cfg.zona[1] - cfg.zona[0]) * H;
  let tam = cfg.size * W;
  const minimo = tam * 0.6;
  let lineas, alto;
  for (;;) {
    ctx.font = DEV_PESO + ' ' + tam + 'px ' + DEV_FUENTE;
    lineas = partirLineas(ctx, texto, anchoMax);
    alto = lineas.length * tam * DEV_LAYOUT.interlineado;
    if (alto <= altoZona || tam <= minimo) break;
    tam *= 0.96;
  }
  let top = cfg.cy * H - alto / 2;
  top = Math.max(cfg.zona[0] * H, Math.min(top, cfg.zona[1] * H - alto));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lineas.forEach(function (l, i) {
    ctx.fillText(l, W / 2, top + (i + 0.5) * tam * DEV_LAYOUT.interlineado);
  });
}

async function cargarFuentesDevocional() {
  try {
    await Promise.all([document.fonts.load(DEV_PESO + ' 40px Montserrat'), document.fonts.load('italic ' + DEV_PESO_CITA + ' 40px Montserrat')]);
  } catch (e) { /* si no cargan, se usa la de respaldo */ }
}

/** fondo: HTMLImageElement ya cargada (o null para un degradado de prueba). */
function dibujarDevocional(canvas, fondo, datos) {
  const W = fondo ? fondo.naturalWidth : 941;
  const H = fondo ? fondo.naturalHeight : 1672;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (fondo) ctx.drawImage(fondo, 0, 0, W, H);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9cc7f2'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(1, '#e3ecfa');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  ctx.fillStyle = datos.color || DEV_COLOR;
  ctx.translate(0, DEV_DESPLAZAMIENTO_Y * H); // baja todos los textos por igual

  // Cita (ej. "Salmos 34 : 1") — cursiva ligera
  const c = DEV_LAYOUT.cita;
  if (datos.cita) {
    ctx.font = 'italic ' + DEV_PESO_CITA + ' ' + (c.size * W) + 'px ' + DEV_FUENTE;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(datos.cita, W / 2, c.cy * H);
  }

  let v = (datos.versiculo || '').trim();
  if (v && !/^[“"«]/.test(v)) v = '“' + v + '”';
  dibujarBloque(ctx, W, H, v, DEV_LAYOUT.versiculo);
  dibujarBloque(ctx, W, H, (datos.cuerpo || '').trim(), DEV_LAYOUT.cuerpo);
}

/** Copia de la imagen sin la franja inferior sobrante (DEV_RECORTE_ABAJO_COMPARTIR). */
function recortarParaCompartir(fuente, ancho, alto) {
  const h = Math.round(alto * (1 - DEV_RECORTE_ABAJO_COMPARTIR));
  const out = document.createElement('canvas');
  out.width = ancho; out.height = h;
  out.getContext('2d').drawImage(fuente, 0, 0, ancho, h, 0, 0, ancho, h);
  return out;
}

function canvasParaCompartir(canvas) {
  return recortarParaCompartir(canvas, canvas.width, canvas.height);
}

/** Devocional ya publicado (Blob bajado de Drive) -> Blob JPG recortado, listo para compartir. */
function blobPublicadoParaCompartir(blob) {
  if (!DEV_RECORTAR_PUBLICADOS) return Promise.resolve(blob);
  return new Promise(function (resolve, reject) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = function () {
      const c = recortarParaCompartir(img, img.naturalWidth, img.naturalHeight);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? resolve(b) : reject(new Error('No se pudo preparar la imagen')); }, 'image/jpeg', 0.95);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
