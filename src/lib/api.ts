/** Utilidades compartidas por los route handlers. */

export function leerCoordenadas(url: string): { lat: number; lon: number } | string {
  const q = new URL(url).searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return "Faltan o son invalidos los parametros lat y lon.";
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return "lat debe estar entre -90 y 90, y lon entre -180 y 180.";
  }
  return { lat, lon };
}

export function leerEntero(
  url: string,
  nombre: string,
  porDefecto: number,
  min: number,
  max: number,
): number {
  const crudo = new URL(url).searchParams.get(nombre);
  // Ojo: Number(null) es 0, no NaN. Hay que mirar si el parametro VINO.
  if (crudo === null || crudo.trim() === "") return porDefecto;
  const v = Number(crudo);
  if (!Number.isFinite(v)) return porDefecto;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

export function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo, null, 2), {
    status: estado,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorJson(mensaje: string, estado = 400): Response {
  return json({ ok: false, error: mensaje }, estado);
}

/** Aviso que viaja en toda respuesta del motor. Es parte del contrato del producto. */
export const ADVERTENCIA_MOTOR =
  "El motor es determinista: umbrales aritmeticos (Magarey et al. 2005) sobre series " +
  "meteorologicas horarias. NO predice brotes, predice ventanas de condiciones favorables " +
  "a la infeccion. El clima solo no explica un brote: hace falta el inoculo, que lo reporta " +
  "el productor. Verificado: el conteo de eventos no distingue el ano del brote " +
  "(2012, ano de la emergencia nacional en Guatemala, dio MENOS eventos que 2010 y 2011 " +
  "en la misma coordenada). Es apoyo a la decision, no un agronomo.";
