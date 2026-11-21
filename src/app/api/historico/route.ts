/**
 * LA CORRIDA HACIA ATRAS (el momento 1:40 del demo)
 *
 * GET /api/historico?lat=&lon=&anio=2012&desde=04-01&hasta=11-30&respaldo=1
 *
 * ESTO ES HISTORICO, NO PRONOSTICO. `procedencia.esPronostico` viene en false y
 * la respuesta lo repite: no presentar estos datos como pronostico.
 *
 * Con `guardar=1` guarda los eventos calculados en la base (rol de servicio),
 * con los parametros con que se calcularon: el motor es determinista, asi que la
 * fila es reproducible.
 *
 * Con `respaldo=1` agrega el resumen de NASA POWER para la misma ventana (la
 * fuente que uso el paper ancla de Brasil). NASA POWER horario solo existe desde
 * 2001-01-01, asi que para 2012 si sirve.
 */
import { ADVERTENCIA_MOTOR, errorJson, json, leerCoordenadas, leerEntero } from "@/lib/api";
import { historicoHorario } from "@/lib/fuentes/open-meteo";
import { HORARIO_DESDE, historicoHorarioPower } from "@/lib/fuentes/nasa-power";
import { detectarEventos, riesgoPorDia } from "@/lib/motor/riesgo";
import { ROYA_CAFE } from "@/lib/motor/parametros";
import { estadoBase, guardarEventos } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const coords = leerCoordenadas(peticion.url);
  if (typeof coords === "string") return errorJson(coords);
  const q = new URL(peticion.url).searchParams;
  const anio = leerEntero(peticion.url, "anio", 2012, 1940, new Date().getUTCFullYear());
  const desde = `${anio}-${q.get("desde") ?? "04-01"}`;
  const hasta = `${anio}-${q.get("hasta") ?? "11-30"}`;

  const serie = await historicoHorario(coords.lat, coords.lon, desde, hasta);
  if (!serie.ok) {
    return json({ ok: false, error: serie.error, procedencia: serie.procedencia }, 502);
  }

  const eventos = detectarEventos(serie.datos, ROYA_CAFE);
  const confirmados = eventos.filter((e) => e.esEvento);
  const curva = riesgoPorDia(serie.datos, ROYA_CAFE);

  let respaldoPower: unknown = null;
  if (q.get("respaldo") === "1") {
    if (desde < HORARIO_DESDE) {
      respaldoPower = {
        ok: false,
        error: `NASA POWER horario empieza en ${HORARIO_DESDE}; se pidio ${desde}.`,
      };
    } else {
      const power = await historicoHorarioPower(coords.lat, coords.lon, desde, hasta);
      if (power.ok) {
        const evPower = detectarEventos(power.datos, ROYA_CAFE);
        respaldoPower = {
          ok: true,
          horas: power.datos.tiempo.length,
          eventos: evPower.length,
          eventosConfirmados: evPower.filter((e) => e.esEvento).length,
          altitudMetros: power.datos.altitudMetros,
          procedencia: power.procedencia,
          nota:
            "NASA POWER viene en UTC y Open-Meteo en hora local de Guatemala; las rachas " +
            "no caen en las mismas horas. El conteo se compara como orden de magnitud, no uno a uno.",
        };
      } else {
        respaldoPower = { ok: false, error: power.error, procedencia: power.procedencia };
      }
    }
  }

  // Guardado opcional. Si la base no esta configurada se dice, no se finge.
  let guardado: unknown = null;
  if (q.get("guardar") === "1") {
    const estado = estadoBase();
    if (!estado.configurada) {
      guardado = { ok: false, error: `Falta ${estado.faltan.join(", ")} en .env.local` };
    } else {
      try {
        const n = await guardarEventos({
          eventos,
          latitud: serie.datos.latitud,
          longitud: serie.datos.longitud,
          parametros: ROYA_CAFE,
          fuente: serie.datos.procedencia.fuente,
          esPronostico: false,
        });
        guardado = { ok: true, filas: n, tabla: "public.eventos_infeccion" };
      } catch (e) {
        guardado = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  }

  return json({
    ok: true,
    esPronostico: false,
    aclaracion: "Datos HISTORICOS (reanalisis ERA5 via Open-Meteo). No es un pronostico.",
    temporada: { anio, desde, hasta },
    punto: {
      latitud: serie.datos.latitud,
      longitud: serie.datos.longitud,
      altitudMetros: serie.datos.altitudMetros,
    },
    horas: serie.datos.tiempo.length,
    eventos: eventos.length,
    eventosConfirmados: confirmados.length,
    primerEvento: confirmados[0] ?? null,
    detalle: confirmados.slice(0, 20),
    curva,
    respaldoPower,
    guardado,
    procedencia: serie.datos.procedencia,
    advertencia: ADVERTENCIA_MOTOR,
  });
}
