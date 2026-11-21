/**
 * Lo que se guarda en el teléfono, y nada más.
 *
 * La cuenta y las parcelas YA NO viven aquí: están en Postgres y se piden al
 * servidor (`src/lib/ui/cuenta.ts`). Aquí quedan solo tres cosas, y cada una
 * tiene su razón para estar en el teléfono y no en la base:
 *
 *  1. EL ÚLTIMO REPORTE del clima, con la fecha en que se bajó. Es lo que
 *     permite abrir sin conexión. No es dato de nadie: es el pronóstico.
 *  2. Las labores marcadas y los costos tecleados: preferencias de la pantalla
 *     de hoy, que no vale la pena sincronizar.
 *  3. Los seguimientos guardados para el historial local.
 *
 * El token de sesión NO está aquí a propósito: vive en una cookie `HttpOnly`,
 * donde este código —y cualquier script inyectado en la página— no lo alcanza.
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

/* ------------------------------------------------------------------ *
 * Costos orientativos (pantalla Resultado)
 * ------------------------------------------------------------------ */

export interface Costos {
  inspeccionQ: number | null;
  prevencionQ: number | null;
}

export const leerCostos = () => leer<Costos>("costos");
export const guardarCostos = (c: Costos) => escribir("costos", c);

/* ------------------------------------------------------------------ *
 * "Para hoy": las tres labores
 * ------------------------------------------------------------------ */

export const leerAccionesHechas = () => leer<string[]>("acciones") ?? [];
export const guardarAccionesHechas = (ids: string[]) => escribir("acciones", ids);

/* ------------------------------------------------------------------ *
 * Seguimientos guardados
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * El último reporte, para abrir sin conexión
 * ------------------------------------------------------------------ */

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

/**
 * Al salir de la cuenta se borra todo lo del teléfono: el reporte de la
 * parcela de alguien no tiene por qué quedarse para el siguiente que entre.
 */
export function borrarTodoLoLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const claves = Object.keys(window.localStorage).filter((k) => k.startsWith(PREFIJO));
    for (const k of claves) window.localStorage.removeItem(k);
  } catch {
    /* nada que hacer */
  }
}

/* ------------------------------------------------------------------ *
 * Instantánea de la cuenta, para abrir sin conexión
 *
 * Con las cuentas en el servidor aparece un problema que no existía cuando
 * todo vivía en el teléfono: SIN CONEXIÓN LA APP NO PUEDE PREGUNTAR QUIÉN
 * ENTRÓ. Si no se resolviera, un productor sin señal vería la pantalla de
 * acceso en vez de su reporte — y abrir sin señal es justo lo que el producto
 * promete.
 *
 * Por eso se guarda una copia de lo último que dijo el servidor: el correo, el
 * nombre y las parcelas. NO el token de sesión, que sigue en la cookie
 * `HttpOnly` donde este código no lo alcanza.
 *
 * La copia solo se usa cuando la petición falla por red. Si el servidor
 * responde que no hay sesión, manda el servidor y la copia se borra.
 * ------------------------------------------------------------------ */

export interface Instantanea<S, P> {
  guardadaEn: string;
  sesion: S;
  parcelas: P[];
}

export function guardarInstantanea<S, P>(sesion: S, parcelas: P[]): void {
  escribir("cuenta", { guardadaEn: new Date().toISOString(), sesion, parcelas });
}

export function leerInstantanea<S, P>(): Instantanea<S, P> | null {
  return leer<Instantanea<S, P>>("cuenta");
}

export function borrarInstantanea(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${PREFIJO}cuenta`);
  } catch {
    /* nada que hacer */
  }
}
