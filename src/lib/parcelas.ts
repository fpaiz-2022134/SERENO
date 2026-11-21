/**
 * Parcelas en Postgres. SOLO SERVIDOR.
 *
 * TODO lo de aquí pasa por `comoProductor()`, es decir, por el rol
 * `sereno_app`, al que SÍ se le aplica el RLS. Nunca por `conexionServicio()`.
 *
 * Esto no es una formalidad: si estas consultas usaran el rol dueño, el
 * `where productor_id = ...` sería la única defensa, y un bug en un filtro le
 * enseñaría a un productor las parcelas de otro. Con `comoProductor()` el
 * filtro lo pone Postgres, debajo de cualquier consulta que escriba yo.
 *
 * Por eso varias consultas de abajo NO llevan `where productor_id`: no es un
 * descuido, es que la policy ya lo puso.
 */

import type { PoolClient } from "pg";

import { comoProductor } from "@/lib/db";

/** El estado del cultivo como lo pregunta la pantalla. */
export type EstadoCultivo = "sin_sintomas" | "sospecha" | "plaga_observada" | "no_se";

/**
 * Los tres botones de incidencia del esquema (`reportes_incidencia`) y los
 * cuatro estados de la pantalla no son lo mismo, así que el mapeo va escrito:
 * "no sé" NO es "ninguna". Un productor que no sabe no está diciendo que no
 * hay manchas, y guardarlo como "ninguna" sería inventarle una respuesta.
 */
const INCIDENCIA: Record<EstadoCultivo, { manchas: string; pct: number } | null> = {
  sin_sintomas: { manchas: "ninguna", pct: 0 },
  sospecha: { manchas: "1-2", pct: 15 },
  plaga_observada: { manchas: "3-o-mas", pct: 30 },
  no_se: null,
};

function estadoDesdeIncidencia(manchas: string | null): EstadoCultivo {
  if (manchas === "ninguna") return "sin_sintomas";
  if (manchas === "1-2") return "sospecha";
  if (manchas === "3-o-mas") return "plaga_observada";
  return "no_se";
}

/** Las variedades del esquema, con el nombre que enseña la pantalla. */
export const VARIEDADES: { id: string; nombre: string }[] = [
  { id: "caturra", nombre: "Caturra" },
  { id: "bourbon", nombre: "Bourbon" },
  { id: "catuai", nombre: "Catuaí" },
  { id: "typica", nombre: "Typica" },
  { id: "pache", nombre: "Pache" },
  { id: "anacafe-14", nombre: "Anacafé 14" },
  { id: "marsellesa", nombre: "Marsellesa" },
  { id: "sarchimor", nombre: "Sarchimor" },
  { id: "catimor", nombre: "Catimor" },
  { id: "otra", nombre: "Otra / no sé" },
];

const IDS_VARIEDAD = new Set(VARIEDADES.map((v) => v.id));

export interface Parcela {
  id: string;
  nombre: string;
  lugar: string;
  latitud: number;
  longitud: number;
  altitudMetros: number | null;
  variedadId: string;
  areaHa: number;
  estadoCultivo: EstadoCultivo;
  /** YYYY-MM-DD de la última aplicación anotada, o null. */
  ultimaAplicacion: string | null;
}

export interface ParcelaEntrante {
  nombre?: string;
  lugar?: string;
  latitud?: number;
  longitud?: number;
  altitudMetros?: number | null;
  variedadId?: string;
  areaHa?: number;
  estadoCultivo?: EstadoCultivo;
  ultimaAplicacion?: string | null;
}

/** Revisa lo que llega del navegador. Nada entra a la base sin pasar por aquí. */
export function revisarParcela(p: ParcelaEntrante): string | null {
  if (!p.nombre || p.nombre.trim().length === 0) return "La parcela necesita un nombre.";
  if (p.nombre.length > 120) return "El nombre de la parcela es demasiado largo.";
  if (typeof p.latitud !== "number" || !Number.isFinite(p.latitud) || Math.abs(p.latitud) > 90) {
    return "La latitud no es válida.";
  }
  if (typeof p.longitud !== "number" || !Number.isFinite(p.longitud) || Math.abs(p.longitud) > 180) {
    return "La longitud no es válida.";
  }
  if (p.areaHa != null && (!Number.isFinite(p.areaHa) || p.areaHa <= 0 || p.areaHa > 100000)) {
    return "El área no es válida.";
  }
  if (p.variedadId && !IDS_VARIEDAD.has(p.variedadId)) return "Esa variedad no está en la lista.";
  if (p.estadoCultivo && !(p.estadoCultivo in INCIDENCIA)) return "Ese estado de cultivo no existe.";
  if (p.ultimaAplicacion && !/^\d{4}-\d{2}-\d{2}$/.test(p.ultimaAplicacion)) {
    return "La fecha de la última aplicación no es válida.";
  }
  return null;
}

const SELECT = `
  select
    p.id, p.nombre, p.lugar, p.latitud, p.longitud, p.altitud_metros,
    p.variedad_id, p.area_hectareas,
    (select r.plantas_con_manchas
       from public.reportes_incidencia r
      where r.parcela_id = p.id
      order by r.fecha desc, r.creado_en desc
      limit 1) as manchas,
    (select to_char(a.fecha, 'YYYY-MM-DD')
       from public.aplicaciones a
      where a.parcela_id = p.id
      order by a.fecha desc
      limit 1) as ultima_aplicacion
  from public.parcelas p
`;

function aParcela(f: Record<string, unknown>): Parcela {
  return {
    id: String(f.id),
    nombre: String(f.nombre),
    lugar: (f.lugar as string | null) ?? "",
    // numeric de Postgres llega como texto: hay que convertirlo o la UI
    // recibiría "14.500000" donde espera un número.
    latitud: Number(f.latitud),
    longitud: Number(f.longitud),
    altitudMetros: f.altitud_metros == null ? null : Number(f.altitud_metros),
    variedadId: (f.variedad_id as string | null) ?? "otra",
    areaHa: f.area_hectareas == null ? 0 : Number(f.area_hectareas),
    estadoCultivo: estadoDesdeIncidencia((f.manchas as string | null) ?? null),
    ultimaAplicacion: (f.ultima_aplicacion as string | null) ?? null,
  };
}

/** Las parcelas del productor. El RLS hace el filtro, no el `where`. */
export async function parcelasDe(usuarioId: string): Promise<Parcela[]> {
  return comoProductor(usuarioId, async (c) => {
    const r = await c.query(`${SELECT} order by p.creado_en asc`);
    return r.rows.map(aParcela);
  });
}

/** Anota el estado del cultivo y la última aplicación, si vinieron. */
async function guardarLoQueCuelga(
  c: PoolClient,
  parcelaId: string,
  datos: ParcelaEntrante,
): Promise<void> {
  if (datos.estadoCultivo) {
    const inc = INCIDENCIA[datos.estadoCultivo];
    // "No sé" no genera reporte: no hay nada que reportar. Y se borra el del
    // día, para que no quede pegado el de antes como si lo hubiera dicho hoy.
    await c.query("delete from public.reportes_incidencia where parcela_id = $1 and fecha = current_date", [
      parcelaId,
    ]);
    if (inc) {
      await c.query(
        `insert into public.reportes_incidencia
           (parcela_id, fecha, plantas_con_manchas, incidencia_pct)
         values ($1, current_date, $2, $3)`,
        [parcelaId, inc.manchas, inc.pct],
      );
    }
  }

  if (datos.ultimaAplicacion) {
    const ya = await c.query(
      "select 1 from public.aplicaciones where parcela_id = $1 and fecha = $2",
      [parcelaId, datos.ultimaAplicacion],
    );
    if (ya.rowCount === 0) {
      await c.query(
        `insert into public.aplicaciones (parcela_id, fecha, producto, nota)
         values ($1, $2, $3, $4)`,
        [
          parcelaId,
          datos.ultimaAplicacion,
          // `producto` es NOT NULL en el esquema y la pantalla solo pide la
          // fecha. Se escribe lo que de verdad sabemos, no un producto falso.
          "No especificado",
          "Anotada desde la pantalla de parcela; solo se registró la fecha.",
        ],
      );
    }
  }
}

export async function crearParcela(usuarioId: string, datos: ParcelaEntrante): Promise<Parcela> {
  return comoProductor(usuarioId, async (c) => {
    // `mi_productor_id()` es la misma función que usa el RLS: así la fila se
    // crea exactamente con el dueño que la policy va a exigir.
    const r = await c.query(
      `insert into public.parcelas
         (productor_id, nombre, lugar, latitud, longitud, altitud_metros,
          altitud_fuente, variedad_id, area_hectareas)
       values (public.mi_productor_id(), $1, $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        datos.nombre!.trim(),
        datos.lugar?.trim() || null,
        datos.latitud,
        datos.longitud,
        datos.altitudMetros ?? null,
        datos.altitudMetros != null ? "Open-Meteo" : null,
        datos.variedadId ?? "otra",
        datos.areaHa ?? null,
      ],
    );
    const id = r.rows[0].id as string;
    await guardarLoQueCuelga(c, id, datos);

    const leida = await c.query(`${SELECT} where p.id = $1`, [id]);
    return aParcela(leida.rows[0]);
  });
}

export async function actualizarParcela(
  usuarioId: string,
  parcelaId: string,
  datos: ParcelaEntrante,
): Promise<Parcela | null> {
  return comoProductor(usuarioId, async (c) => {
    // Sin `and productor_id = ...`: si la parcela no es suya, el RLS hace que
    // esta sentencia afecte cero filas. Es la prueba de que la policy manda.
    const r = await c.query(
      `update public.parcelas set
         nombre = $2, lugar = $3, latitud = $4, longitud = $5,
         altitud_metros = $6,
         altitud_fuente = case when $6::numeric is null then altitud_fuente else 'Open-Meteo' end,
         variedad_id = $7, area_hectareas = $8, actualizado_en = now()
       where id = $1
       returning id`,
      [
        parcelaId,
        datos.nombre!.trim(),
        datos.lugar?.trim() || null,
        datos.latitud,
        datos.longitud,
        datos.altitudMetros ?? null,
        datos.variedadId ?? "otra",
        datos.areaHa ?? null,
      ],
    );
    if (r.rowCount === 0) return null;

    await guardarLoQueCuelga(c, parcelaId, datos);
    const leida = await c.query(`${SELECT} where p.id = $1`, [parcelaId]);
    return leida.rowCount === 0 ? null : aParcela(leida.rows[0]);
  });
}

export async function borrarParcela(usuarioId: string, parcelaId: string): Promise<boolean> {
  return comoProductor(usuarioId, async (c) => {
    const r = await c.query("delete from public.parcelas where id = $1", [parcelaId]);
    return (r.rowCount ?? 0) > 0;
  });
}

/** Guarda la altitud que midió la fuente, sin tocar nada más. */
export async function anotarAltitud(
  usuarioId: string,
  parcelaId: string,
  altitudMetros: number,
): Promise<void> {
  await comoProductor(usuarioId, async (c) => {
    await c.query(
      `update public.parcelas
          set altitud_metros = $2, altitud_fuente = 'Open-Meteo', actualizado_en = now()
        where id = $1`,
      [parcelaId, altitudMetros],
    );
  });
}
