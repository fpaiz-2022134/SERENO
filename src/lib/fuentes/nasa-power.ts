/**
 * FUENTE 4 · NASA POWER — respaldo historico y argumento ante el jurado.
 *
 * Es la fuente que usa el paper ancla de Brasil (Aparecido et al., Theor. Appl.
 * Climatol. 157:456, DOI 10.1007/s00704-026-06384-8): "open-access meteorological
 * data from the NASA-POWER system as predictive variables".
 *
 * Rangos VERIFICADOS con peticiones reales (21 nov 2026, punto 15.32/-91.47):
 *  - Endpoint HORARIO: empieza el 2001-01-01.
 *    1990 devuelve HTTP 422: "Your start date out of range. The data starts at 2001/01/01."
 *  - Endpoint DIARIO: empieza el 1981-01-01.
 *    1981-01-01 devuelve 200 con datos; 1980-01-01 devuelve HTTP 422:
 *    "Your start date out of range. The data starts at 1981/01/01."
 *  - Devuelve la altitud en geometry.coordinates[2]: 1884.37 m en esa coordenada.
 *
 * No tiene pronostico. Por eso es respaldo, no fuente del aviso.
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

const BASE_HORARIO = "https://power.larc.nasa.gov/api/temporal/hourly/point";
const BASE_DIARIO = "https://power.larc.nasa.gov/api/temporal/daily/point";

/** Verificado con peticion real: el endpoint horario empieza aqui. */
export const HORARIO_DESDE = "2001-01-01";
/** Verificado con peticion real: el endpoint diario empieza aqui. */
export const DIARIO_DESDE = "1981-01-01";

const PARAMS_HORARIOS = ["T2M", "RH2M", "T2MDEW", "PRECTOTCORR"] as const;
const PARAMS_DIARIOS = ["T2M", "T2M_MIN", "T2M_MAX", "RH2M", "PRECTOTCORR"] as const;

interface RespuestaPower {
  geometry?: { coordinates?: number[] };
  properties: { parameter: Record<string, Record<string, number>> };
  header?: Record<string, unknown>;
  messages?: string[];
}

/** NASA POWER usa -999 como valor faltante. */
const FALTANTE = -999;
const limpiar = (v: number | undefined): number | null =>
  v === undefined || v <= FALTANTE ? null : v;

function compactar(fecha: string): string {
  return fecha.replace(/-/g, "");
}

export interface SeriePower extends SerieHoraria {
  altitudMetros: number | null;
}

/** Historico HORARIO. Solo desde 2001-01-01. */
export async function historicoHorarioPower(
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
): Promise<ResultadoFuente<SeriePower>> {
  const url = `${BASE_HORARIO}?${new URLSearchParams({
    parameters: PARAMS_HORARIOS.join(","),
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    start: compactar(desde),
    end: compactar(hasta),
    format: "JSON",
  })}`;
  const p = procedencia({
    fuente: "NASA POWER (temporal/hourly/point)",
    url,
    fechaPublicacion: hasta,
    esPronostico: false,
  });
  if (desde < HORARIO_DESDE) {
    return fallo(
      new Error(
        `El endpoint horario de NASA POWER empieza en ${HORARIO_DESDE} (verificado: 1990 devuelve HTTP 422); se pidio ${desde}. Para fechas anteriores usar el endpoint diario (desde ${DIARIO_DESDE}).`,
      ),
      p,
    );
  }
  const clave = `power:h:${url}`;
  const cacheado = leerCache<SeriePower>(clave);
  if (cacheado) return ok(cacheado, cacheado.procedencia);

  try {
    const { json } = await pedirJson<RespuestaPower>(url, { timeoutMs: 120_000 });
    const par = json.properties.parameter;
    // Claves "YYYYMMDDHH" en hora UTC.
    const claves = Object.keys(par.T2M ?? {}).sort();
    const serie: SeriePower = {
      tiempo: claves.map(
        (k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}T${k.slice(8, 10)}:00`,
      ),
      temperatura: claves.map((k) => limpiar(par.T2M?.[k])),
      humedadRelativa: claves.map((k) => limpiar(par.RH2M?.[k])),
      precipitacion: claves.map((k) => limpiar(par.PRECTOTCORR?.[k])),
      puntoRocio: claves.map((k) => limpiar(par.T2MDEW?.[k])),
      altitudMetros: json.geometry?.coordinates?.[2] ?? null,
      procedencia: {
        ...p,
        altitudMetros: json.geometry?.coordinates?.[2] ?? null,
        avisos: [
          "Horas en UTC: NASA POWER no acepta zona horaria. No mezclar con series locales de Open-Meteo sin convertir.",
          "Respaldo historico. No tiene pronostico.",
        ],
      },
    };
    guardarCache(clave, serie, TTL.historico);
    return ok(serie, serie.procedencia);
  } catch (e) {
    return fallo(e, p);
  }
}

export interface DiaPower {
  dia: string;
  temperaturaMedia: number | null;
  temperaturaMin: number | null;
  temperaturaMax: number | null
  humedadRelativa: number | null;
  lluviaMm: number | null;
}

/** Historico DIARIO. Desde 1981-01-01, verificado. Llega mas atras que el horario. */
export async function historicoDiarioPower(
  lat: number,
  lon: number,
  desde: string,
  hasta: string,
): Promise<ResultadoFuente<{ dias: DiaPower[]; altitudMetros: number | null }>> {
  const url = `${BASE_DIARIO}?${new URLSearchParams({
    parameters: PARAMS_DIARIOS.join(","),
    community: "AG",
    longitude: String(lon),
    latitude: String(lat),
    start: compactar(desde),
    end: compactar(hasta),
    format: "JSON",
  })}`;
  const p = procedencia({
    fuente: "NASA POWER (temporal/daily/point)",
    url,
    fechaPublicacion: hasta,
    esPronostico: false,
  });
  if (desde < DIARIO_DESDE) {
    return fallo(
      new Error(
        `El endpoint diario de NASA POWER empieza en ${DIARIO_DESDE} (verificado: 1980 devuelve HTTP 422); se pidio ${desde}.`,
      ),
      p,
    );
  }
  const clave = `power:d:${url}`;
  const cacheado = leerCache<{ dias: DiaPower[]; altitudMetros: number | null }>(clave);
  if (cacheado) return ok(cacheado, p);

  try {
    const { json } = await pedirJson<RespuestaPower>(url, { timeoutMs: 120_000 });
    const par = json.properties.parameter;
    const claves = Object.keys(par.T2M ?? {}).sort();
    const datos = {
      dias: claves.map((k) => ({
        dia: `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`,
        temperaturaMedia: limpiar(par.T2M?.[k]),
        temperaturaMin: limpiar(par.T2M_MIN?.[k]),
        temperaturaMax: limpiar(par.T2M_MAX?.[k]),
        humedadRelativa: limpiar(par.RH2M?.[k]),
        lluviaMm: limpiar(par.PRECTOTCORR?.[k]),
      })),
      altitudMetros: json.geometry?.coordinates?.[2] ?? null,
    };
    guardarCache(clave, datos, TTL.historico);
    return ok(datos, {
      ...p,
      altitudMetros: datos.altitudMetros,
      avisos: [
        "Serie DIARIA: no sirve para contar horas de mojado foliar. El motor necesita series horarias.",
      ],
    });
  } catch (e) {
    return fallo(e, p);
  }
}
