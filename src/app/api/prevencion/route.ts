/**
 * PANEL DE PREVENCION
 *
 * GET /api/prevencion?lat=&lon=&parcela=&ultimaAplicacion=YYYY-MM-DD
 *
 * Los cinco datos que cambian una decision (SERENO-investigacion.md §0A):
 *  1. la ventana de accion con fecha
 *  2. el indice 0-1 por dia en tres bandas
 *  3. horas de mojado acumuladas vs. requeridas
 *  4. la fecha en que se verian las manchas
 *  5. dias desde la ultima aplicacion y si el ultimo evento quedo cubierto
 * Mas el aviso redactado y los boletines de Anacafé del tema.
 */
import { ADVERTENCIA_MOTOR, condicionesActuales, errorJson, json, leerCoordenadas } from "@/lib/api";
import { pronosticoHorario } from "@/lib/fuentes/open-meteo";
import {
  coberturaDeAplicacion,
  detectarEventos,
  riesgoPorDia,
  ventanaDeAccion,
} from "@/lib/motor/riesgo";
import { ROYA_CAFE } from "@/lib/motor/parametros";
import { redactarAviso } from "@/lib/aviso";
import { DOCUMENTOS_DE_REFERENCIA, buscarDocumentos, importarBoletines } from "@/lib/fuentes/anacafe";

export const dynamic = "force-dynamic";

export async function GET(peticion: Request) {
  const coords = leerCoordenadas(peticion.url);
  if (typeof coords === "string") return errorJson(coords);
  const q = new URL(peticion.url).searchParams;
  const nombreParcela = q.get("parcela") ?? "Tu parcela";
  const ultimaAplicacion = q.get("ultimaAplicacion");

  const clima = await pronosticoHorario(coords.lat, coords.lon, 16);
  if (!clima.ok) {
    return json({ ok: false, error: clima.error, procedencia: clima.procedencia }, 502);
  }

  const serie = clima.datos;
  const eventos = detectarEventos(serie, ROYA_CAFE);
  const curva = riesgoPorDia(serie, ROYA_CAFE);
  const hoy = serie.tiempo[0]?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const ventana = ventanaDeAccion(curva, ROYA_CAFE, hoy);
  const aviso = redactarAviso({ nombreParcela, ventana, dias: curva, eventos, hoy });
  const cobertura = coberturaDeAplicacion(hoy, ultimaAplicacion, eventos);

  // Boletines de Anacafé sobre roya. Si el indice no responde, van los de referencia.
  const boletines = await importarBoletines();
  const documentos = boletines.ok
    ? buscarDocumentos(boletines.datos, { tema: "roya", limite: 6 })
    : DOCUMENTOS_DE_REFERENCIA.filter((d) => d.tema === "roya");

  return json({
    ok: true,
    punto: { latitud: serie.latitud, longitud: serie.longitud, altitudMetros: serie.altitudMetros },
    hoy,
    // Insumos del motor, NO decisiones: la UI los rotula como estimacion.
    ahora: condicionesActuales(serie),
    // Dato 1
    ventanaDeAccion: ventana,
    // Dato 2
    curva,
    // Dato 3 (el pico de la ventana)
    mojado: ventana
      ? curva
          .filter((d) => d.dia >= ventana.inicio && d.dia <= ventana.fin)
          .map((d) => ({
            dia: d.dia,
            horasMojadas: d.horasMojadas,
            horasRequeridas: Number.isFinite(d.horasRequeridas) ? d.horasRequeridas : null,
            temperaturaMedia: d.temperaturaMedia,
          }))
      : [],
    // Dato 4
    incubacionDias: [ROYA_CAFE.incubacionMinDias, ROYA_CAFE.incubacionMaxDias],
    sintomasSiHoyHayInfeccion: ventana
      ? { desde: ventana.sintomasVisiblesDesde, hasta: ventana.sintomasVisiblesHasta }
      : null,
    // Dato 5
    cobertura,
    aviso,
    // Lo que el productor tiene que aportar: el inoculo (umbral de aviso de la literatura)
    pendienteDelProductor: {
      incidenciaAvisoPct: ROYA_CAFE.incidenciaAvisoPct,
      nota:
        "El indice vale asumiendo que hay inoculo en la parcela. De 10 plantas, " +
        "cuantas tienen manchas? Pozza et al. 2021 recomienda avisar al 5 % de incidencia.",
    },
    boletinesAnacafe: {
      documentos,
      origen: boletines.ok ? "indice publico de CEDICAFE" : "lista de referencia verificada a mano",
      error: boletines.ok ? null : boletines.error,
      procedencia: boletines.procedencia,
    },
    procedencia: serie.procedencia,
    advertencia: ADVERTENCIA_MOTOR,
  });
}
