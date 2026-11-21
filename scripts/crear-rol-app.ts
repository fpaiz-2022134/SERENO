/**
 * Le pone LOGIN y contrasena al rol `sereno_app` y escribe DATABASE_URL_APP en
 * .env.local.
 *
 *   npm run crear-rol-app
 *
 * `sereno_app` lo crea la migracion 0002 como `nologin`, porque una migracion
 * no debe llevar una contrasena adentro. Este script la genera al azar, se la
 * pone y la guarda SOLO en .env.local, que esta en .gitignore.
 *
 * Es el rol con el que el backend atiende a un productor: NO es dueno de las
 * tablas, asi que el RLS si se le aplica.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { Client } from "pg";

const RUTA_ENV = path.join(process.cwd(), ".env.local");

function leerEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const linea of readFileSync(RUTA_ENV, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no existe */
  }
  return out;
}

async function main() {
  const env = leerEnv();
  const url = process.env.DATABASE_URL ?? env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL en .env.local.");
    process.exit(1);
  }

  const clave = randomBytes(21).toString("base64url");

  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  // ALTER ROLE no acepta parametros, y un bloque DO tampoco los recibe. Asi que
  // le pedimos a Postgres que nos escape la contrasena como literal (%L) y
  // ejecutamos el texto que devuelve. La clave nunca se concatena a mano.
  const { rows } = await cliente.query<{ sentencia: string }>(
    `select format('alter role sereno_app with login password %L', $1::text) as sentencia`,
    [clave],
  );
  await cliente.query(rows[0].sentencia);
  await cliente.end();

  // La URL de la app usa el pooler: son muchas conexiones cortas.
  const base = new URL(url.replace(/^postgresql:/, "https:"));
  const hostPooler = base.hostname.includes("-pooler")
    ? base.hostname
    : base.hostname.replace(/^(ep-[^.]+)\./, "$1-pooler.");
  const urlApp =
    `postgresql://sereno_app:${encodeURIComponent(clave)}@${hostPooler}` +
    `${base.pathname}?sslmode=require`;

  const texto = readFileSync(RUTA_ENV, "utf8");
  const nuevo = texto.includes("DATABASE_URL_APP=")
    ? texto.replace(/DATABASE_URL_APP=.*/, `DATABASE_URL_APP="${urlApp}"`)
    : `${texto.trimEnd()}\nDATABASE_URL_APP="${urlApp}"\n`;
  writeFileSync(RUTA_ENV, nuevo, { mode: 0o600 });

  console.log("Rol sereno_app listo. DATABASE_URL_APP escrita en .env.local.");
  console.log("La contrasena NO se imprime: esta solo en .env.local.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
