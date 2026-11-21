/**
 * Infraestructura comun de las seis fuentes de datos.
 *
 * Reglas que valen para TODAS:
 *  1. Las llamadas salen del servidor. Ninguna credencial ni llave vive en el
 *     frontend. Estos modulos solo se importan desde route handlers (`src/app/api`)
 *     o desde scripts de Node.
 *  2. Toda respuesta se devuelve envuelta en `Procedencia`: fuente, URL exacta,
 *     fecha de publicacion y ultima consulta. Si el dato esta viejo, se ve.
 *  3. Los errores no se tragan: se devuelven como `ResultadoFuente` con `ok:false`
 *     y un mensaje, para que el panel pueda decir "esta fuente no respondio" en
 *     vez de mostrar una pantalla vacia.
 */

import type { Procedencia } from "@/lib/motor/tipos";

/** User-Agent identificable. met.no lo EXIGE; las demas fuentes lo agradecen.
 *  Es la URL publica del repo a proposito: no lleva correo ni datos personales. */
export const USER_AGENT = "SERENO/0.1 (https://github.com/fpaiz-2022134/SERENO)";

export type ResultadoFuente<T> =
  | { ok: true; datos: T; procedencia: Procedencia }
  | { ok: false; error: string; procedencia: Procedencia };

/* ------------------------------------------------------------------ *
 * Cache en memoria del proceso
 * ------------------------------------------------------------------ */

interface EntradaCache {
  valor: unknown;
  expira: number;
}

const CACHE = new Map<string, EntradaCache>();

/** TTL por defecto de cada fuente, en segundos. */
export const TTL = {
  /** El pronostico de Open-Meteo se actualiza cada hora. */
  pronostico: 60 * 30,
  /** El historico de 2012 no va a cambiar nunca. */
  historico: 60 * 60 * 24 * 7,
  /** met.no manda su propio Expires; esto es el piso. */
  metNorway: 60 * 30,
  /** GDELT limita a una peticion cada 5 s: cacheamos agresivo. */
  noticias: 60 * 30,
  /** Los boletines de Anacafe son mensuales. */
  documentos: 60 * 60 * 12,
  /** Los precios del MAGA son mensuales. */
  precios: 60 * 60 * 12,
} as const;

export function leerCache<T>(clave: string): T | null {
  const e = CACHE.get(clave);
  if (!e) return null;
  if (Date.now() > e.expira) {
    CACHE.delete(clave);
    return null;
  }
  return e.valor as T;
}

export function guardarCache(clave: string, valor: unknown, ttlSegundos: number): void {
  CACHE.set(clave, { valor, expira: Date.now() + ttlSegundos * 1000 });
}

export function limpiarCache(): void {
  CACHE.clear();
}

/* ------------------------------------------------------------------ *
 * fetch con timeout, User-Agent y errores explicitos
 * ------------------------------------------------------------------ */

export class ErrorFuente extends Error {
  constructor(
    message: string,
    readonly estado?: number,
    readonly cuerpo?: string,
  ) {
    super(message);
    this.name = "ErrorFuente";
  }
}

export async function pedir(
  url: string,
  opciones: { timeoutMs?: number; cabeceras?: Record<string, string>; aceptar?: string } = {},
): Promise<{ texto: string; cabeceras: Headers; estado: number }> {
  const { timeoutMs = 30_000, cabeceras = {}, aceptar = "application/json" } = opciones;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: control.signal,
      headers: { "User-Agent": USER_AGENT, Accept: aceptar, ...cabeceras },
      // El cache lo manejamos nosotros (leerCache/guardarCache) para poder
      // registrar `ultimaConsulta` con honestidad.
      cache: "no-store",
    });
    const texto = await r.text();
    if (!r.ok) {
      throw new ErrorFuente(
        `HTTP ${r.status} en ${recortarUrl(url)}`,
        r.status,
        texto.slice(0, 500),
      );
    }
    return { texto, cabeceras: r.headers, estado: r.status };
  } catch (e) {
    if (e instanceof ErrorFuente) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new ErrorFuente(`Tiempo agotado (${timeoutMs} ms) en ${recortarUrl(url)}`);
    }
    throw new ErrorFuente(
      `Fallo de red en ${recortarUrl(url)}: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(reloj);
  }
}

export async function pedirJson<T>(
  url: string,
  opciones?: Parameters<typeof pedir>[1],
): Promise<{ json: T; cabeceras: Headers }> {
  const { texto, cabeceras } = await pedir(url, opciones);
  try {
    return { json: JSON.parse(texto) as T, cabeceras };
  } catch {
    throw new ErrorFuente(
      `La respuesta de ${recortarUrl(url)} no es JSON valido: ${texto.slice(0, 160)}`,
    );
  }
}

function recortarUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url.slice(0, 80);
  }
}

/* ------------------------------------------------------------------ *
 * Procedencia
 * ------------------------------------------------------------------ */

export function ahora(): string {
  return new Date().toISOString();
}

export function procedencia(
  base: Omit<Procedencia, "ultimaConsulta"> & { ultimaConsulta?: string },
): Procedencia {
  return { ultimaConsulta: ahora(), ...base };
}

/**
 * Agrega el aviso "este dato esta viejo" cuando la publicacion pasa de
 * `diasFrescura`. Es la regla 3 del brief: si un dato esta viejo, que se vea.
 */
export function avisarSiViejo(p: Procedencia, diasFrescura: number): Procedencia {
  if (!p.fechaPublicacion) return p;
  const edadDias = (Date.now() - Date.parse(p.fechaPublicacion)) / 86_400_000;
  if (edadDias <= diasFrescura) return p;
  return {
    ...p,
    avisos: [
      ...(p.avisos ?? []),
      `Dato con ${Math.floor(edadDias)} dias de antiguedad (la fuente se publica cada ~${diasFrescura} dias).`,
    ],
  };
}

export function ok<T>(datos: T, p: Procedencia): ResultadoFuente<T> {
  return { ok: true, datos, procedencia: p };
}

export function fallo<T>(e: unknown, p: Procedencia): ResultadoFuente<T> {
  return {
    ok: false,
    error: e instanceof Error ? e.message : String(e),
    procedencia: p,
  };
}
