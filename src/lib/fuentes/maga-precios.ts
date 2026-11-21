/**
 * FUENTE 6 · MAGA / precios — catalogo CKAN de datos abiertos de Guatemala.
 *
 * catalogo.senacyt.gob.gt corre CKAN, asi que los CSV se descubren por API en
 * vez de a mano. Endpoints VERIFICADOS con peticiones reales (21 nov 2026):
 *
 *   /api/3/action/package_search?q=precios  -> 200, 2 datasets del MAGA:
 *     · precios-al-mayorista-de-productos-agropecuarios-e-hidrobiologicos (127 recursos, CC0)
 *     · precios-promedio-mensual-de-productos-agricolas-pecuarios-e-hidrobiologicos (9 recursos)
 *   /api/3/action/package_show?id=...       -> 200, con la lista de recursos y sus URL
 *   /api/3/action/organization_list         -> 200
 *
 * ================= EL HALLAZGO QUE HAY QUE DECIR ENTERO =================
 * Descargamos el CSV mas reciente (agosto 2026, 203 filas) y lo revisamos:
 *   · CACAO si aparece: "Cacao (Despulpado), seco, de primera", quintal,
 *     Q2,500.00, mercado La Terminal, mayorista, 1/08/2026.
 *   · CAFE NO APARECE. Ni una sola fila. El MAGA publica precios mayoristas de
 *     mercados terminales (CENMA, La Terminal) y el cafe no se vende ahi: va a
 *     beneficio/exportador.
 *
 * Por eso `precioCafe()` devuelve explicitamente "sin cotizacion nacional
 * disponible" y conserva la fuente oficial. NO se rellena con el C de Nueva York:
 * un precio internacional no es un precio nacional, y un precio mayorista no es
 * un precio al productor.
 * ========================================================================
 */

import {
  TTL,
  avisarSiViejo,
  fallo,
  guardarCache,
  leerCache,
  ok,
  pedir,
  pedirJson,
  procedencia,
  type ResultadoFuente,
} from "./base";

const CKAN = "https://catalogo.senacyt.gob.gt/api/3/action";

/** Datasets del MAGA confirmados en el catalogo. */
export const DATASETS_PRECIOS = [
  "precios-promedio-mensual-de-productos-agricolas-pecuarios-e-hidrobiologicos",
  "precios-al-mayorista-de-productos-agropecuarios-e-hidrobiologicos",
] as const;

interface RecursoCkan {
  id: string;
  name?: string;
  format?: string;
  url?: string;
  created?: string;
  last_modified?: string | null;
}

interface PaqueteCkan {
  name: string;
  title: string;
  notes?: string;
  license_title?: string | null;
  metadata_modified?: string;
  organization?: { title?: string };
  resources: RecursoCkan[];
}

export interface RecursoPrecios {
  id: string;
  nombre: string;
  formato: string;
  url: string;
  creado: string | null;
}

export interface DatasetPrecios {
  nombre: string;
  titulo: string;
  organizacion: string | null;
  licencia: string | null;
  metadataModificada: string | null;
  /** Solo los CSV, el mas reciente primero. */
  csv: RecursoPrecios[];
  totalRecursos: number;
}

function normalizarRecursos(rs: RecursoCkan[]): RecursoPrecios[] {
  return rs
    .filter((r) => (r.format ?? "").replace(/^\./, "").toLowerCase() === "csv" && r.url)
    .map((r) => ({
      id: r.id,
      nombre: (r.name ?? "").trim(),
      formato: "CSV",
      url: r.url!,
      creado: r.last_modified ?? r.created ?? null,
    }))
    .sort((a, b) => (b.creado ?? "").localeCompare(a.creado ?? ""));
}

/** Descubre los CSV por API CKAN (package_show). */
export async function descubrirDataset(
  id: string,
): Promise<ResultadoFuente<DatasetPrecios>> {
  const url = `${CKAN}/package_show?${new URLSearchParams({ id })}`;
  const clave = `ckan:pkg:${id}`;
  const cacheado = leerCache<DatasetPrecios>(clave);
  const p = procedencia({
    fuente: "MAGA via catalogo.senacyt.gob.gt (CKAN)",
    url,
    fechaPublicacion: null,
    esPronostico: false,
  });
  if (cacheado) return ok(cacheado, { ...p, fechaPublicacion: cacheado.metadataModificada });

  try {
    const { json } = await pedirJson<{ success: boolean; result: PaqueteCkan }>(url, {
      timeoutMs: 45_000,
    });
    if (!json.success) throw new Error(`CKAN devolvio success:false para ${id}`);
    const r = json.result;
    const ds: DatasetPrecios = {
      nombre: r.name,
      titulo: r.title,
      organizacion: r.organization?.title ?? null,
      licencia: r.license_title ?? null,
      metadataModificada: r.metadata_modified ?? null,
      csv: normalizarRecursos(r.resources),
      totalRecursos: r.resources.length,
    };
    guardarCache(clave, ds, TTL.precios);
    return ok(ds, { ...p, fechaPublicacion: ds.metadataModificada });
  } catch (e) {
    return fallo(e, p);
  }
}

/** Busca datasets de precios en el catalogo (package_search). */
export async function buscarDatasets(
  consulta = "precios",
): Promise<ResultadoFuente<{ total: number; nombres: string[] }>> {
  const url = `${CKAN}/package_search?${new URLSearchParams({ q: consulta, rows: "25" })}`;
  const p = procedencia({
    fuente: "MAGA via catalogo.senacyt.gob.gt (CKAN package_search)",
    url,
    fechaPublicacion: null,
    esPronostico: false,
  });
  try {
    const { json } = await pedirJson<{
      success: boolean;
      result: { count: number; results: PaqueteCkan[] };
    }>(url, { timeoutMs: 45_000 });
    return ok(
      { total: json.result.count, nombres: json.result.results.map((r) => r.name) },
      p,
    );
  } catch (e) {
    return fallo(e, p);
  }
}

/* ------------------------------------------------------------------ *
 * Lectura del CSV
 * ------------------------------------------------------------------ */

export interface FilaPrecio {
  /** "Mayorista": el MAGA publica precio MAYORISTA, no precio al productor. */
  actor: string;
  periodicidad: string;
  mercado: string;
  producto: string;
  medida: string;
  fecha: string | null;
  moneda: string;
  precio: number | null;
}

/** Parser de CSV minimo con comillas dobles. El CSV del MAGA trae BOM. */
export function parsearCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim() !== ""));
}

/** "1/08/2026" -> "2026-08-01". */
function fechaMaga(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** "2,500.00" -> 2500. */
function numeroMaga(s: string): number | null {
  const n = Number(s.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function filasDeCsv(texto: string): FilaPrecio[] {
  const filas = parsearCsv(texto);
  if (filas.length < 2) return [];
  const cab = filas[0].map((h) => h.trim().toLowerCase());
  const col = (nombre: string) => cab.findIndex((h) => h.includes(nombre));
  const iActor = col("actor");
  const iPeriodicidad = col("eriodicidad");
  const iMercado = col("mercado");
  const iProducto = col("producto");
  const iMedida = col("medida");
  const iFecha = col("fecha");
  const iMoneda = col("moneda");
  const iPrecio = col("precio");

  return filas.slice(1).map((f) => ({
    actor: f[iActor]?.trim() ?? "",
    periodicidad: f[iPeriodicidad]?.trim() ?? "",
    mercado: f[iMercado]?.trim() ?? "",
    producto: f[iProducto]?.trim() ?? "",
    medida: f[iMedida]?.trim() ?? "",
    fecha: f[iFecha] ? fechaMaga(f[iFecha]) : null,
    moneda: f[iMoneda]?.trim() ?? "GTQ",
    precio: f[iPrecio] ? numeroMaga(f[iPrecio]) : null,
  }));
}

/** Descarga y parsea un CSV de precios por su URL de CKAN. */
export async function leerCsvPrecios(
  url: string,
): Promise<ResultadoFuente<FilaPrecio[]>> {
  const clave = `ckan:csv:${url}`;
  const cacheado = leerCache<FilaPrecio[]>(clave);
  const p = procedencia({
    fuente: "MAGA — Precios promedio mensual (CSV, via catalogo.senacyt.gob.gt)",
    url,
    fechaPublicacion: null,
    esPronostico: false,
    avisos: [
      "Precio MAYORISTA en mercados terminales (CENMA, La Terminal). NO es precio al productor en finca.",
    ],
  });
  if (cacheado) return ok(cacheado, p);
  try {
    const { texto } = await pedir(url, { timeoutMs: 60_000, aceptar: "text/csv,*/*" });
    const filas = filasDeCsv(texto);
    guardarCache(clave, filas, TTL.precios);
    const fechas = filas.map((f) => f.fecha).filter((x): x is string => x !== null).sort();
    // Los precios del MAGA son mensuales: si pasan de 45 dias, que se vea.
    return ok(
      filas,
      avisarSiViejo({ ...p, fechaPublicacion: fechas[fechas.length - 1] ?? null }, 45),
    );
  } catch (e) {
    return fallo(e, p);
  }
}

/* ------------------------------------------------------------------ *
 * Consultas de producto
 * ------------------------------------------------------------------ */

export interface PrecioProducto {
  /** true si el producto aparece en el CSV oficial. */
  disponible: boolean;
  producto: string;
  filas: FilaPrecio[];
  /** Explicacion para la UI cuando `disponible` es false. */
  motivo?: string;
}

function normal(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function buscarProducto(filas: FilaPrecio[], aguja: string): FilaPrecio[] {
  const a = normal(aguja);
  return filas.filter((f) => normal(f.producto).includes(a));
}

/**
 * Precio nacional del CAFE.
 *
 * VERIFICADO: el cafe NO aparece en los CSV de precios del MAGA. Esta funcion
 * existe para decirlo con todas sus letras en la UI, no para inventar un numero.
 */
export function precioCafe(filas: FilaPrecio[]): PrecioProducto {
  const encontradas = buscarProducto(filas, "cafe").concat(buscarProducto(filas, "café"));
  if (encontradas.length > 0) {
    return { disponible: true, producto: "cafe", filas: encontradas };
  }
  return {
    disponible: false,
    producto: "cafe",
    filas: [],
    motivo:
      "Sin cotizacion nacional disponible. El MAGA publica precios MAYORISTAS de mercados terminales " +
      "(CENMA, La Terminal) y el cafe no se comercializa ahi: va a beneficio o exportador. " +
      "Verificado en el CSV de agosto 2026: 203 filas, ninguna de cafe. " +
      "NO se sustituye por el contrato C de Nueva York: un precio internacional no es un precio nacional, " +
      "y un precio mayorista no es un precio al productor en finca.",
  };
}

/** Precio nacional del CACAO. VERIFICADO: si aparece. */
export function precioCacao(filas: FilaPrecio[]): PrecioProducto {
  const encontradas = buscarProducto(filas, "cacao");
  if (encontradas.length > 0) {
    return { disponible: true, producto: "cacao", filas: encontradas };
  }
  return {
    disponible: false,
    producto: "cacao",
    filas: [],
    motivo: "No aparecio cacao en este CSV. En el de agosto 2026 si aparecia.",
  };
}

/** Flujo completo: descubre el dataset, baja el CSV mas reciente y lo parsea. */
export async function preciosMasRecientes(): Promise<
  ResultadoFuente<{
    dataset: DatasetPrecios;
    recurso: RecursoPrecios;
    filas: FilaPrecio[];
    cafe: PrecioProducto;
    cacao: PrecioProducto;
  }>
> {
  const p0 = procedencia({
    fuente: "MAGA via catalogo.senacyt.gob.gt (CKAN)",
    url: `${CKAN}/package_show?id=${DATASETS_PRECIOS[0]}`,
    fechaPublicacion: null,
    esPronostico: false,
  });
  for (const id of DATASETS_PRECIOS) {
    const ds = await descubrirDataset(id);
    if (!ds.ok || ds.datos.csv.length === 0) continue;
    const recurso = ds.datos.csv[0];
    const csv = await leerCsvPrecios(recurso.url);
    if (!csv.ok) continue;
    return ok(
      {
        dataset: ds.datos,
        recurso,
        filas: csv.datos,
        cafe: precioCafe(csv.datos),
        cacao: precioCacao(csv.datos),
      },
      csv.procedencia,
    );
  }
  return fallo(
    new Error("Ningun dataset de precios del MAGA devolvio un CSV legible."),
    p0,
  );
}
