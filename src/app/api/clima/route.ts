/**
 * PANEL CLIMATICO
 *
 * GET /api/clima?lat=&lon=&dias=16&comparar=1
 *
 * Devuelve el pronostico horario de Open-Meteo convertido en curva de riesgo
 * diaria + los eventos de infeccion detectados. Con `comparar=1` agrega la
 * segunda opinion de met.no (que NO alimenta el motor).
 */
import { ADVERTENCIA_MOTOR, errorJson, json, leerCoordenadas, leerEntero } from "@/lib/api";
import { pronosticoHorario } from "@/lib/fuentes/open-meteo";
import { pronosticoMetNorway } from "@/lib/fuentes/met-norway";
import { detectarEventos, riesgoPorDia } from "@/lib/motor/riesgo";
import { ROYA_CAFE } from "@/lib/motor/parametros";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const coords = leerCoordenadas(peticion.url);
  if (typeof coords === "string") return errorJson(coords);
  const dias = leerEntero(peticion.url, "dias", 16, 1, 16);
  const comparar = new URL(peticion.url).searchParams.get("comparar") === "1";

  const clima = await pronosticoHorario(coords.lat, coords.lon, dias);
  if (!clima.ok) {
    return json(
      { ok: false, error: clima.error, procedencia: clima.procedencia },
      502,
    );
  }

  const serie = clima.datos;
  const eventos = detectarEventos(serie, ROYA_CAFE);
  const curva = riesgoPorDia(serie, ROYA_CAFE);

  let segundaOpinion: unknown = null;
  if (comparar) {
    const met = await pronosticoMetNorway(coords.lat, coords.lon);
    segundaOpinion = met.ok
      ? {
          ok: true,
          // Comparacion honesta: met.no no da punto de rocio ni historico, asi
          // que solo se comparan T, HR y lluvia, y NO se corre el motor con ella.
          pasosHorarios: met.datos.tiempo.length,
          primeraHoraUtc: met.datos.tiempo[0] ?? null,
          ultimaHoraUtc: met.datos.tiempo[met.datos.tiempo.length - 1] ?? null,
          expiraEn: met.datos.expiraEn,
          procedencia: met.procedencia,
          nota: "Segunda opinion para comparar. El motor NO corre con esta fuente.",
        }
      : { ok: false, error: met.error, procedencia: met.procedencia };
  }

  return json({
    ok: true,
    punto: {
      latitud: serie.latitud,
      longitud: serie.longitud,
      altitudMetros: serie.altitudMetros,
    },
    parametros: {
      patogeno: ROYA_CAFE.patogeno,
      tMin: ROYA_CAFE.tMin,
      tOpt: ROYA_CAFE.tOpt,
      tMax: ROYA_CAFE.tMax,
      wMin: ROYA_CAFE.wMin,
      wMax: ROYA_CAFE.wMax,
      hrMojado: ROYA_CAFE.hrMojado,
      lluviaMojado: ROYA_CAFE.lluviaMojado,
      lluviaLavadoDia: ROYA_CAFE.lluviaLavadoDia,
      fuentes: ROYA_CAFE.fuentes,
    },
    horas: serie.tiempo.length,
    curva,
    eventos,
    eventosConfirmados: eventos.filter((e) => e.esEvento).length,
    segundaOpinion,
    procedencia: serie.procedencia,
    advertencia: ADVERTENCIA_MOTOR,
  });
}
