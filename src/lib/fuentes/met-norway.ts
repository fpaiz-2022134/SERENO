/**
 * FUENTE 2 · MET Norway / yr.no — SEGUNDA OPINION, no alimenta el motor.
 *
 * Verificado con peticion real (21 nov 2026, 15.32/-91.47):
 *  - 89 pasos horarios = ~9.5 dias de pronostico
 *  - NO tiene punto de rocio (hay que derivarlo de T y HR)
 *  - NO tiene historico
 *  - La precipitacion viene en `next_1_hours.precipitation_amount`
 *  - Devuelve Last-Modified y Expires: hay que respetarlos
 *
 * POR ESO NO SIRVE PARA EL MOTOR. Se usa solo para comparar el pronostico de
 * Open-Meteo con una segunda fuente independiente y poder decirle al jurado
 * cuanto se parecen. El motor corre SIEMPRE con Open-Meteo.
 *
 * Terminos de met.no: exigen un User-Agent identificable. Usamos la URL publica
 * del repo (ver USER_AGENT en base.ts); no lleva correo ni datos personales.
 * https://api.met.no/doc/TermsOfService
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

const BASE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

/** Pasos horarios que devolvio la API en la prueba real. No es un maximo garantizado. */
export const PASOS_OBSERVADOS = 89;

interface RespuestaMetNo {
  properties: {
    meta: { updated_at: string; units: Record<string, string> };
    timeseries: {
      time: string;
      data: {
        instant: {
          details: {
            air_temperature?: number;
            relative_humidity?: number;
            wind_speed?: number;
          };
        };
        next_1_hours?: { details?: { precipitation_amount?: number } };
      };
    }[];
  };
}

export interface SerieMetNo extends SerieHoraria {
  /** Punto de rocio DERIVADO (Magnus-Tetens), no medido: met.no no lo da. */
  puntoRocioDerivado: (number | null)[];
  /** Cabecera Expires de met.no: antes de esa hora no hay que volver a pedir. */
  expiraEn: string | null;
}

/**
 * Punto de rocio por la aproximacion de Magnus-Tetens.
 * Se marca como DERIVADO porque met.no no publica el dato: si se usa, se dice.
 */
export function puntoRocioMagnus(tC: number, hrPct: number): number {
  const a = 17.27;
  const b = 237.7;
  const hr = Math.min(100, Math.max(1, hrPct)) / 100;
  const alfa = (a * tC) / (b + tC) + Math.log(hr);
  return (b * alfa) / (a - alfa);
}

/** Pronostico de met.no, en UTC (la API no acepta zona horaria). */
export async function pronosticoMetNorway(
  lat: number,
  lon: number,
): Promise<ResultadoFuente<SerieMetNo>> {
  // met.no pide redondear las coordenadas a 4 decimales para que su cache sirva.
  const la = Number(lat.toFixed(4));
  const lo = Number(lon.toFixed(4));
  const url = `${BASE}?${new URLSearchParams({ lat: String(la), lon: String(lo) })}`;
  const clave = `metno:${url}`;
  const cacheado = leerCache<SerieMetNo>(clave);
  if (cacheado) return ok(cacheado, cacheado.procedencia);

  const p = procedencia({
    fuente: "MET Norway / yr.no (locationforecast 2.0 compact)",
    url,
    fechaPublicacion: null,
    esPronostico: true,
  });

  try {
    const { json, cabeceras } = await pedirJson<RespuestaMetNo>(url, { timeoutMs: 30_000 });
    const ts = json.properties.timeseries;

    const tiempo: string[] = [];
    const temperatura: (number | null)[] = [];
    const humedadRelativa: (number | null)[] = [];
    const precipitacion: (number | null)[] = [];
    const puntoRocioDerivado: (number | null)[] = [];

    for (const paso of ts) {
      const d = paso.data.instant.details;
      // La API cambia a pasos de 6 h pasados ~2.5 dias: sin next_1_hours no hay
      // precipitacion horaria, y el paso no sirve para contar horas mojadas.
      const mm = paso.data.next_1_hours?.details?.precipitation_amount;
      if (mm === undefined) continue;
      tiempo.push(paso.time.slice(0, 16));
      const t = d.air_temperature ?? null;
      const hr = d.relative_humidity ?? null;
      temperatura.push(t);
      humedadRelativa.push(hr);
      precipitacion.push(mm);
      puntoRocioDerivado.push(t != null && hr != null ? Number(puntoRocioMagnus(t, hr).toFixed(2)) : null);
    }

    const expira = cabeceras.get("expires");
    const serie: SerieMetNo = {
      tiempo,
      temperatura,
      humedadRelativa,
      precipitacion,
      // A proposito NO se rellena `puntoRocio`: el motor no debe tomar un valor
      // derivado como si fuera medido.
      puntoRocioDerivado,
      expiraEn: expira ? new Date(expira).toISOString() : null,
      procedencia: {
        ...p,
        fechaPublicacion: json.properties.meta.updated_at,
        avisos: [
          "Segunda opinion. NO alimenta el motor: met.no no publica punto de rocio ni historico.",
          `Pasos horarios utiles (con next_1_hours): ${tiempo.length}.`,
        ],
      },
    };

    // Respetamos el Expires de met.no; si no viene, el piso de 30 min.
    const ttl = expira
      ? Math.max(60, Math.floor((new Date(expira).getTime() - Date.now()) / 1000))
      : TTL.metNorway;
    guardarCache(clave, serie, ttl);
    return ok(serie, serie.procedencia);
  } catch (e) {
    return fallo(e, p);
  }
}
