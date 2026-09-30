/**
 * Biblia Reina-Valera 1960 en la web. Lógica portada de BibliaParser.kt de la app:
 * mismo mapa de libros (con abreviaturas y variantes) y misma forma de leer la referencia.
 * Los textos están en data/biblia_rv1960.json y se descargan solo la primera vez que se necesitan.
 */
const BibliaWeb = (function () {
  // nombre normalizado (sin tildes, minúsculas) -> id de libro (1 = Génesis … 66 = Apocalipsis)
  const LIBROS_MAP = {
  "genesis": 1, "gen": 1, "gn": 1, "jenesis": 1, "henesis": 1,
  "exodo": 2, "ex": 2, "exo": 2, "esodo": 2,
  "levitico": 3, "lev": 3, "lv": 3, "lebitiko": 3, "lebitico": 3,
  "numeros": 4, "num": 4, "nm": 4, "numero": 4,
  "deuteronomio": 5, "deut": 5, "dt": 5, "deuterenomio": 5, "deuteronimo": 5,
  "josue": 6, "jos": 6, "hosue": 6, "josua": 6,
  "jueces": 7, "jue": 7, "hueces": 7, "juece": 7,
  "rut": 8, "rt": 8, "ruth": 8, "ruts": 8, "rus": 8, "ruz": 8, "rute": 8, "ru": 8,
  "1samuel": 9, "1sam": 9, "1s": 9, "samuel": 9, "primersamuel": 9, "primerosamuel": 9, "primerasamuel": 9, "primer de samuel": 9, "primero de samuel": 9, "primera de samuel": 9, "unosamuel": 9, "uno de samuel": 9,
  "2samuel": 10, "2sam": 10, "2s": 10, "segundosamuel": 10, "segundasamuel": 10, "segundo de samuel": 10, "segunda de samuel": 10, "dossamuel": 10, "dos de samuel": 10,
  "1reyes": 11, "1re": 11, "1r": 11, "reyes": 11, "primerreyes": 11, "primeroreyes": 11, "primer de reyes": 11, "primero de reyes": 11, "primera de reyes": 11, "uno de reyes": 11, "unoreyes": 11,
  "2reyes": 12, "2re": 12, "2r": 12, "segundoreyes": 12, "segundo de reyes": 12, "segunda de reyes": 12, "dosreyes": 12, "dos de reyes": 12,
  "1cronicas": 13, "1cr": 13, "cronicas": 13, "primercronicas": 13, "primerocronicas": 13, "primer de cronicas": 13, "primero de cronicas": 13, "primera de cronicas": 13, "uno de cronicas": 13,
  "2cronicas": 14, "2cr": 14, "segundocronicas": 14, "segundo de cronicas": 14, "segunda de cronicas": 14, "dos de cronicas": 14,
  "esdras": 15, "esd": 15, "esdra": 15, "ezdras": 15,
  "nehemias": 16, "neh": 16, "neemias": 16, "nehemia": 16,
  "ester": 17, "est": 17, "esther": 17, "hester": 17,
  "job": 18, "jo": 18, "jov": 18, "joe": 18, "yob": 18, "jobe": 18, "jobs": 18,
  "salmos": 19, "salmo": 19, "sal": 19, "sl": 19, "psalm": 19, "psalmos": 19,
  "proverbios": 20, "prov": 20, "pr": 20, "proverbio": 20, "proberbios": 20,
  "eclesiastes": 21, "ecl": 21, "ec": 21, "ecclesiastes": 21, "ecle": 21,
  "cantares": 22, "cnt": 22, "cantar": 22, "cantardelos cantares": 22, "cantico": 22, "canticos": 22, "cant": 22, "cantar de los cantares": 22, "cantares de salomon": 22,
  "isaias": 23, "is": 23, "esaias": 23, "ysaias": 23,
  "jeremias": 24, "jer": 24, "jeremia": 24, "heremias": 24,
  "lamentaciones": 25, "lam": 25, "lm": 25, "lamentacion": 25,
  "ezequiel": 26, "ez": 26, "ezekiel": 26, "hesekiel": 26,
  "daniel": 27, "dn": 27, "daniyel": 27,
  "oseas": 28, "os": 28, "hoseas": 28, "osea": 28,
  "joel": 29, "jl": 29, "yoel": 29, "juel": 29,
  "amos": 30, "am": 30,
  "abdias": 31, "abd": 31, "obadias": 31, "abdia": 31,
  "jonas": 32, "jon": 32, "yonas": 32,
  "miqueas": 33, "mi": 33, "miquea": 33, "mikeas": 33,
  "nahum": 34, "nah": 34, "naum": 34, "nahun": 34, "nahume": 34,
  "habacuc": 35, "hab": 35, "habakuk": 35, "habacuk": 35, "habacus": 35, "abacuc": 35, "abacuk": 35, "habacuq": 35,
  "sofonias": 36, "sof": 36, "sofonia": 36,
  "hageo": 37, "hag": 37, "ageo": 37, "ajeo": 37, "hago": 37,
  "zacarias": 38, "zac": 38, "sacarias": 38,
  "malaquias": 39, "mal": 39, "malaquia": 39, "malachias": 39,
  "mateo": 40, "mt": 40, "matteo": 40,
  "marcos": 41, "mr": 41, "mc": 41, "marco": 41, "markos": 41,
  "lucas": 42, "lc": 42, "luca": 42, "lukas": 42,
  "juan": 43, "jn": 43, "jhuan": 43, "huan": 43,
  "hechos": 44, "hch": 44, "echos": 44, "echo": 44, "hechos delos apostoles": 44, "actos": 44, "acto": 44, "hecho": 44,
  "romanos": 45, "ro": 45, "rom": 45, "romano": 45,
  "1corintios": 46, "1cor": 46, "1co": 46, "corintios": 46, "primercorintios": 46, "primerocorintios": 46, "primer de corintios": 46, "primero de corintios": 46, "primera de corintios": 46, "uno de corintios": 46,
  "2corintios": 47, "2cor": 47, "2co": 47, "segundocorintios": 47, "segundo de corintios": 47, "segunda de corintios": 47, "dos de corintios": 47,
  "galatas": 48, "gal": 48, "ga": 48, "galata": 48,
  "efesios": 49, "ef": 49, "efesio": 49, "efesos": 49,
  "filipenses": 50, "filipense": 50, "filipensios": 50, "fil": 50, "flp": 50, "filip": 50,
  "colosenses": 51, "col": 51, "colosense": 51,
  "1tesalonicenses": 52, "1tes": 52, "1ts": 52, "tesalonicenses": 52, "tesalonicenese": 52, "primertesalonicenses": 52, "primerotesalonicenses": 52, "primer de tesalonicenses": 52, "primero de tesalonicenses": 52, "primera de tesalonicenses": 52, "uno de tesalonicenses": 52,
  "2tesalonicenses": 53, "2tes": 53, "2ts": 53, "segundotesalonicenses": 53, "segundo de tesalonicenses": 53, "segunda de tesalonicenses": 53, "dos de tesalonicenses": 53,
  "1timoteo": 54, "1tim": 54, "1ti": 54, "timoteo": 54, "primertimoteo": 54, "primerotimoteo": 54, "primer de timoteo": 54, "primero de timoteo": 54, "primera de timoteo": 54, "uno de timoteo": 54,
  "2timoteo": 55, "2tim": 55, "2ti": 55, "segundotimoteo": 55, "segundo de timoteo": 55, "segunda de timoteo": 55, "dos de timoteo": 55,
  "tito": 56, "tit": 56, "titus": 56,
  "filemon": 57, "flm": 57,
  "hebreos": 58, "he": 58, "heb": 58, "ebreos": 58, "ebrero": 58, "hebreo": 58,
  "santiago": 59, "stg": 59, "santago": 59, "santiagos": 59, "sant": 59, "sgo": 59,
  "1pedro": 60, "1pe": 60, "1p": 60, "pedro": 60, "primerpedro": 60, "primeropedro": 60, "primerapedro": 60, "primer de pedro": 60, "primero de pedro": 60, "primera de pedro": 60, "uno de pedro": 60,
  "2pedro": 61, "2pe": 61, "2p": 61, "segundopedro": 61, "segundo de pedro": 61, "segunda de pedro": 61, "dos de pedro": 61,
  "1juan": 62, "1jn": 62, "primerjuan": 62, "primerojuan": 62, "primer de juan": 62, "primero de juan": 62, "primera de juan": 62, "uno de juan": 62,
  "2juan": 63, "2jn": 63, "segundojuan": 63, "segundo de juan": 63, "segunda de juan": 63, "dos de juan": 63,
  "3juan": 64, "3jn": 64, "tercerjuan": 64, "tercerojuan": 64, "tercer de juan": 64, "tercero de juan": 64, "tercera de juan": 64, "tres de juan": 64,
  "judas": 65, "jud": 65, "juda": 65, "yudas": 65,
  "apocalipsis": 66, "ap": 66, "apoc": 66, "apocalipsi": 66, "apocalisis": 66, "revelacion": 66, "revelaciones": 66, "apocalipsis de juan": 66
  };

  const NUMEROS_PALABRAS = {"uno": 1, "una": 1, "primer": 1, "primero": 1, "primera": 1, "dos": 2, "segundo": 2, "segunda": 2, "tres": 3, "tercero": 3, "tercera": 3, "cuatro": 4, "cuarto": 4, "cinco": 5, "quinto": 5, "seis": 6, "sexto": 6, "siete": 7, "septimo": 7, "ocho": 8, "octavo": 8, "nueve": 9, "noveno": 9, "diez": 10, "decimo": 10, "once": 11, "doce": 12, "trece": 13, "13": 13, "catorce": 14, "quince": 15, "dieciseis": 16, "diecisiete": 17, "dieciocho": 18, "diecinueve": 19, "veinte": 20, "veintiuno": 21, "veintidos": 22, "veintitres": 23, "veinticuatro": 24, "veinticinco": 25, "veintiseis": 26, "veintisiete": 27, "veintiocho": 28, "veintinueve": 29, "treinta": 30, "cuarenta": 40, "cincuenta": 50, "sesenta": 60, "setenta": 70, "ochenta": 80, "noventa": 90, "cien": 100, "ciento": 100};

  function normalizar(texto) {
    return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function palabraANumero(p) {
    const n = parseInt(p, 10);
    return isNaN(n) ? (NUMEROS_PALABRAS[p] != null ? NUMEROS_PALABRAS[p] : null) : n;
  }

  /** "juan 3 16" -> { libroId: 43, capitulo: 3, versiculo: 16 } (o null si no reconoce el libro). */
  function parsearReferencia(texto) {
    const palabras = normalizar(texto).split(' ').filter(Boolean);
    if (!palabras.length) return null;
    let libroId = null, indicePostLibro = 0;
    for (let len = Math.min(5, palabras.length); len >= 1; len--) {
      const conEspacios = LIBROS_MAP[palabras.slice(0, len).join(' ')];
      const sinEspacios = LIBROS_MAP[palabras.slice(0, len).join('')];
      const id = conEspacios != null ? conEspacios : sinEspacios;
      if (id != null) { libroId = id; indicePostLibro = len; break; }
    }
    if (libroId == null) return null;
    const resto = palabras.slice(indicePostLibro);
    if (!resto.length) return { libroId: libroId, capitulo: 1, versiculo: 1 };
    const get = function (i) { return i < resto.length ? resto[i] : ''; };
    const CAP = ['capitulo', 'capitulos', 'cap'], VERS = ['versiculo', 'versiculos', 'vers', 'verso', 'versos'];
    const idxCap = resto.findIndex(function (w) { return CAP.indexOf(w) >= 0; });
    const idxVers = resto.findIndex(function (w) { return VERS.indexOf(w) >= 0; });
    let capitulo, versiculo;
    if (idxCap >= 0 && idxVers >= 0) { capitulo = palabraANumero(get(idxCap + 1)) || 1; versiculo = palabraANumero(get(idxVers + 1)); }
    else if (idxCap >= 0) { capitulo = palabraANumero(get(idxCap + 1)) || 1; versiculo = palabraANumero(get(idxCap + 2)); }
    else if (idxVers >= 0) { capitulo = palabraANumero(get(0)) || 1; versiculo = palabraANumero(get(idxVers + 1)); }
    else { capitulo = palabraANumero(get(0)) || 1; versiculo = resto.length > 1 ? palabraANumero(resto[1]) : null; }
    return { libroId: libroId, capitulo: capitulo, versiculo: versiculo };
  }

  // ── Datos ──
  let promesa = null;
  function cargar() {
    if (!promesa) {
      promesa = fetch('data/biblia_rv1960.json').then(function (r) {
        if (!r.ok) throw new Error('No se pudo cargar la Biblia');
        return r.json();
      }).catch(function (e) { promesa = null; throw e; });
    }
    return promesa;
  }

  const MAX_VERSICULOS = 20;

  /**
   * Texto de una cita escrita a mano: "Salmos 34 : 1", "Juan 3:16", "1 Corintios 13:4-7".
   * Devuelve null si la cita está incompleta o no existe.
   */
  async function textoDeCita(cita) {
    const m = String(cita || '').trim().match(/(\d+)(?:\s*[:.,]\s*|\s+)(\d+)(?:\s*[-–—]\s*(\d+))?\s*$/);
    if (!m) return null;
    const libro = String(cita).trim().slice(0, m.index).trim();
    if (!libro) return null;
    const ref = parsearReferencia(libro + ' ' + m[1] + ' ' + m[2]);
    if (!ref || ref.versiculo == null) return null;
    let datos;
    try { datos = await cargar(); } catch (e) { return null; }
    const cap = datos.v[ref.libroId] && datos.v[ref.libroId][ref.capitulo];
    if (!cap || !cap[ref.versiculo - 1]) return null;
    let hasta = m[3] ? parseInt(m[3], 10) : ref.versiculo;
    if (hasta < ref.versiculo) hasta = ref.versiculo;
    hasta = Math.min(hasta, cap.length, ref.versiculo + MAX_VERSICULOS - 1);
    return cap.slice(ref.versiculo - 1, hasta).join(' ');
  }

  return { cargar: cargar, textoDeCita: textoDeCita, parsearReferencia: parsearReferencia };
})();
