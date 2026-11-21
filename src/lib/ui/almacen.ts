/**
 * Todo lo que el teléfono guarda, en un solo lugar.
 *
 * Es `localStorage`: sobrevive sin conexión y sobrevive a cerrar la app, que es
 * justo lo que necesita un productor con señal intermitente. No guarda nada
 * sensible: ni contraseñas ni credenciales de la base.
 */

const PREFIJO = "sereno.";

function leer<T>(clave: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* almacenamiento lleno o bloqueado: la app sigue funcionando en memoria */
  }
}

function borrar(clave: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PREFIJO + clave);
  } catch {
    /* nada que hacer */
  }
}

/* ------------------------------------------------------------------ */
/* Sesión                                                              */
/* ------------------------------------------------------------------ */

export interface Sesion {
  correo: string;
  nombre: string;
  /** El paso del código de 6 números ya se completó. */
  correoConfirmado: boolean;
  /**
   * SIEMPRE true en esta versión: la sesión vive solo en este teléfono y no
   * hay servidor de identidad detrás. La pantalla de acceso lo dice en letra
   * visible; ver README § Autenticación.
   */
  soloLocal: true;
  creadaEn: string;
}

export const leerSesion = () => leer<Sesion>("sesion");
export const guardarSesion = (s: Sesion) => escribir("sesion", s);
export const borrarSesion = () => borrar("sesion");

/** El nombre de pila que se usa en el saludo, sacado del correo. */
export function nombreDesdeCorreo(correo: string): string {
  const usuario = correo.split("@")[0] ?? "";
  const pila = usuario.split(/[._-]/)[0] ?? usuario;
  if (!pila) return "productor";
  return pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Parcela                                                             */
/* ------------------------------------------------------------------ */

export type EstadoCultivo = "sin_sintomas" | "sospecha" | "plaga_observada" | "no_se";

export interface Parcela {
  nombre: string;
  /** Texto libre: "Chiantla, Huehuetenango". */
  lugar: string;
  latitud: number;
  longitud: number;
  /** La devuelve Open-Meteo para la celda. null hasta la primera consulta. */
  altitudMetros: number | null;
  /** Identificador del cultivo. Hoy solo "cafe" tiene motor validado. */
  cultivo: string;
  variedad: string;
  areaHa: number;
  estadoCultivo: EstadoCultivo;
  /** YYYY-MM-DD, o null si nunca ha aplicado. */
  ultimaAplicacion: string | null;
}

export const leerParcela = () => leer<Parcela>("parcela");
export const guardarParcela = (p: Parcela) => escribir("parcela", p);
export const borrarParcela = () => borrar("parcela");

export const ESTADOS_CULTIVO: { id: EstadoCultivo; nombre: string }[] = [
  { id: "sin_sintomas", nombre: "Sin síntomas" },
  { id: "sospecha", nombre: "Sospecha" },
  { id: "plaga_observada", nombre: "Plaga observada" },
  { id: "no_se", nombre: "No sé" },
];

/**
 * Los cinco cultivos que promete el branding.
 *
 * SOLO CAFÉ TIENE MOTOR. Los umbrales de roya salen de literatura primaria
 * (Magarey 2005 + APS + Kushalappa 1983); para maíz, frijol, cardamomo y
 * hortalizas NO tenemos ningún umbral verificado, así que esos chips quedan
 * deshabilitados y dicen "próximamente". Inventar un umbral es exactamente lo
 * que el equipo acordó no hacer.
 */
export const CULTIVOS: { id: string; nombre: string; conMotor: boolean }[] = [
  { id: "cafe", nombre: "Café", conMotor: true },
  { id: "maiz", nombre: "Maíz", conMotor: false },
  { id: "frijol", nombre: "Frijol", conMotor: false },
  { id: "cardamomo", nombre: "Cardamomo", conMotor: false },
  { id: "hortalizas", nombre: "Hortalizas", conMotor: false },
];

export const VARIEDADES_CAFE = ["Caturra", "Bourbon", "Catuaí", "Typica", "Anacafé 14", "Otra"];

/** Las bandas de altitud de la lámina 9. La altura real la da la API. */
export function bandaDeAltitud(m: number | null): string {
  if (m == null) return "No disponible";
  if (m < 900) return "< 900 m";
  if (m < 1500) return "900 – 1,500 m";
  if (m <= 1800) return "1,500 – 1,800 m";
  return "> 1,800 m";
}

/* ------------------------------------------------------------------ */
/* Costos orientativos (pantalla Resultado)                            */
/* ------------------------------------------------------------------ */

export interface Costos {
  inspeccionQ: number | null;
  prevencionQ: number | null;
}

export const leerCostos = () => leer<Costos>("costos");
export const guardarCostos = (c: Costos) => escribir("costos", c);

/* ------------------------------------------------------------------ */
/* "Para hoy": las tres acciones                                       */
/* ------------------------------------------------------------------ */

export const leerAccionesHechas = () => leer<string[]>("acciones") ?? [];
export const guardarAccionesHechas = (ids: string[]) => escribir("acciones", ids);

/* ------------------------------------------------------------------ */
/* Seguimientos guardados                                              */
/* ------------------------------------------------------------------ */

export interface Seguimiento {
  guardadoEn: string;
  parcela: string;
  nivel: string;
  ventana: { inicio: string; fin: string; aplicarAntesDe: string } | null;
  costoTotalQ: number | null;
  texto: string;
}

export const leerSeguimientos = () => leer<Seguimiento[]>("seguimientos") ?? [];

export function agregarSeguimiento(s: Seguimiento): Seguimiento[] {
  const todos = [s, ...leerSeguimientos()].slice(0, 20);
  escribir("seguimientos", todos);
  return todos;
}

/* ------------------------------------------------------------------ */
/* El último reporte, para abrir sin conexión                          */
/* ------------------------------------------------------------------ */

export interface ReporteGuardado<T> {
  /** ISO del momento en que se recibió del servidor. Se muestra tal cual. */
  recibidoEn: string;
  datos: T;
}

export function leerReporte<T>(clave: string): ReporteGuardado<T> | null {
  return leer<ReporteGuardado<T>>(`reporte.${clave}`);
}

export function guardarReporte<T>(clave: string, datos: T): ReporteGuardado<T> {
  const r: ReporteGuardado<T> = { recibidoEn: new Date().toISOString(), datos };
  escribir(`reporte.${clave}`, r);
  return r;
}
