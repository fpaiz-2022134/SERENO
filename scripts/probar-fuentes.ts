/**
 * Prueba las SEIS fuentes con peticiones HTTP REALES y escribe el reporte.
 *
 *   npm run probar-fuentes            # coordenada de demo por defecto
 *   npm run probar-fuentes -- 15.32 -91.47
 *
 * No hay mocks. Lo que imprime este script es lo que contestaron las APIs.
 */

import { altitudDelPunto, historicoHorario, pronosticoHorario } from "../src/lib/fuentes/open-meteo";
import { pronosticoMetNorway } from "../src/lib/fuentes/met-norway";
import { noticiasAgro } from "../src/lib/fuentes/gdelt";
import {
  DIARIO_DESDE,
  historicoDiarioPower,
  historicoHorarioPower,
} from "../src/lib/fuentes/nasa-power";
import { buscarDocumentos, importarBoletines } from "../src/lib/fuentes/anacafe";
import { buscarDatasets, preciosMasRecientes } from "../src/lib/fuentes/maga-precios";
import { detectarEventos, riesgoPorDia, ventanaDeAccion } from "../src/lib/motor/riesgo";

const lat = Number(process.argv[2] ?? 14.5);
const lon = Number(process.argv[3] ?? -91.15);

function titulo(n: number, s: string) {
  console.log(`\n${"=".repeat(72)}\n${n} · ${s}\n${"=".repeat(72)}`);
}

async function main() {
  console.log(`SERENO · prueba de fuentes con peticiones reales`);
  console.log(`Punto: ${lat}, ${lon}   ·   ${new Date().toISOString()}`);

  /* ---------------- 1 Open-Meteo ---------------- */
  titulo(1, "Open-Meteo — fuente principal del motor");
  const alt = await altitudDelPunto(lat, lon);
  console.log(
    `altitud del punto: ${alt.ok ? `${alt.datos.altitudMetros} m` : `ERROR ${alt.error}`}`,
  );
  const pron = await pronosticoHorario(lat, lon, 16);
  if (pron.ok) {
    const s = pron.datos;
    console.log(`pronostico: ${s.tiempo.length} horas  ${s.tiempo[0]} -> ${s.tiempo.at(-1)}`);
    console.log(`variables: T, HR, punto de rocio, lluvia, prob. lluvia, viento`);
    const curva = riesgoPorDia(s);
    const eventos = detectarEventos(s);
    const v = ventanaDeAccion(curva);
    console.log(
      `motor sobre el pronostico: ${eventos.length} rachas, ` +
        `${eventos.filter((e) => e.esEvento).length} eventos confirmados`,
    );
    console.log(
      `ventana de accion: ${v ? `${v.inicio} -> ${v.fin} (aplicar antes del ${v.aplicarAntesDe}, indice ${v.indiceMaximo})` : "ninguna en el pronostico"}`,
    );
    if (s.procedencia.avisos) s.procedencia.avisos.forEach((a) => console.log(`AVISO: ${a}`));
  } else console.log(`ERROR: ${pron.error}`);

  const hist = await historicoHorario(lat, lon, "2012-04-01", "2012-11-30");
  if (hist.ok) {
    const ev = detectarEventos(hist.datos);
    const conf = ev.filter((e) => e.esEvento);
    console.log(
      `historico 2012 (abr-nov): ${hist.datos.tiempo.length} horas, ` +
        `${ev.length} rachas, ${conf.length} eventos confirmados`,
    );
    if (conf[0]) {
      console.log(
        `  primer evento ${conf[0].dia}: ${conf[0].horasMojadas} h mojadas, ` +
          `T ${conf[0].temperaturaMedia} °C, W ${conf[0].horasRequeridas} h, indice ${conf[0].indice}`,
      );
      console.log(
        `  sintomas visibles aprox. ${conf[0].sintomasVisiblesDesde} a ${conf[0].sintomasVisiblesHasta}`,
      );
    }
    console.log(
      `  descartados por lavado de lluvia (>10 mm/dia): ${ev.filter((e) => e.lavadoPorLluvia).length}`,
    );
  } else console.log(`ERROR historico: ${hist.error}`);

  /* ---------------- 2 met.no ---------------- */
  titulo(2, "MET Norway / yr.no — segunda opinion, NO alimenta el motor");
  const met = await pronosticoMetNorway(lat, lon);
  if (met.ok) {
    console.log(
      `${met.datos.tiempo.length} pasos horarios utiles  ${met.datos.tiempo[0]} -> ${met.datos.tiempo.at(-1)} (UTC)`,
    );
    console.log(`emitido: ${met.procedencia.fechaPublicacion}`);
    console.log(`expira:  ${met.datos.expiraEn}  (se respeta la cabecera)`);
    console.log(`punto de rocio propio: NO (met.no no lo publica; derivamos Magnus y lo marcamos)`);
  } else console.log(`ERROR: ${met.error}`);

  /* ---------------- 3 GDELT ---------------- */
  titulo(3, "GDELT DOC 2.0 — noticias, contexto nunca veredicto");
  const g = await noticiasAgro(["roya", "broca", "precio_cafe"], { meses: 3, maximoPorTema: 15 });
  console.log(`articulos deduplicados: ${g.noticias.length}`);
  console.log(`errores: ${g.errores.length > 0 ? JSON.stringify(g.errores) : "ninguno"}`);
  for (const n of g.noticias.slice(0, 6)) {
    console.log(
      `  [${n.tema}]${n.prioritario ? " *" : "  "} ${n.vistoEn?.slice(0, 10)} ${n.pais ?? "?"} · ${n.titulo.slice(0, 60)}`,
    );
  }
  console.log(`(* = Guatemala o Centroamerica, que se priorizan)`);

  /* ---------------- 4 NASA POWER ---------------- */
  titulo(4, "NASA POWER — respaldo historico");
  const ph = await historicoHorarioPower(lat, lon, "2012-05-01", "2012-05-10");
  console.log(
    ph.ok
      ? `horario 2012: ${ph.datos.tiempo.length} horas, altitud ${ph.datos.altitudMetros} m`
      : `ERROR horario: ${ph.error}`,
  );
  const p1990 = await historicoHorarioPower(lat, lon, "1990-05-01", "1990-05-02");
  console.log(`horario 1990 (debe rechazarse): ${p1990.ok ? "RESPONDIO (inesperado)" : p1990.error}`);
  const pd = await historicoDiarioPower(lat, lon, DIARIO_DESDE, "1981-01-05");
  console.log(
    pd.ok
      ? `diario desde ${DIARIO_DESDE}: ${pd.datos.dias.length} dias, primer dia ${pd.datos.dias[0]?.dia} T=${pd.datos.dias[0]?.temperaturaMedia} °C`
      : `ERROR diario: ${pd.error}`,
  );
  const pd80 = await historicoDiarioPower(lat, lon, "1980-01-01", "1980-01-02");
  console.log(`diario 1980 (debe rechazarse): ${pd80.ok ? "RESPONDIO (inesperado)" : pd80.error}`);

  /* ---------------- 5 Anacafe ---------------- */
  titulo(5, "Anacafé / CEDICAFÉ — sin API, indice publico");
  const a = await importarBoletines();
  if (a.ok) {
    console.log(`documentos encontrados en el indice: ${a.datos.length}`);
    const porTema = a.datos.reduce<Record<string, number>>((acc, d) => {
      acc[d.tema] = (acc[d.tema] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`por tema: ${JSON.stringify(porTema)}`);
    console.log(`busqueda por enfermedad = roya:`);
    for (const d of buscarDocumentos(a.datos, { tema: "roya", limite: 5 })) {
      console.log(`  ${d.periodo ?? "s/f"}  ${d.titulo.slice(0, 58)}`);
    }
  } else console.log(`ERROR: ${a.error}`);

  /* ---------------- 6 MAGA ---------------- */
  titulo(6, "MAGA / precios — CKAN");
  const bus = await buscarDatasets("precios");
  console.log(
    bus.ok ? `package_search: ${bus.datos.total} datasets · ${bus.datos.nombres.join(", ")}` : `ERROR: ${bus.error}`,
  );
  const pr = await preciosMasRecientes();
  if (pr.ok) {
    console.log(`dataset: ${pr.datos.dataset.titulo}`);
    console.log(`organizacion: ${pr.datos.dataset.organizacion} · licencia: ${pr.datos.dataset.licencia}`);
    console.log(`CSV usado: ${pr.datos.recurso.nombre} (${pr.datos.recurso.creado?.slice(0, 10)})`);
    console.log(`filas: ${pr.datos.filas.length}`);
    console.log(`CAFE  -> disponible: ${pr.datos.cafe.disponible}`);
    if (!pr.datos.cafe.disponible) console.log(`        motivo: ${pr.datos.cafe.motivo}`);
    console.log(`CACAO -> disponible: ${pr.datos.cacao.disponible}`);
    for (const f of pr.datos.cacao.filas.slice(0, 3)) {
      console.log(`        ${f.producto} · ${f.medida} · ${f.moneda} ${f.precio} · ${f.mercado} · ${f.fecha} (${f.actor})`);
    }
  } else console.log(`ERROR: ${pr.error}`);

  console.log(`\n${"=".repeat(72)}\nFin.\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
