/**
 * Acceso a Postgres. SOLO SERVIDOR.
 *
 * La base vive en Neon, pero este modulo no usa nada propio de Neon: es `pg`
 * contra un Postgres cualquiera. El mismo codigo corre contra Neon, contra
 * Supabase o contra un Postgres local.
 *
 * ===================== LOS DOS ROLES, Y POR QUE =====================
 * `conexionServicio()`  -> DATABASE_URL, el rol DUENO. Salta el RLS. Es para el
 *                          motor, para guardar series y para escribir las
 *                          fuentes externas. Nunca para atender a un productor.
 *
 * `comoProductor(id, f)` -> DATABASE_URL_APP, el rol `sereno_app`, que NO es
 *                          dueno, asi que el RLS SI se le aplica. Abre una
 *                          transaccion, pone `SET LOCAL sereno.usuario_id` y
 *                          corre la consulta. Al cerrar la transaccion la
 *                          variable muere, asi que no se filtra a la siguiente
 *                          peticion del pool.
 *
 * Si alguien atiende peticiones de usuario con la conexion de servicio, el RLS
 * deja de servir SIN QUE SALTE NINGUN ERROR. De ahi que sean dos funciones
 * distintas y no un parametro.
 * ====================================================================
 */

import { Pool, type PoolClient } from "pg";

import type { ParametrosPatogeno } from "@/lib/motor/parametros";
import type { EventoInfeccion } from "@/lib/motor/tipos";

let poolServicio: Pool | null = null;
let poolApp: Pool | null = null;

export interface EstadoBase {
  configurada: boolean;
  faltan: string[];
  /** true si hay rol de aplicacion y por tanto se puede operar con RLS. */
  tieneRolApp: boolean;
}

export function estadoBase(): EstadoBase {
  const faltan: string[] = [];
  if (!process.env.DATABASE_URL) faltan.push("DATABASE_URL");
  return {
    configurada: faltan.length === 0,
    faltan,
    tieneRolApp: Boolean(process.env.DATABASE_URL_APP),
  };
}

/** Pool con el rol dueno. Salta RLS: solo para el backend. */
export function conexionServicio(): Pool | null {
  const url = process.env.DATABASE_URL_POOLED ?? process.env.DATABASE_URL;
  if (!url) return null;
  if (!poolServicio) {
    poolServicio = new Pool({ connectionString: url, max: 5 });
  }
  return poolServicio;
}

/** Pool con el rol `sereno_app`. El RLS se le aplica. */
function conexionApp(): Pool | null {
  const url = process.env.DATABASE_URL_APP;
  if (!url) return null;
  if (!poolApp) {
    poolApp = new Pool({ connectionString: url, max: 5 });
  }
  return poolApp;
}

/**
 * Corre `trabajo` en una transaccion con la identidad del usuario puesta, con el
 * rol al que SI se le aplica el RLS.
 *
 * `SET LOCAL` es deliberado: la variable vive solo mientras dure la transaccion.
 * Con `SET` normal se quedaria pegada en la conexion del pool y la siguiente
 * peticion heredaria la identidad del usuario anterior.
 */
export async function comoProductor<T>(
  usuarioId: string,
  trabajo: (cliente: PoolClient) => Promise<T>,
): Promise<T> {
  const pool = conexionApp();
  if (!pool) {
    throw new Error(
      "Falta DATABASE_URL_APP: es la conexion con el rol sereno_app, el unico al " +
        "que se le aplica el RLS. Ver el README, seccion Base de datos.",
    );
  }
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    // Parametrizado: el uuid nunca se interpola en el texto del SQL.
    await cliente.query("select set_config('sereno.usuario_id', $1, true)", [usuarioId]);
    const r = await trabajo(cliente);
    await cliente.query("commit");
    return r;
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

/** Consulta suelta con el rol de servicio. */
export async function consultaServicio<T extends Record<string, unknown>>(
  sql: string,
  valores: unknown[] = [],
): Promise<T[]> {
  const pool = conexionServicio();
  if (!pool) throw new Error("Falta DATABASE_URL.");
  const r = await pool.query(sql, valores);
  return r.rows as T[];
}

export async function cerrarConexiones(): Promise<void> {
  await Promise.all([poolServicio?.end(), poolApp?.end()]);
  poolServicio = null;
  poolApp = null;
}

/* ------------------------------------------------------------------ *
 * Guardado de lo que calcula el motor
 * ------------------------------------------------------------------ */

/**
 * Guarda los eventos que calculo el motor, con el rol de SERVICIO.
 *
 * Se guardan los parametros con que se calcularon: el motor es determinista, asi
 * que con la serie y esta fila se puede reproducir el numero exacto. Si manana
 * cambia un umbral, las filas viejas siguen diciendo con que se hicieron.
 */
export async function guardarEventos(opciones: {
  eventos: EventoInfeccion[];
  latitud: number;
  longitud: number;
  parametros: ParametrosPatogeno;
  fuente: string;
  esPronostico: boolean;
  parcelaId?: string | null;
}): Promise<number> {
  const { eventos, latitud, longitud, parametros, fuente, esPronostico, parcelaId = null } = opciones;
  if (eventos.length === 0) return 0;
  const pool = conexionServicio();
  if (!pool) throw new Error("Falta DATABASE_URL.");

  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    let guardados = 0;
    for (const e of eventos) {
      const r = await cliente.query(
        `insert into public.eventos_infeccion (
           parcela_id, latitud, longitud, patogeno_id, dia, inicio, fin,
           horas_mojadas, temperatura_media, horas_requeridas, indice, nivel,
           alcanzo_umbral, lavado_por_lluvia, lluvia_optima, lluvia_diaria_max_mm,
           es_evento, sintomas_visibles_desde, sintomas_visibles_hasta,
           fuente, es_pronostico, parametros
         ) values (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
         )
         -- El motor es determinista: reprocesar la misma serie cae sobre las
         -- mismas filas en vez de duplicarlas (indice unico de la 0003).
         on conflict (parcela_id, latitud, longitud, patogeno_id, inicio, es_pronostico)
         do update set
           horas_mojadas = excluded.horas_mojadas,
           temperatura_media = excluded.temperatura_media,
           horas_requeridas = excluded.horas_requeridas,
           indice = excluded.indice,
           nivel = excluded.nivel,
           alcanzo_umbral = excluded.alcanzo_umbral,
           lavado_por_lluvia = excluded.lavado_por_lluvia,
           lluvia_optima = excluded.lluvia_optima,
           lluvia_diaria_max_mm = excluded.lluvia_diaria_max_mm,
           es_evento = excluded.es_evento,
           parametros = excluded.parametros,
           calculado_en = now()`,
        [
          parcelaId,
          latitud,
          longitud,
          parametros.id,
          e.dia,
          e.inicio,
          e.fin,
          e.horasMojadas,
          e.temperaturaMedia,
          // Infinity no cabe en numeric: se guarda null, que es lo que significa
          // ("ninguna cantidad de mojado infecta a esa temperatura").
          Number.isFinite(e.horasRequeridas) ? e.horasRequeridas : null,
          e.indice,
          e.nivel,
          e.alcanzoUmbral,
          e.lavadoPorLluvia,
          e.lluviaOptima,
          e.lluviaDiariaMaxMm,
          e.esEvento,
          e.sintomasVisiblesDesde,
          e.sintomasVisiblesHasta,
          fuente,
          esPronostico,
          JSON.stringify({
            tMin: parametros.tMin, tOpt: parametros.tOpt, tMax: parametros.tMax,
            wMin: parametros.wMin, wMax: parametros.wMax,
            hrMojado: parametros.hrMojado, lluviaMojado: parametros.lluviaMojado,
            lluviaLavadoDia: parametros.lluviaLavadoDia,
            lluviaOptimaDia: parametros.lluviaOptimaDia,
            factorLavado: parametros.factorLavado,
          }),
        ],
      );
      guardados += r.rowCount ?? 0;
    }
    await cliente.query("commit");
    return guardados;
  } catch (e) {
    await cliente.query("rollback").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}
