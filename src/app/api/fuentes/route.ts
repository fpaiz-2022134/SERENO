/**
 * ESTADO DE LAS SEIS FUENTES
 *
 * GET /api/fuentes?lat=&lon=&probar=1
 *
 * Sin `probar=1` devuelve solo la ficha de cada fuente (que es, que rango tiene,
 * si quedo integrada o preparada). Con `probar=1` hace una peticion real a cada
 * una y reporta lo que contesto. Sirve para el chequeo de la hora 1 del plan.
 */
import { json } from "@/lib/api";
import type { ResultadoFuente } from "@/lib/fuentes/base";
import {
  HISTORICO_DESDE,
  PRONOSTICO_DIAS_MAX,
  altitudDelPunto,
  historicoHorario,
  pronosticoHorario,
} from "@/lib/fuentes/open-meteo";
import { pronosticoMetNorway } from "@/lib/fuentes/met-norway";
import { noticiasPorTema } from "@/lib/fuentes/gdelt";
import { DIARIO_DESDE, HORARIO_DESDE, historicoDiarioPower } from "@/lib/fuentes/nasa-power";
import { importarBoletines } from "@/lib/fuentes/anacafe";
import { preciosMasRecientes } from "@/lib/fuentes/maga-precios";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const FICHAS = [
  {
    id: "open-meteo",
    nombre: "Open-Meteo",
    papel: "Fuente principal del motor",
    estado: "integrada",
    rango: `Historico horario desde ${HISTORICO_DESDE}; pronostico horario ${PRONOSTICO_DIAS_MAX} dias`,
    llave: "no requiere",
  },
  {
    id: "met-norway",
    nombre: "MET Norway / yr.no",
    papel: "Segunda opinion, NO alimenta el motor",
    estado: "integrada",
    rango: "Pronostico ~9.5 dias (89 pasos observados). Sin punto de rocio, sin historico",
    llave: "no requiere, pero exige User-Agent identificable",
  },
  {
    id: "gdelt",
    nombre: "GDELT DOC 2.0",
    papel: "Noticias como contexto, nunca veredicto",
    estado: "integrada",
    rango: "Ventanas de hasta 24 meses; limite de 1 peticion cada 5 s",
    llave: "no requiere",
  },
  {
    id: "nasa-power",
    nombre: "NASA POWER",
    papel: "Respaldo historico y argumento (es la fuente del paper ancla de Brasil)",
    estado: "integrada",
    rango: `Horario desde ${HORARIO_DESDE}; diario desde ${DIARIO_DESDE}. Sin pronostico`,
    llave: "no requiere",
  },
  {
    id: "anacafe",
    nombre: "Anacafé / CEDICAFÉ",
    papel: "Boletines tecnicos de roya, broca y clima",
    estado: "integrada (sin API: se lee un indice publico)",
    rango: "El indice publica boletines desde ~2020 hasta el mes corriente",
    llave: "no requiere",
  },
  {
    id: "maga-precios",
    nombre: "MAGA via catalogo.senacyt.gob.gt (CKAN)",
    papel: "Precios nacionales",
    estado: "integrada con limitacion declarada: el CAFE no aparece en los CSV",
    rango: "CSV mensuales; el dataset mayorista tiene 127 recursos",
    llave: "no requiere",
  },
] as const;

export async function GET(peticion: Request) {
  const q = new URL(peticion.url).searchParams;
  if (q.get("probar") !== "1") return json({ ok: true, fuentes: FICHAS });

  const lat = Number(q.get("lat") ?? 14.5);
  const lon = Number(q.get("lon") ?? -91.15);

  const [altitud, pron, hist, met, power, anacafe, precios] = await Promise.all([
    altitudDelPunto(lat, lon),
    pronosticoHorario(lat, lon, 16),
    historicoHorario(lat, lon, "2012-05-01", "2012-05-31"),
    pronosticoMetNorway(lat, lon),
    historicoDiarioPower(lat, lon, "1981-01-01", "1981-01-05"),
    importarBoletines(),
    preciosMasRecientes(),
  ]);
  // GDELT va aparte: no admite peticiones en paralelo.
  const gdelt = await noticiasPorTema("roya", { meses: 12, maximo: 10 });

  const resumen = <T,>(r: ResultadoFuente<T>, extra: Record<string, unknown>) => ({
    ok: r.ok,
    ...(r.ok ? extra : { error: r.error }),
    procedencia: r.procedencia,
  });

  return json({
    ok: true,
    punto: { lat, lon, altitudMetros: altitud.ok ? altitud.datos.altitudMetros : null },
    pruebas: {
      "open-meteo-pronostico": resumen(pron, {
        horas: pron.ok ? pron.datos.tiempo.length : 0,
        altitudMetros: pron.ok ? pron.datos.altitudMetros : null,
      }),
      "open-meteo-historico": resumen(hist, { horas: hist.ok ? hist.datos.tiempo.length : 0 }),
      "met-norway": resumen(met, { pasos: met.ok ? met.datos.tiempo.length : 0 }),
      gdelt: resumen(gdelt, { articulos: gdelt.ok ? gdelt.datos.length : 0 }),
      "nasa-power-diario": resumen(power, { dias: power.ok ? power.datos.dias.length : 0 }),
      anacafe: resumen(anacafe, { documentos: anacafe.ok ? anacafe.datos.length : 0 }),
      "maga-precios": resumen(precios, {
        filas: precios.ok ? precios.datos.filas.length : 0,
        cafeDisponible: precios.ok ? precios.datos.cafe.disponible : null,
        cacaoDisponible: precios.ok ? precios.datos.cacao.disponible : null,
      }),
    },
    fuentes: FICHAS,
  });
}
