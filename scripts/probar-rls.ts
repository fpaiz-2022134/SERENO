/**
 * Prueba el RLS contra la base de verdad, no contra una suposicion.
 *
 *   npm run probar-rls
 *
 * Crea dos productores de prueba (Ana y Beto) con una parcela cada uno, y
 * comprueba, con el rol `sereno_app`, que:
 *   1. Ana ve su parcela y SOLO la suya.
 *   2. Beto ve la suya y SOLO la suya.
 *   3. Ana no puede leer el reporte de incidencia de Beto.
 *   4. Ana no puede EDITAR la parcela de Beto (0 filas afectadas).
 *   5. Ana no puede robarse la parcela de Beto cambiandole el productor_id.
 *   6. Sin identidad puesta, no se ve NADA.
 *   7. El contenido publico (variedades) si se lee.
 *   8. La app NO puede escribir las fuentes externas (noticias).
 *
 * Al final borra los datos de prueba. Si algo falla, sale con codigo 1.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { comoProductor, cerrarConexiones } from "../src/lib/db";

function cargarEnv(): void {
  try {
    for (const linea of readFileSync(path.join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no existe */
  }
}

let fallos = 0;
function comprobar(que: string, bien: boolean, detalle = ""): void {
  console.log(`${bien ? "✓" : "✗"} ${que}${detalle ? `  — ${detalle}` : ""}`);
  if (!bien) fallos++;
}

async function main() {
  cargarEnv();
  const urlDueno = process.env.DATABASE_URL;
  if (!urlDueno) throw new Error("Falta DATABASE_URL");
  if (!process.env.DATABASE_URL_APP) {
    throw new Error("Falta DATABASE_URL_APP. Corre: npm run crear-rol-app");
  }

  const dueno = new Client({ connectionString: urlDueno });
  await dueno.connect();

  // --- Montaje, con el rol dueno (salta RLS) ---
  const { rows: us } = await dueno.query<{ id: string }>(
    `insert into public.usuarios (correo) values ('ana@prueba.sereno'), ('beto@prueba.sereno')
     returning id`,
  );
  const [anaUsuario, betoUsuario] = us.map((r) => r.id);

  const { rows: prods } = await dueno.query<{ id: string; usuario_id: string }>(
    `insert into public.productores (usuario_id, nombre) values ($1,'Ana'), ($2,'Beto')
     returning id, usuario_id`,
    [anaUsuario, betoUsuario],
  );
  const anaProd = prods.find((p) => p.usuario_id === anaUsuario)!.id;
  const betoProd = prods.find((p) => p.usuario_id === betoUsuario)!.id;

  const { rows: parcelas } = await dueno.query<{ id: string; productor_id: string }>(
    `insert into public.parcelas (productor_id, nombre, latitud, longitud, altitud_metros)
     values ($1,'Parcela de Ana',14.50,-91.15,912), ($2,'Parcela de Beto',14.50,-91.15,912)
     returning id, productor_id`,
    [anaProd, betoProd],
  );
  const parcelaBeto = parcelas.find((p) => p.productor_id === betoProd)!.id;

  await dueno.query(
    `insert into public.reportes_incidencia (parcela_id, plantas_con_manchas, incidencia_pct)
     select id, '3-o-mas', 30 from public.parcelas where productor_id = $1`,
    [betoProd],
  );

  console.log("\n=== RLS contra la base real (Neon) ===\n");

  // --- 1 y 3: Ana ---
  await comoProductor(anaUsuario, async (c) => {
    const p = await c.query<{ nombre: string }>("select nombre from public.parcelas");
    comprobar(
      "Ana ve 1 parcela y es la suya",
      p.rowCount === 1 && p.rows[0].nombre === "Parcela de Ana",
      `vio ${p.rowCount}: ${p.rows.map((x) => x.nombre).join(", ")}`,
    );
    const r = await c.query("select * from public.reportes_incidencia");
    comprobar("Ana no ve el reporte de incidencia de Beto", r.rowCount === 0, `vio ${r.rowCount}`);
    const v = await c.query("select * from public.variedades");
    comprobar("Ana si lee el contenido publico (variedades)", (v.rowCount ?? 0) >= 10, `vio ${v.rowCount}`);
  });

  // --- 2: Beto ---
  await comoProductor(betoUsuario, async (c) => {
    const p = await c.query<{ nombre: string }>("select nombre from public.parcelas");
    comprobar(
      "Beto ve 1 parcela y es la suya",
      p.rowCount === 1 && p.rows[0].nombre === "Parcela de Beto",
      `vio ${p.rowCount}: ${p.rows.map((x) => x.nombre).join(", ")}`,
    );
  });

  // --- 4 y 5: Ana intentando tocar lo de Beto ---
  await comoProductor(anaUsuario, async (c) => {
    const u = await c.query("update public.parcelas set nombre='secuestrada' where id=$1", [parcelaBeto]);
    comprobar("Ana no puede editar la parcela de Beto", u.rowCount === 0, `afecto ${u.rowCount} filas`);

    let bloqueado = false;
    try {
      await c.query("update public.parcelas set productor_id=$1 where id=$2", [anaProd, parcelaBeto]);
      const r = await c.query("select 1 from public.parcelas where id=$1 and productor_id=$2", [parcelaBeto, anaProd]);
      bloqueado = r.rowCount === 0;
    } catch {
      bloqueado = true;
    }
    comprobar("Ana no puede robarse la parcela de Beto cambiando el productor_id", bloqueado);

    let noEscribe = false;
    try {
      await c.query("insert into public.noticias (titulo, url, tema) values ('x','http://x','roya')");
    } catch {
      noEscribe = true;
    }
    comprobar("La app NO puede escribir las fuentes externas (noticias)", noEscribe);
  });

  // --- 6: sin identidad ---
  await comoProductor("00000000-0000-0000-0000-000000000000", async (c) => {
    const p = await c.query("select * from public.parcelas");
    comprobar("Un usuario desconocido no ve ninguna parcela", p.rowCount === 0, `vio ${p.rowCount}`);
  });

  // --- Limpieza ---
  await dueno.query(`delete from public.usuarios where correo like '%@prueba.sereno'`);
  const { rows: quedan } = await dueno.query<{ n: string }>(
    `select count(*)::text as n from public.parcelas where nombre like 'Parcela de %'`,
  );
  comprobar("Los datos de prueba quedaron borrados (cascada)", quedan[0].n === "0", `quedan ${quedan[0].n}`);

  await dueno.end();
  await cerrarConexiones();

  console.log(fallos === 0 ? "\nTodo bien.\n" : `\n${fallos} comprobacion(es) fallaron.\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await cerrarConexiones().catch(() => {});
  process.exit(1);
});
