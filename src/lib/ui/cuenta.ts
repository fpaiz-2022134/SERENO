/**
 * La cuenta, desde el navegador.
 *
 * Todo pasa por el servidor. El token de sesión vive en una cookie `HttpOnly`,
 * así que este código NO puede leerlo — y eso es a propósito: un script
 * inyectado en la página tampoco puede.
 *
 * Lo único que sigue guardándose en el teléfono es el ÚLTIMO REPORTE del
 * clima, con su fecha, para poder abrir sin conexión. Eso no es identidad ni
 * dato de nadie: es el pronóstico, y la pantalla dice cuándo se bajó.
 */

export interface Sesion {
  correo: string;
  nombre: string | null;
  productorId: string | null;
}

export type EstadoCultivo = "sin_sintomas" | "sospecha" | "plaga_observada" | "no_se";

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
  ultimaAplicacion: string | null;
}

/** Lo que una parcela todavía sin guardar lleva dentro. */
export type ParcelaNueva = Omit<Parcela, "id">;

export class ErrorCuenta extends Error {
  readonly estado: number;
  constructor(mensaje: string, estado: number) {
    super(mensaje);
    this.name = "ErrorCuenta";
    this.estado = estado;
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(ruta, {
      ...opciones,
      credentials: "same-origin",
      headers: { "content-type": "application/json", ...(opciones.headers ?? {}) },
    });
  } catch {
    throw new ErrorCuenta(
      "No hay conexión con el servidor. Su cuenta y sus parcelas están a salvo; vuelva a intentar cuando tenga señal.",
      0,
    );
  }

  const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) {
    throw new ErrorCuenta(cuerpo?.error ?? `El servidor respondió ${r.status}.`, r.status);
  }
  return cuerpo as T;
}

export interface EstadoCuenta {
  sesion: Sesion | null;
  parcelas: Parcela[];
  /** false = el servidor no tiene base de datos configurada. */
  baseConfigurada: boolean;
}

export async function leerCuenta(): Promise<EstadoCuenta> {
  const d = await pedir<{
    sesion: Sesion | null;
    parcelas?: Parcela[];
    base: { configurada: boolean };
  }>("/api/cuenta");
  return {
    sesion: d.sesion,
    parcelas: d.parcelas ?? [],
    baseConfigurada: d.base.configurada,
  };
}

export async function registrarse(datos: {
  correo: string;
  clave: string;
  nombre?: string;
}): Promise<EstadoCuenta> {
  const d = await pedir<{ sesion: Sesion; parcelas: Parcela[] }>("/api/cuenta/registro", {
    method: "POST",
    body: JSON.stringify(datos),
  });
  return { sesion: d.sesion, parcelas: d.parcelas, baseConfigurada: true };
}

export async function entrar(datos: { correo: string; clave: string }): Promise<EstadoCuenta> {
  const d = await pedir<{ sesion: Sesion; parcelas: Parcela[] }>("/api/cuenta/acceso", {
    method: "POST",
    body: JSON.stringify(datos),
  });
  return { sesion: d.sesion, parcelas: d.parcelas, baseConfigurada: true };
}

export async function salir(): Promise<void> {
  await pedir("/api/cuenta/salir", { method: "POST" }).catch(() => {
    /* si no hay red, igual se limpia del lado del navegador */
  });
}

export async function guardarParcelaNueva(p: ParcelaNueva): Promise<Parcela> {
  const d = await pedir<{ parcela: Parcela }>("/api/parcelas", {
    method: "POST",
    body: JSON.stringify(p),
  });
  return d.parcela;
}

export async function guardarParcela(id: string, p: ParcelaNueva): Promise<Parcela> {
  const d = await pedir<{ parcela: Parcela }>(`/api/parcelas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(p),
  });
  return d.parcela;
}

/* ------------------------------------------------------------------ *
 * Catálogos que vienen del esquema, no inventados aquí
 * ------------------------------------------------------------------ */

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

export function nombreDeVariedad(id: string): string {
  return VARIEDADES.find((v) => v.id === id)?.nombre ?? "Otra";
}

export const ESTADOS_CULTIVO: { id: EstadoCultivo; nombre: string }[] = [
  { id: "sin_sintomas", nombre: "Sin síntomas" },
  { id: "sospecha", nombre: "Sospecha" },
  { id: "plaga_observada", nombre: "Plaga observada" },
  { id: "no_se", nombre: "No sé" },
];

/**
 * Los cinco cultivos que promete el branding.
 *
 * SOLO CAFÉ TIENE MOTOR, y esto no cambia porque ahora haya servidor: los
 * umbrales de roya salen de literatura primaria y para maíz, frijol,
 * cardamomo y hortalizas no tenemos ninguno verificado. Un backend no crea
 * un umbral científico.
 */
export const CULTIVOS: { id: string; nombre: string; conMotor: boolean }[] = [
  { id: "cafe", nombre: "Café", conMotor: true },
  { id: "maiz", nombre: "Maíz", conMotor: false },
  { id: "frijol", nombre: "Frijol", conMotor: false },
  { id: "cardamomo", nombre: "Cardamomo", conMotor: false },
  { id: "hortalizas", nombre: "Hortalizas", conMotor: false },
];

/** Las bandas de altitud de la lámina 9. La altura real la da la API. */
export function bandaDeAltitud(m: number | null): string {
  if (m == null) return "No disponible";
  if (m < 900) return "< 900 m";
  if (m < 1500) return "900 – 1,500 m";
  if (m <= 1800) return "1,500 – 1,800 m";
  return "> 1,800 m";
}

/** El nombre de pila para el saludo: el que dio al registrarse, o el correo. */
export function nombreDePila(sesion: Sesion): string {
  if (sesion.nombre) return sesion.nombre.trim().split(/\s+/)[0];
  const usuario = sesion.correo.split("@")[0] ?? "";
  const pila = usuario.split(/[._-]/)[0] ?? usuario;
  if (!pila) return "productor";
  return pila.charAt(0).toUpperCase() + pila.slice(1).toLowerCase();
}
