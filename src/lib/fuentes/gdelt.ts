/**
 * FUENTE 3 · GDELT DOC 2.0 — noticias. CONTEXTO, NUNCA VEREDICTO.
 *
 * Reglas duras de este modulo:
 *  1. Un titular NO dispara una alerta de brote confirmado. Las noticias se
 *     devuelven con `esVeredicto: false` y el panel las muestra como noticias.
 *  2. Las noticias de precios se muestran COMO NOTICIAS, nunca como cotizacion.
 *     Por eso el tema "precio" lleva `noEsCotizacion: true`.
 *  3. Se deduplica por URL y por titulo normalizado.
 *
 * ===================== LO QUE APRENDIMOS PROBANDOLA =====================
 * Verificado con peticiones reales el 21 nov 2026:
 *
 *  · LIMITE: responde HTTP 429 con "Please limit requests to one every 5
 *    seconds". El modulo serializa con 5.5 s entre peticiones y cachea 30 min.
 *    Probando la API muchas veces en un dia la IP queda limitada un buen rato.
 *
 *  · LOS `OR` VAN ENTRE PARENTESIS, si no responde en texto plano:
 *    "Queries containing OR'd terms must be surrounded by ()."
 *
 *  · LA API FUNCIONA. Consulta de control `query=guatemala&timespan=1week`:
 *    5 articulos, incluido uno de prensalibre.com sobre la oferta de cafe de
 *    Guatemala. O sea: cuando una consulta devuelve 0, NO es que la fuente
 *    este caida.
 *
 *  · LAS FRASES EXACTAS NO TRAEN NADA. `"roya del cafe"`, `"roya del café"`,
 *    `"coffee leaf rust"` y `"precio del café"` devolvieron 0 articulos en
 *    ventanas de 1 semana a 24 meses. Por eso las consultas de abajo usan
 *    TERMINOS SUELTOS en AND (GDELT une los terminos con AND implicito), que
 *    es mucho mas ancho, y la frase exacta solo como una alternativa del OR.
 *
 *  · El termino `roya` solo, sin `cafe`, trae ruido (un articulo de cine por
 *    el apellido Malek/"roya"). Por eso ningun tema de enfermedad va sin el
 *    termino del cultivo.
 *
 *  · DOC 2.0 cubre una ventana reciente: pedir `timespan=24months` no sirve de
 *    nada. El valor por defecto de este modulo es 3 meses.
 * ========================================================================
 */

import {
  TTL,
  fallo,
  guardarCache,
  leerCache,
  ok,
  pedirJson,
  procedencia,
  type ResultadoFuente,
} from "./base";

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

/** GDELT: una peticion cada 5 s. Dejamos margen. */
const MS_ENTRE_PETICIONES = 5_500;
let ultimaPeticion = 0;

async function esperarTurno(): Promise<void> {
  const falta = ultimaPeticion + MS_ENTRE_PETICIONES - Date.now();
  if (falta > 0) await new Promise((r) => setTimeout(r, falta));
  ultimaPeticion = Date.now();
}

export type TemaNoticia =
  | "roya"
  | "broca"
  | "ojo_de_gallo"
  | "sequia"
  | "precio_cafe"
  | "exportaciones";

interface DefinicionTema {
  consulta: string;
  /** true = es informacion de precios; jamas se presenta como cotizacion. */
  noEsCotizacion?: boolean;
}

/**
 * Consultas por tema. Se priorizan Guatemala y Centroamerica anteponiendo los
 * paises en la propia consulta de GDELT; el ordenamiento posterior vuelve a
 * subir Guatemala.
 */
export const TEMAS: Readonly<Record<TemaNoticia, DefinicionTema>> = {
  // Terminos sueltos en AND (GDELT los une con AND implicito) + la frase exacta
  // como alternativa. Nunca el nombre de la enfermedad solo: trae ruido.
  roya: { consulta: '(roya OR "coffee leaf rust" OR "Hemileia vastatrix") (cafe OR café OR coffee)' },
  broca: { consulta: '(broca OR "coffee berry borer" OR "Hypothenemus hampei") (cafe OR café OR coffee)' },
  ojo_de_gallo: { consulta: '("ojo de gallo" OR "Mycena citricolor") (cafe OR café OR cafetal)' },
  sequia: { consulta: '(sequia OR sequía OR canicula OR canícula OR drought) (cafe OR café OR cafetal OR agricultura)' },
  precio_cafe: {
    consulta: '(precio OR precios OR cotizacion OR cotización OR prices) (cafe OR café OR coffee)',
    noEsCotizacion: true,
  },
  exportaciones: { consulta: '(exportaciones OR exportacion OR exportación OR exports) (cafe OR café OR coffee)' },
} as const;

/** Paises que suben en el ordenamiento. GDELT los nombra en ingles. */
const PAISES_PRIORITARIOS = [
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Costa Rica",
  "Panama",
  "Mexico",
];

export interface Noticia {
  titulo: string;
  url: string;
  dominio: string;
  pais: string | null;
  idioma: string | null;
  /** ISO de la fecha en que GDELT vio el articulo. */
  vistoEn: string | null;
  tema: TemaNoticia;
  /** Siempre false: una noticia es contexto, no un veredicto del motor. */
  esVeredicto: false;
  /** true en el tema de precios: es una noticia sobre precios, NO una cotizacion. */
  noEsCotizacion: boolean;
  /** true si el articulo es de Guatemala o Centroamerica. */
  prioritario: boolean;
}

interface ArticuloGdelt {
  url?: string;
  title?: string;
  domain?: string;
  sourcecountry?: string;
  language?: string;
  seendate?: string;
}

/** GDELT devuelve "20261118T143000Z". */
function fechaGdelt(s?: string): string | null {
  if (!s || s.length < 15) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function normalizarTitulo(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function urlConsulta(consulta: string, meses: number, maximo: number): string {
  const q = new URLSearchParams({
    query: consulta,
    mode: "ArtList",
    format: "json",
    maxrecords: String(Math.min(maximo, 250)),
    timespan: `${meses}months`,
    sort: "DateDesc",
  });
  return `${BASE}?${q}`;
}

/** Trae las noticias de un tema. */
export async function noticiasPorTema(
  tema: TemaNoticia,
  opciones: { meses?: number; maximo?: number } = {},
): Promise<ResultadoFuente<Noticia[]>> {
  const { meses = 3, maximo = 40 } = opciones;
  const def = TEMAS[tema];
  const url = urlConsulta(def.consulta, meses, maximo);
  const clave = `gdelt:${url}`;
  const cacheado = leerCache<Noticia[]>(clave);
  const p = procedencia({
    fuente: "GDELT DOC 2.0",
    url,
    fechaPublicacion: null,
    esPronostico: false,
    avisos: [
      "Las noticias son CONTEXTO. Un titular no confirma un brote ni dispara una alerta.",
      ...(def.noEsCotizacion
        ? ["Tema de precios: son noticias sobre precios, NO una cotizacion."]
        : []),
    ],
  });
  if (cacheado) return ok(cacheado, p);

  try {
    await esperarTurno();
    const { json } = await pedirJson<{ articles?: ArticuloGdelt[] }>(url, {
      timeoutMs: 45_000,
    });
    const crudos = json.articles ?? [];
    const noticias = deduplicar(
      crudos.map((a) => ({
        titulo: (a.title ?? "").trim(),
        url: a.url ?? "",
        dominio: a.domain ?? "",
        pais: a.sourcecountry ?? null,
        idioma: a.language ?? null,
        vistoEn: fechaGdelt(a.seendate),
        tema,
        esVeredicto: false as const,
        noEsCotizacion: def.noEsCotizacion === true,
        prioritario: PAISES_PRIORITARIOS.includes(a.sourcecountry ?? ""),
      })).filter((n) => n.url !== "" && n.titulo !== ""),
    );
    guardarCache(clave, noticias, TTL.noticias);
    return ok(noticias, p);
  } catch (e) {
    return fallo(e, p);
  }
}

/** Deduplica por URL y por titulo normalizado, y ordena: Guatemala/CA primero, luego por fecha. */
export function deduplicar(noticias: Noticia[]): Noticia[] {
  const vistas = new Set<string>();
  const out: Noticia[] = [];
  for (const n of noticias) {
    const claveUrl = n.url.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const claveTitulo = normalizarTitulo(n.titulo);
    if (vistas.has(claveUrl) || (claveTitulo.length > 15 && vistas.has(claveTitulo))) continue;
    vistas.add(claveUrl);
    if (claveTitulo.length > 15) vistas.add(claveTitulo);
    out.push(n);
  }
  return out.sort((a, b) => {
    if (a.prioritario !== b.prioritario) return a.prioritario ? -1 : 1;
    return (b.vistoEn ?? "").localeCompare(a.vistoEn ?? "");
  });
}

/**
 * Trae varios temas en serie (GDELT no admite paralelo) y los junta deduplicados.
 * Si un tema falla, los demas siguen: el error se devuelve en `errores`.
 */
export async function noticiasAgro(
  temas: TemaNoticia[] = ["roya", "broca", "ojo_de_gallo", "sequia", "precio_cafe", "exportaciones"],
  opciones: { meses?: number; maximoPorTema?: number } = {},
): Promise<{
  noticias: Noticia[];
  errores: { tema: TemaNoticia; error: string }[];
  consultas: string[];
}> {
  const noticias: Noticia[] = [];
  const errores: { tema: TemaNoticia; error: string }[] = [];
  const consultas: string[] = [];
  for (const tema of temas) {
    const r = await noticiasPorTema(tema, {
      meses: opciones.meses,
      maximo: opciones.maximoPorTema ?? 25,
    });
    consultas.push(r.procedencia.url);
    if (r.ok) noticias.push(...r.datos);
    else errores.push({ tema, error: r.error });
  }
  return { noticias: deduplicar(noticias), errores, consultas };
}
