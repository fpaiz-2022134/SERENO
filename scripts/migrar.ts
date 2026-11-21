/**
 * Aplica las migraciones de db/migraciones en orden.
 *
 *   npm run migrar            # aplica las que falten
 *   npm run migrar -- --lista # solo dice cuales estan aplicadas
 *
 * Lleva su propio registro en `public.migraciones`, asi que correrlo dos veces
 * no repite nada. Cada archivo va dentro de UNA transaccion: si falla a la
 * mitad, no queda a medias.
 *
 * Usa DATABASE_URL (la conexion DIRECTA, no la del pooler: el pooler en modo
 * transaccion no lleva bien todo el DDL).
 */

import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { Client } from "pg";

const DIR = path.join(process.cwd(), "db", "migraciones");

function cargarEnv(): void {
  // Sin dependencias: leemos .env.local a mano.
  for (const archivo of [".env.local", ".env"]) {
    try {
      const texto = readFileSync(path.join(process.cwd(), archivo), "utf8");
      for (const linea of texto.split("\n")) {
        const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (!m) continue;
        if (process.env[m[1]]) continue;
        process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch {
      /* el archivo no existe, no pasa nada */
    }
  }
}

async function main() {
  cargarEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "Falta DATABASE_URL. Copia .env.example a .env.local y pon la cadena de conexion.",
    );
    process.exit(1);
  }

  const cliente = new Client({ connectionString: url });
  await cliente.connect();

  await cliente.query(`
    create table if not exists public.migraciones (
      nombre text primary key,
      sha256 text not null,
      aplicada_en timestamptz not null default now()
    )
  `);
  // El registro de migraciones no se le concede a `sereno_app`, pero activamos
  // RLS igual: si manana alguien da un GRANT de mas, esto sigue cerrado.
  await cliente.query("alter table public.migraciones enable row level security");

  const aplicadas = new Map<string, string>(
    (await cliente.query<{ nombre: string; sha256: string }>(
      "select nombre, sha256 from public.migraciones",
    )).rows.map((r) => [r.nombre, r.sha256]),
  );

  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

  if (process.argv.includes("--lista")) {
    for (const f of archivos) {
      console.log(`${aplicadas.has(f) ? "✓" : "·"} ${f}`);
    }
    await cliente.end();
    return;
  }

  for (const archivo of archivos) {
    const sql = readFileSync(path.join(DIR, archivo), "utf8");
    const sha = createHash("sha256").update(sql).digest("hex");
    const yaEsta = aplicadas.get(archivo);

    if (yaEsta === sha) {
      console.log(`✓ ${archivo} (ya aplicada)`);
      continue;
    }
    if (yaEsta && yaEsta !== sha) {
      // No se reaplica en silencio una migracion editada: eso esconde
      // divergencias entre lo que dice el repo y lo que tiene la base.
      console.error(
        `✗ ${archivo} ya esta aplicada pero el archivo CAMBIO desde entonces.\n` +
          `  Haz una migracion nueva en vez de editar una ya aplicada.`,
      );
      process.exitCode = 1;
      continue;
    }

    process.stdout.write(`→ ${archivo} ... `);
    try {
      await cliente.query("begin");
      await cliente.query(sql);
      await cliente.query(
        "insert into public.migraciones (nombre, sha256) values ($1, $2)",
        [archivo, sha],
      );
      await cliente.query("commit");
      console.log("aplicada");
    } catch (e) {
      await cliente.query("rollback").catch(() => {});
      console.log("FALLO");
      console.error(e instanceof Error ? e.message : e);
      await cliente.end();
      process.exit(1);
    }
  }

  await cliente.end();
  console.log("\nListo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
