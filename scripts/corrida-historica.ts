/**
 * LA CORRIDA HACIA ATRAS — el momento 1:40 del demo.
 *
 *   npm run corrida-historica                       # punto de demo, 2010-2013
 *   npm run corrida-historica -- 14.70 -91.20 2012
 *
 * DATOS HISTORICOS, NO PRONOSTICO.
 *
 * Imprime tambien la comparacion entre temporadas, que es la advertencia
 * verificada: el conteo de eventos NO distingue el ano del brote.
 */

import { historicoHorario } from "../src/lib/fuentes/open-meteo";
import { detectarEventos } from "../src/lib/motor/riesgo";

const lat = Number(process.argv[2] ?? 14.5);
const lon = Number(process.argv[3] ?? -91.15);
const anios = process.argv[4] ? [Number(process.argv[4])] : [2010, 2011, 2012, 2013];

async function main() {
  console.log(`SERENO · corrida hacia atras · punto ${lat}, ${lon}`);
  console.log(`DATOS HISTORICOS (reanalisis ERA5 via Open-Meteo). NO es pronostico.\n`);

  const resumen: { anio: number; rachas: number; eventos: number; lavados: number; primero: string }[] = [];

  for (const anio of anios) {
    const r = await historicoHorario(lat, lon, `${anio}-04-01`, `${anio}-11-30`);
    if (!r.ok) {
      console.log(`${anio}: ERROR ${r.error}`);
      continue;
    }
    const ev = detectarEventos(r.datos);
    const conf = ev.filter((e) => e.esEvento);
    const lavados = ev.filter((e) => e.lavadoPorLluvia).length;
    resumen.push({
      anio,
      rachas: ev.length,
      eventos: conf.length,
      lavados,
      primero: conf[0]?.dia ?? "—",
    });

    console.log(`=== temporada ${anio} (abr-nov) · altitud ${r.datos.altitudMetros} m · ${r.datos.tiempo.length} horas ===`);
    console.log(`eventos de infeccion: ${conf.length}   (rachas evaluadas: ${ev.length}, descartadas por lavado: ${lavados})`);
    if (conf.length > 0) {
      console.log(
        `${"inicio".padEnd(12)}${"h_mojado".padStart(10)}${"T_media".padStart(9)}${"W_req".padStart(8)}${"indice".padStart(8)}  lluvia_dia`,
      );
      for (const e of conf.slice(0, 10)) {
        console.log(
          `${e.dia.padEnd(12)}${String(e.horasMojadas).padStart(10)}${String(e.temperaturaMedia).padStart(9)}` +
            `${String(e.horasRequeridas).padStart(8)}${String(e.indice).padStart(8)}  ${e.lluviaDiariaMaxMm} mm`,
        );
      }
      if (conf.length > 10) console.log(`... y ${conf.length - 10} mas`);
      console.log(
        `\nPrimer evento ${conf[0].dia} -> sintomas visibles aprox. ` +
          `${conf[0].sintomasVisiblesDesde} a ${conf[0].sintomasVisiblesHasta} (incubacion 25-30 d)`,
      );
    }
    console.log();
  }

  if (resumen.length > 1) {
    console.log(`${"=".repeat(72)}`);
    console.log(`COMPARACION ENTRE TEMPORADAS — la advertencia que hay que decir en el pitch`);
    console.log(`${"=".repeat(72)}`);
    console.log(`${"temporada".padEnd(12)}${"eventos".padStart(9)}${"rachas".padStart(9)}${"lavadas".padStart(9)}   primer evento`);
    for (const r of resumen) {
      console.log(
        `${String(r.anio).padEnd(12)}${String(r.eventos).padStart(9)}${String(r.rachas).padStart(9)}` +
          `${String(r.lavados).padStart(9)}   ${r.primero}`,
      );
    }
    console.log(
      `\nEl conteo de eventos NO distingue el ano del brote. El clima solo no explica\n` +
        `un brote: hace falta el inoculo, la variedad, la sombra, la poda y la carga de\n` +
        `fruto. Eso lo reporta el productor. NO afirmar que el modelo predice brotes.\n` +
        `Lo que SI es demostrable: la fecha del primer evento de la temporada, semanas\n` +
        `antes de que se vea una mancha.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
