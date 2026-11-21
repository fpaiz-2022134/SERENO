/**
 * FUENTE 1 · Open-Meteo — la fuente principal del motor.
 *
 * Es la unica de las tres APIs de clima probadas que da historico horario Y
 * pronostico horario Y punto de rocio, en la misma forma y sin llave.
 *
 * Rangos VERIFICADOS con peticiones reales (21 nov 2026, punto 15.32/-91.47):
 *  - Pronostico horario: 384 pasos = 16 dias (api.open-meteo.com/v1/forecast)
 *  - Historico horario: desde 1940-01-01 (archive-api.open-meteo.com/v1/archive)
 *  - Devuelve la altitud del punto: 1905 m en esa coordenada
 *
 * HUECO DECLARADO: no encontramos la pagina de limites de uso del plan gratuito.
 * Lo que sabemos es que estas llamadas corren sin llave ni registro.
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
import type { SerieHoraria } from "@/lib/motor/tipos";

const BASE_PRONOSTICO = "https://api.open-meteo.com/v1/forecast";
const BASE_ARCHIVO = "https://archive-api.open-meteo.com/v1/archive";

export const ZONA_GUATEMALA = "America/Guatemala";

/** Primer dia con historico horario en Open-Meteo (ERA5). Verificado: 1940-01-01 responde 200. */
export const HISTORICO_DESDE = "1940-01-01";
/** Dias de pronostico horario. Verificado: forecast_days=16 devuelve 384 pasos. */
export const PRONOSTICO_DIAS_MAX = 16;

/** Variables horarias que pide SERENO. Las cuatro primeras alimentan el motor. */
const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "precipitation_probability",
  "wind_speed_10m",
] as const;

/** El archivo historico no sirve `precipitation_probability`. */
const VARIABLES_HORARIAS_ARCHIVO = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation",
  "wind_speed_10m",
] as const;

interface RespuestaOpenMeteo {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  utc_offset_seconds: number;
  hourly: {
    time: string[];
    temperature_2m?: (number | null)[];
    relative_humidity_2m?: (number | null)[];
    dew_point_2m?: (number | null)[];
    precipitation?: (number | null)[];
    precipitation_probability?: (number | null)[];
    wind_speed_10m?: (number | null)[];
  };
  hourly_units?: Record<string, string>;
}

export interface SerieOpenMeteo extends SerieHoraria {
  /** Probabilidad de precipitacion, %. Solo viene en el pronostico. */
  probabilidadPrecipitacion?: (number | null)[];
  /** Viento a 10 m, km/h. */
  vientoKmh?: (number | null)[];
  latitud: number;
  longitud: number;
  altitudMetros: number | null;
}

function urlPronostico(lat: number, lon: number, dias: number, zona: string): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: VARIABLES_HORARIAS.join(","),
    forecast_days: String(Math.min(dias, PRONOSTICO_DIAS_MAX)),
    timezone: zona,
  });
  return `${BASE_PRONOSTICO}?${q}`;
}

function urlArchivo(
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
  zona: string,
): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: desde,
    end_date: hasta,
    hourly: VARIABLES_HORARIAS_ARCHIVO.join(","),
    timezone: zona,
  });
  return `${BASE_ARCHIVO}?${q}`;
}

function normalizar(
  d: RespuestaOpenMeteo,
  url: string,
  fuente: string,
  esPronostico: boolean,
): SerieOpenMeteo {
  const h = d.hourly;
  const n = h.time.length;
  const vacio = () => new Array<number | null>(n).fill(null);
  const altitud = d.elevation ?? null;

  const avisos: string[] = [];
  // La advertencia de la celda fria: en SERENO-investigacion.md §4 quedo
  // documentado que arriba de ~1700 m la celda de ERA5 sale fria y W(T) se
  // infla, asi que el motor exige rachas larguisimas y el demo se ve pobre.
  if (altitud != null && altitud > 1700) {
    avisos.push(
      `La celda de la fuente esta a ${Math.round(altitud)} m y suele salir fria: ` +
        `W(T) se infla y el motor exige rachas muy largas. Para el demo conviene ` +
        `una coordenada entre 900 y 1400 m.`,
    );
  }

  return {
    tiempo: h.time,
    temperatura: h.temperature_2m ?? vacio(),
    humedadRelativa: h.relative_humidity_2m ?? vacio(),
    precipitacion: h.precipitation ?? vacio(),
    puntoRocio: h.dew_point_2m ?? vacio(),
    probabilidadPrecipitacion: h.precipitation_probability,
    vientoKmh: h.wind_speed_10m,
    latitud: d.latitude,
    longitud: d.longitude,
    altitudMetros: altitud,
    procedencia: procedencia({
      fuente,
      url,
      // Open-Meteo no publica una fecha de emision del pronostico en el JSON;
      // no la inventamos.
      fechaPublicacion: null,
      esPronostico,
      altitudMetros: altitud,
      avisos: avisos.length > 0 ? avisos : undefined,
    }),
  };
}

/** Pronostico horario, hasta 16 dias. Es lo que alimenta la alerta. */
export async function pronosticoHorario(
  lat: number,
  lon: number,
  dias = PRONOSTICO_DIAS_MAX,
  zona = ZONA_GUATEMALA,
): Promise<ResultadoFuente<SerieOpenMeteo>> {
  const url = urlPronostico(lat, lon, dias, zona);
  const clave = `om:pronostico:${url}`;
  const cacheado = leerCache<SerieOpenMeteo>(clave);
  if (cacheado) return ok(cacheado, cacheado.procedencia);

  const p = procedencia({
    fuente: "Open-Meteo (forecast)",
    url,
    fechaPublicacion: null,
    esPronostico: true,
  });
  try {
    const { json } = await pedirJson<RespuestaOpenMeteo>(url, { timeoutMs: 30_000 });
    const serie = normalizar(json, url, "Open-Meteo (forecast)", true);
    guardarCache(clave, serie, TTL.pronostico);
    return ok(serie, serie.procedencia);
  } catch (e) {
    return fallo(e, p);
  }
}

/**
 * Historico horario (ERA5), desde 1940-01-01.
 *
 * ESTO ES HISTORICO, NO PRONOSTICO. `procedencia.esPronostico` queda en false
 * y la UI nunca debe presentarlo como pronostico.
 */
export async function historicoHorario(
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
  zona = ZONA_GUATEMALA,
): Promise<ResultadoFuente<SerieOpenMeteo>> {
  const url = urlArchivo(lat, lon, desde, hasta, zona);
  const clave = `om:archivo:${url}`;
  const cacheado = leerCache<SerieOpenMeteo>(clave);
  if (cacheado) return ok(cacheado, cacheado.procedencia);

  const p = procedencia({
    fuente: "Open-Meteo (archive-api / ERA5)",
    url,
    fechaPublicacion: hasta,
    esPronostico: false,
  });
  if (desde < HISTORICO_DESDE) {
    return fallo(
      new Error(
        `El historico horario de Open-Meteo empieza en ${HISTORICO_DESDE}; se pidio ${desde}.`,
      ),
      p,
    );
  }
  try {
    const { json } = await pedirJson<RespuestaOpenMeteo>(url, { timeoutMs: 120_000 });
    const serie = normalizar(json, url, "Open-Meteo (archive-api / ERA5)", false);
    serie.procedencia.fechaPublicacion = hasta;
    guardarCache(clave, serie, TTL.historico);
    return ok(serie, serie.procedencia);
  } catch (e) {
    return fallo(e, p);
  }
}

/** Altitud del punto, para validar que una coordenada de demo este entre 900 y 1400 m. */
export async function altitudDelPunto(
  lat: number,
  lon: number,
): Promise<ResultadoFuente<{ altitudMetros: number | null }>> {
  const url = `${BASE_PRONOSTICO}?${new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m",
    forecast_days: "1",
    timezone: ZONA_GUATEMALA,
  })}`;
  const p = procedencia({
    fuente: "Open-Meteo (forecast)",
    url,
    fechaPublicacion: null,
    esPronostico: true,
  });
  try {
    const { json } = await pedirJson<RespuestaOpenMeteo>(url);
    return ok({ altitudMetros: json.elevation ?? null }, {
      ...p,
      altitudMetros: json.elevation ?? null,
    });
  } catch (e) {
    return fallo(e, p);
  }
}
