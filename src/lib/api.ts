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

/* ------------------------------------------------------------------ */
/* Condiciones actuales para la pantalla "Hoy en mi finca".            */
/*                                                                     */
/* La UI del branding muestra temperatura, humedad y lluvia de 24 h    */
/* como datos 2, 3 y 4. Son INSUMOS del motor, no decisiones: por eso  */
/* viajan con `esEstimacion: true` y la UI los rotula                  */
/* "estimacion meteorologica, no una medicion en su finca".            */
/* No se inventa nada: salen de la misma serie horaria de Open-Meteo   */
/* con la que corre el motor. Si falta el dato, va null.               */
/* ------------------------------------------------------------------ */

interface SerieParaAhora {
  tiempo: string[];
  temperatura: (number | null)[];
  humedadRelativa: (number | null)[];
  precipitacion: (number | null)[];
}

export interface CondicionesActuales {
  /** Hora local de la serie a la que corresponden los valores. */
  hora: string | null;
  temperaturaC: number | null;
  humedadPct: number | null;
  /** Lluvia acumulada de las proximas 24 h desde `hora`, mm. */
  lluvia24hMm: number | null;
  /** Siempre true: es pronostico de celda, no un sensor en la finca. */
  esEstimacion: true;
}

/** Indice de la hora de la serie mas cercana (hacia atras) al momento actual. */
function indiceDeAhora(tiempo: string[], ahoraLocal: string): number {
  let i = 0;
  while (i + 1 < tiempo.length && tiempo[i + 1] <= ahoraLocal) i++;
  return i;
}

/** Momento actual en hora local de Guatemala, en el mismo formato de la serie. */
export function ahoraEnGuatemala(): string {
  const partes = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guatemala",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "00";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

export function condicionesActuales(serie: SerieParaAhora): CondicionesActuales {
  if (serie.tiempo.length === 0) {
    return { hora: null, temperaturaC: null, humedadPct: null, lluvia24hMm: null, esEstimacion: true };
  }
  const i = indiceDeAhora(serie.tiempo, ahoraEnGuatemala());

  const ventana = serie.precipitacion.slice(i, i + 24).filter((x): x is number => x != null);
  const lluvia = ventana.length > 0
    ? Math.round(ventana.reduce((a, b) => a + b, 0) * 10) / 10
    : null;

  return {
    hora: serie.tiempo[i] ?? null,
    temperaturaC: serie.temperatura[i] ?? null,
    humedadPct: serie.humedadRelativa[i] ?? null,
    lluvia24hMm: lluvia,
    esEstimacion: true,
  };
}
