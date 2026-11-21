/**
 * Pedir datos al backend sin mentirle al productor.
 *
 * Regla del proyecto: **un dato viejo se muestra con su fecha; nunca se
 * disfraza de dato fresco**. Por eso toda respuesta viaja envuelta en
 * `Resultado`, que dice si viene de la red o de la caché del teléfono, y
 * cuándo se recibió. La UI pinta esa fecha.
 */

import { guardarReporte, leerReporte } from "@/lib/ui/almacen";

export type Origen = "red" | "cache";

export interface Resultado<T> {
  datos: T;
  origen: Origen;
  /** ISO del momento en que ESTOS datos llegaron del servidor. */
  recibidoEn: string;
  /** Por qué se cayó a caché, si se cayó. */
  motivoCaida: string | null;
}

export class SinDatos extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "SinDatos";
  }
}

/**
 * Pide al backend. Si la red falla y hay un reporte guardado, lo devuelve
 * marcado como caché. Si no hay nada guardado, lanza: la pantalla muestra
 * "No disponible" y qué falta, nunca un cero inventado.
 */
export async function pedirConRespaldo<T>(
  clave: string,
  ruta: string,
  opciones: { tiempoMaximoMs?: number } = {},
): Promise<Resultado<T>> {
  const corte = AbortSignal.timeout(opciones.tiempoMaximoMs ?? 20000);
  let motivo: string;

  try {
    const r = await fetch(ruta, { signal: corte, cache: "no-store" });
    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
      throw new Error(cuerpo?.error ?? `El servidor respondió ${r.status}.`);
    }
    const datos = (await r.json()) as T;
    const guardado = guardarReporte(clave, datos);
    return { datos, origen: "red", recibidoEn: guardado.recibidoEn, motivoCaida: null };
  } catch (e) {
    motivo =
      typeof navigator !== "undefined" && !navigator.onLine
        ? "Sin conexión."
        : e instanceof Error
          ? e.message
          : "No se pudo consultar.";
  }

  const guardado = leerReporte<T>(clave);
  if (guardado) {
    return {
      datos: guardado.datos,
      origen: "cache",
      recibidoEn: guardado.recibidoEn,
      motivoCaida: motivo,
    };
  }

  throw new SinDatos(motivo);
}

/** Consulta de prevención para una parcela. */
export function rutaPrevencion(p: {
  latitud: number;
  longitud: number;
  nombre: string;
  ultimaAplicacion: string | null;
}): string {
  const q = new URLSearchParams({
    lat: String(p.latitud),
    lon: String(p.longitud),
    parcela: p.nombre,
  });
  if (p.ultimaAplicacion) q.set("ultimaAplicacion", p.ultimaAplicacion);
  return `/api/prevencion?${q.toString()}`;
}

/** Clave de caché por coordenada: cambiar de parcela no reusa el reporte de otra. */
export function clavePrevencion(latitud: number, longitud: number): string {
  return `prevencion.${latitud.toFixed(3)},${longitud.toFixed(3)}`;
}
