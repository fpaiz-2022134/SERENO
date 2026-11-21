/**
 * POST /api/cuenta/acceso — entrar.
 *
 * El mensaje de error es el MISMO si el correo no existe o si la contraseña
 * está mal: "Correo o contraseña incorrectos". Decir cuál de los dos falló le
 * regala a un atacante una lista de qué correos tienen cuenta.
 *
 * Y por lo mismo las dos ramas tardan parecido: si el usuario no existe se
 * espera igual, porque una respuesta instantánea también delata.
 */
import { errorJson } from "@/lib/api";
import { conexionServicio, estadoBase } from "@/lib/db";
import {
  anotarIntentoFallido,
  cookieDeSesion,
  correoValido,
  crearSesion,
  demasiadosIntentos,
  limpiarIntentos,
  normalizarCorreo,
  ruidoDeTiempo,
  verificarClave,
} from "@/lib/auth";
import { parcelasDe } from "@/lib/parcelas";

export const dynamic = "force-dynamic";

export async function POST(peticion: Request) {
  if (!estadoBase().configurada) {
    return errorJson("La base de datos no está configurada en el servidor.", 503);
  }

  let cuerpo: { correo?: string; clave?: string };
  try {
    cuerpo = await peticion.json();
  } catch {
    return errorJson("El cuerpo de la petición no es JSON válido.");
  }

  const correo = normalizarCorreo(cuerpo.correo ?? "");
  const clave = cuerpo.clave ?? "";

  if (!correoValido(correo) || clave.length === 0) {
    return errorJson("Escriba su correo y su contraseña.");
  }

  if (demasiadosIntentos(correo)) {
    return errorJson(
      "Demasiados intentos con este correo. Espere unos minutos y vuelva a probar.",
      429,
    );
  }

  const pool = conexionServicio();
  if (!pool) return errorJson("La base de datos no está configurada en el servidor.", 503);

  const r = await pool.query(
    `select u.id, u.correo, u.contrasena_hash, p.id as productor_id, p.nombre
       from public.usuarios u
       left join public.productores p on p.usuario_id = u.id
      where lower(u.correo) = $1
      limit 1`,
    [correo],
  );

  const fila = r.rowCount && r.rowCount > 0 ? r.rows[0] : null;
  const correcta = fila ? await verificarClave(clave, fila.contrasena_hash) : false;

  if (!fila || !correcta) {
    anotarIntentoFallido(correo);
    await ruidoDeTiempo();
    return errorJson("Correo o contraseña incorrectos.", 401);
  }

  limpiarIntentos(correo);

  await pool.query("update public.usuarios set ultimo_acceso_en = now() where id = $1", [fila.id]);
  const token = await crearSesion(fila.id, peticion.headers.get("user-agent"));
  const parcelas = fila.productor_id ? await parcelasDe(fila.id) : [];

  return new Response(
    JSON.stringify({
      ok: true,
      sesion: {
        correo: fila.correo,
        nombre: fila.nombre ?? null,
        productorId: fila.productor_id ?? null,
      },
      parcelas,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "set-cookie": cookieDeSesion(token),
      },
    },
  );
}
