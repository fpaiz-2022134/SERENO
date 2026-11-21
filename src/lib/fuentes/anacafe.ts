/**
 * FUENTE 5 · Anacafé / CEDICAFÉ — boletines tecnicos.
 *
 * NO HAY API REST. Lo que si hay, y lo verificamos con peticiones reales
 * (21 nov 2026), es UNA pagina publica de indice:
 *
 *   https://www.anacafe.org/Servicios/Cedicafe/Boletines  -> HTTP 200, ~72 KB,
 *   137 enlaces a PDF publicos en /uploads/file/..., con el titulo y el mes en
 *   el texto del enlace ("Reporte de Roya y Recomendaciones | Octubre 2026").
 *
 * Tambien verificado:
 *  - https://www.anacafe.org/robots.txt -> 404 (el sitio no publica politica de robots)
 *  - Las URLs de PDF responden 200 con Content-Type application/pdf
 *  - Rutas que NO existen (probadas, dan 404): /cedicafe, /boletines, /publicaciones
 *
 * LO QUE ESTE MODULO HACE: leer esa UNICA pagina de indice publica y extraer
 * los metadatos de cada documento (titulo, fecha, URL, tema). Un indice, una
 * peticion, cache de 12 h.
 *
 * LO QUE NO HACE, A PROPOSITO:
 *  - No rastrea el sitio entero ni sigue enlaces mas alla de ese indice.
 *  - No descarga ni redistribuye los PDF. `urlDocumento` apunta al PDF oficial
 *    de Anacafé y el usuario lo abre ahi. El contenido es de Anacafé.
 *  - No extrae el texto de los PDF para "resumirlos": seria presentar material
 *    de Anacafé como propio y no hace falta para la funcion.
 *
 * LIMITACION DECLARADA: sin API, el formato de esa pagina puede cambiar sin
 * aviso y el importador deja de encontrar documentos. Por eso
 * `DOCUMENTOS_DE_REFERENCIA` guarda un conjunto de enlaces publicos verificados
 * a mano que sirve de respaldo cuando el indice no se puede leer.
 */

import {
  TTL,
  fallo,
  guardarCache,
  leerCache,
  ok,
  pedir,
  procedencia,
  type ResultadoFuente,
} from "./base";

const INDICE_BOLETINES = "https://www.anacafe.org/Servicios/Cedicafe/Boletines";

export type TemaDocumento =
  | "roya"
  | "broca"
  | "ojo_de_gallo"
  | "clima"
  | "variedades"
  | "poda_y_tejido"
  | "fertilizacion"
  | "otro";

export interface DocumentoAnacafe {
  titulo: string;
  urlDocumento: string;
  /** Mes al que corresponde, YYYY-MM, cuando el titulo lo dice. */
  periodo: string | null;
  /** Primer dia del periodo, para ordenar y para `fechaPublicacion`. */
  fecha: string | null;
  tema: TemaDocumento;
  /** "pdf" si el enlace es un PDF directo; "enlace" si es un acortador (anc.gt). */
  formato: "pdf" | "enlace";
}

const MESES: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12",
};

const PALABRAS_TEMA: [TemaDocumento, RegExp][] = [
  ["roya", /roya|hemileia/i],
  ["broca", /broca|hypothenemus|beauveria/i],
  ["ojo_de_gallo", /ojo de gallo|mycena/i],
  ["clima", /clima|lluvia|precipitaci|enos|ni[nñ]o|ni[nñ]a|sequ[ií]a|can[ií]cula/i],
  ["variedades", /variedad|cultivar|catua|caturra|anacaf[eé]-?14|marsellesa|robusta|nemaya/i],
  ["poda_y_tejido", /poda|tejido|renovaci|smt/i],
  ["fertilizacion", /fertiliz|nutrici|suelo|enmienda/i],
];

export function clasificarTema(titulo: string): TemaDocumento {
  for (const [tema, re] of PALABRAS_TEMA) if (re.test(titulo)) return tema;
  return "otro";
}

/** Saca "2026-10" de "Reporte de Roya y Recomendaciones | Octubre 2026". */
export function periodoDeTitulo(titulo: string): string | null {
  const m = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .match(/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s*(?:de\s*)?(\d{4})/);
  if (!m) {
    const soloAno = titulo.match(/\b(20\d{2})\b/);
    return soloAno ? `${soloAno[1]}-01` : null;
  }
  return `${m[2]}-${MESES[m[1]]}`;
}

function desescapar(s: string): string {
  const tabla: Record<string, string> = {
    aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú",
    Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú",
    ntilde: "ñ", Ntilde: "Ñ", uuml: "ü", amp: "&", nbsp: " ", quot: '"', ldquo: '"', rdquo: '"',
  };
  return s
    .replace(/&([a-zA-Z]+);/g, (todo, n) => tabla[n] ?? todo)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Parsea el indice publico de boletines. Exportado para poder testearlo sin red. */
export function parsearIndice(html: string): DocumentoAnacafe[] {
  const docs: DocumentoAnacafe[] = [];
  const re = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = m[1].trim();
    const titulo = desescapar(m[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (titulo.length < 8) continue;
    // Solo PDF de Anacafé o los acortadores oficiales anc.gt del propio indice.
    const esPdf = /anacafe\.org\/uploads\/.*\.pdf$/i.test(url);
    const esCorto = /^https?:\/\/anc\.gt\//i.test(url);
    if (!esPdf && !esCorto) continue;
    // "DESCARGAR INFOGRAFIA" y similares no son titulos de documento.
    if (/^descargar/i.test(titulo)) continue;

    const periodo = periodoDeTitulo(titulo);
    docs.push({
      titulo,
      urlDocumento: url,
      periodo,
      fecha: periodo ? `${periodo}-01` : null,
      tema: clasificarTema(titulo),
      formato: esPdf ? "pdf" : "enlace",
    });
  }
  // Dedup por URL, el mas reciente primero.
  const vistas = new Set<string>();
  return docs
    .filter((d) => (vistas.has(d.urlDocumento) ? false : (vistas.add(d.urlDocumento), true)))
    .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
}

/** Lee el indice publico de boletines de CEDICAFÉ. */
export async function importarBoletines(): Promise<ResultadoFuente<DocumentoAnacafe[]>> {
  const clave = `anacafe:indice`;
  const cacheado = leerCache<DocumentoAnacafe[]>(clave);
  const p = procedencia({
    fuente: "Anacafé / CEDICAFÉ (indice publico de boletines)",
    url: INDICE_BOLETINES,
    fechaPublicacion: null,
    esPronostico: false,
    avisos: [
      "Anacafé no publica API. Esto se lee de una unica pagina publica de indice; si cambia el formato, el importador deja de encontrar documentos.",
      "Los PDF son de Anacafé y se enlazan a su sitio: SERENO no los redistribuye ni los resume.",
    ],
  });
  if (cacheado) return ok(cacheado, { ...p, fechaPublicacion: cacheado[0]?.fecha ?? null });

  try {
    const { texto } = await pedir(INDICE_BOLETINES, {
      timeoutMs: 45_000,
      aceptar: "text/html",
    });
    const docs = parsearIndice(texto);
    if (docs.length === 0) {
      return fallo(
        new Error(
          "El indice de Anacafé respondio pero no se encontro ningun documento: probablemente cambio el formato de la pagina. Usar DOCUMENTOS_DE_REFERENCIA.",
        ),
        p,
      );
    }
    guardarCache(clave, docs, TTL.documentos);
    return ok(docs, { ...p, fechaPublicacion: docs[0]?.fecha ?? null });
  } catch (e) {
    return fallo(e, p);
  }
}

/** Buscador por enfermedad/tema sobre los documentos importados. */
export function buscarDocumentos(
  docs: DocumentoAnacafe[],
  opciones: { tema?: TemaDocumento; texto?: string; desde?: string; limite?: number } = {},
): DocumentoAnacafe[] {
  const { tema, texto, desde, limite = 20 } = opciones;
  const normal = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const aguja = texto ? normal(texto) : null;
  return docs
    .filter((d) => (tema ? d.tema === tema : true))
    .filter((d) => (aguja ? normal(d.titulo).includes(aguja) : true))
    .filter((d) => (desde ? (d.fecha ?? "9999") >= desde : true))
    .slice(0, limite);
}

/**
 * Enlaces publicos de referencia, verificados a mano (HTTP 200, application/pdf,
 * 21 nov 2026). Respaldo si el indice no se puede leer, y las citas del pitch.
 */
export const DOCUMENTOS_DE_REFERENCIA: readonly DocumentoAnacafe[] = [
  {
    titulo: "Boletín Técnico de Roya | Febrero 2025",
    urlDocumento:
      "https://www.anacafe.org/uploads/file/31fcb66fe5554ec6b13842ad638f04a3/Boletin-Roya-Febrero-2025.pdf",
    periodo: "2025-02",
    fecha: "2025-02-01",
    tema: "roya",
    formato: "pdf",
  },
  {
    titulo: "El Cafetal No. 12 — cosecha 2012/13 (contexto del brote)",
    urlDocumento:
      "https://www.anacafe.org/uploads/file/d875d9979c4a4f438c8c2a2b9835911a/El-Cafetal-12.pdf",
    periodo: null,
    fecha: null,
    tema: "otro",
    formato: "pdf",
  },
  {
    titulo: "Memoria de Labores Anacafé 2025",
    urlDocumento:
      "https://www.anacafe.org/uploads/file/b7e6d68ba1b84832a940745715e270f8/Memoria_de_labores_Anacafe_2025_web.pdf",
    periodo: "2025-01",
    fecha: "2025-01-01",
    tema: "otro",
    formato: "pdf",
  },
] as const;
