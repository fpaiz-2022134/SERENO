/**
 * Autenticación de SERENO. SOLO SERVIDOR.
 *
 * Sin dependencias: `node:crypto` trae scrypt, que es una función de derivación
 * de clave diseñada justo para esto (lenta a propósito y cara en memoria, así
 * que un atacante con la tabla robada no puede probar millones de contraseñas
 * por segundo). No hace falta bcrypt ni argon2 para esto.
 *
 * DOS COSAS QUE NO SE GUARDAN NUNCA:
 *
 *  1. La contraseña. Se guarda `scrypt(contraseña, sal)` con una sal aleatoria
 *     por usuario. De ahí no se vuelve.
 *
 *  2. El token de sesión. Se guarda su SHA-256. El token original vive solo en
 *     la cookie del teléfono del productor. Si alguien se lleva la tabla
 *     `sesiones`, no entra con nada de lo que hay ahí.
 *
 * Y la comparación de hashes es `timingSafeEqual`, no `===`: comparar con `===`
 * sale antes en el primer byte distinto, y de esa diferencia de microsegundos
 * se puede sacar el hash a fuerza de intentos.
 */

import {
  createHash,
  randomBytes,
  randomInt,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

import { conexionServicio } from "@/lib/db";

/**
 * `promisify(scrypt)` pierde la sobrecarga que acepta opciones, así que la
 * envoltura va a mano para poder pasar N, r y p con tipos.
 */
function scrypt(
  clave: string,
  sal: Buffer,
  largo: number,
  opciones: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scryptCb(clave, sal, largo, opciones, (e, derivada) =>
      e ? rechazar(e) : resolver(derivada),
    );
  });
}

/* ------------------------------------------------------------------ *
 * Contraseñas
 * ------------------------------------------------------------------ */

/** Coste de scrypt. 16384 tarda ~100 ms, que es lo que se quiere. */
const N = 16384;
const R = 8;
const P = 1;
const LARGO = 64;

/** Lo mínimo que se le exige a una contraseña, y se le dice al usuario. */
export const CLAVE_MINIMA = 8;

export function revisarClave(clave: string): string | null {
  if (clave.length < CLAVE_MINIMA) {
    return `La contraseña necesita al menos ${CLAVE_MINIMA} caracteres.`;
  }
  if (clave.length > 200) return "La contraseña es demasiado larga.";
  return null;
}

export function correoValido(correo: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) && correo.length <= 254;
}

/** Normaliza el correo: minúsculas y sin espacios alrededor. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/** Devuelve "scrypt$N$r$p$sal$hash", todo en base64url. */
export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scrypt(clave.normalize("NFKC"), sal, LARGO, { N, r: R, p: P });
  return [
    "scrypt",
    N,
    R,
    P,
    sal.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

/** Comprueba la contraseña contra lo guardado, en tiempo constante. */
export async function verificarClave(clave: string, guardado: string | null): Promise<boolean> {
  if (!guardado) return false;
  const partes = guardado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, nTxt, rTxt, pTxt, salB64, hashB64] = partes;
  const n = Number(nTxt);
  const r = Number(rTxt);
  const p = Number(pTxt);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const sal = Buffer.from(salB64, "base64url");
  const esperado = Buffer.from(hashB64, "base64url");

  let calculado: Buffer;
  try {
    calculado = await scrypt(clave.normalize("NFKC"), sal, esperado.length, { N: n, r, p });
  } catch {
    return false;
  }

  if (calculado.length !== esperado.length) return false;
  return timingSafeEqual(calculado, esperado);
}

/* ------------------------------------------------------------------ *
 * Sesiones
 * ------------------------------------------------------------------ */

export const COOKIE_SESION = "sereno_sesion";

/** 30 días. Un productor no debería tener que volver a entrar cada semana. */
const DIAS_SESION = 30;

function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface UsuarioSesion {
  usuarioId: string;
  correo: string;
  productorId: string | null;
  nombre: string | null;
}

/**
 * Crea una sesión y devuelve el token EN CLARO, que es lo único que se le da
 * al navegador. En la base queda solo su hash.
 */
export async function crearSesion(usuarioId: string, agente?: string | null): Promise<string> {
  const pool = conexionServicio();
  if (!pool) throw new Error("Falta DATABASE_URL.");

  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DIAS_SESION * 86_400_000);

  await pool.query(
    `insert into public.sesiones (usuario_id, token_hash, expira_en, agente)
     values ($1, $2, $3, $4)`,
    [usuarioId, hashDeToken(token), expira, agente?.slice(0, 200) ?? null],
  );

  // Barrido oportunista: ya estamos conectados, no cuesta nada.
  pool.query("select public.borrar_sesiones_vencidas()").catch(() => {});

  return token;
}

/** Quién es el dueño de este token, o null si no vale o ya venció. */
export async function usuarioDeSesion(token: string | undefined): Promise<UsuarioSesion | null> {
  if (!token) return null;
  const pool = conexionServicio();
  if (!pool) return null;

  const r = await pool.query(
    `select u.id as usuario_id, u.correo, p.id as productor_id, p.nombre
       from public.sesiones s
       join public.usuarios u on u.id = s.usuario_id
       left join public.productores p on p.usuario_id = u.id
      where s.token_hash = $1 and s.expira_en > now()
      limit 1`,
    [hashDeToken(token)],
  );
  if (r.rowCount === 0) return null;

  // Sin await: que la petición no espere a esta escritura.
  pool
    .query("update public.sesiones set ultimo_uso_en = now() where token_hash = $1", [
      hashDeToken(token),
    ])
    .catch(() => {});

  const f = r.rows[0];
  return {
    usuarioId: f.usuario_id,
    correo: f.correo,
    productorId: f.productor_id ?? null,
    nombre: f.nombre ?? null,
  };
}

export async function cerrarSesion(token: string | undefined): Promise<void> {
  if (!token) return;
  const pool = conexionServicio();
  if (!pool) return;
  await pool.query("delete from public.sesiones where token_hash = $1", [hashDeToken(token)]);
}

/** Cierra TODAS las sesiones de un usuario. Para "salir de todos lados". */
export async function cerrarTodasLasSesiones(usuarioId: string): Promise<void> {
  const pool = conexionServicio();
  if (!pool) return;
  await pool.query("delete from public.sesiones where usuario_id = $1", [usuarioId]);
}

/* ------------------------------------------------------------------ *
 * La cookie
 * ------------------------------------------------------------------ */

export function cookieDeSesion(token: string): string {
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return (
    `${COOKIE_SESION}=${token}; Path=/; HttpOnly;${seguro} SameSite=Lax; ` +
    `Max-Age=${DIAS_SESION * 86_400}`
  );
}

export function cookieBorrada(): string {
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${COOKIE_SESION}=; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=0`;
}

/** Lee la cookie de sesión de la petición, sin depender de `next/headers`. */
export function tokenDePeticion(peticion: Request): string | undefined {
  const crudo = peticion.headers.get("cookie");
  if (!crudo) return undefined;
  for (const trozo of crudo.split(";")) {
    const i = trozo.indexOf("=");
    if (i < 0) continue;
    if (trozo.slice(0, i).trim() === COOKIE_SESION) {
      return decodeURIComponent(trozo.slice(i + 1).trim());
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Freno a la fuerza bruta
 *
 * En memoria, por instancia. No es una defensa seria contra un atacante
 * distribuido —para eso haría falta la base o un Redis— pero sí frena el caso
 * real: alguien probando contraseñas contra un correo desde un sitio.
 * Está declarado así a propósito en vez de fingir que es más de lo que es.
 * ------------------------------------------------------------------ */

const intentos = new Map<string, { n: number; hasta: number }>();
const MAX_INTENTOS = 8;
const CASTIGO_MS = 10 * 60_000;

export function demasiadosIntentos(llave: string): boolean {
  const x = intentos.get(llave);
  if (!x) return false;
  if (Date.now() > x.hasta) {
    intentos.delete(llave);
    return false;
  }
  return x.n >= MAX_INTENTOS;
}

export function anotarIntentoFallido(llave: string): void {
  const x = intentos.get(llave);
  if (!x || Date.now() > x.hasta) {
    intentos.set(llave, { n: 1, hasta: Date.now() + CASTIGO_MS });
    return;
  }
  x.n += 1;
}

export function limpiarIntentos(llave: string): void {
  intentos.delete(llave);
}

/** Espera aleatoria corta, para que "no existe" y "clave mala" tarden igual. */
export async function ruidoDeTiempo(): Promise<void> {
  await new Promise((r) => setTimeout(r, randomInt(60, 180)));
}
