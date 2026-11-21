/** Fechas en español llano. Todo en hora de Guatemala. */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Un "YYYY-MM-DD" se lee como fecha de calendario, sin que la zona lo corra un día. */
function deDia(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

export function diaSemana(dia: string): string {
  return DIAS[deDia(dia).getUTCDay()];
}

export function diaSemanaCorto(dia: string): string {
  return DIAS_CORTOS[deDia(dia).getUTCDay()];
}

/** "jue 26 nov" — lo que usa la tarjeta de riesgo del branding. */
export function fechaCorta(dia: string): string {
  const d = deDia(dia);
  return `${DIAS_CORTOS[d.getUTCDay()]} ${d.getUTCDate()} ${MESES_CORTOS[d.getUTCMonth()]}`;
}

/** "26 de noviembre". */
export function fechaLarga(dia: string): string {
  const d = deDia(dia);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "sábado 21 de noviembre". */
export function fechaCompleta(dia: string): string {
  return `${diaSemana(dia)} ${fechaLarga(dia)}`;
}

/**
 * "sáb 21 nov, 11:30" — el formato exacto que pide la lámina para el estado
 * sin conexión: el último reporte SIEMPRE con su fecha.
 */
export function marcaDeTiempo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "fecha desconocida";
  const f = new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const v = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  const dia = v("weekday").replace(".", "");
  const mes = v("month").replace(".", "");
  return `${dia} ${v("day")} ${mes}, ${v("hour")}:${v("minute")}`;
}

/** Solo la hora: "11:30". */
export function soloHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** "Sábado 21 de noviembre", para el saludo. */
export function fechaDeHoy(dia: string): string {
  const t = fechaCompleta(dia);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * El dia de hoy en Guatemala, en formato YYYY-MM-DD.
 *
 * Hace falta el dia REAL, no el `hoy` que trae el reporte: un reporte
 * guardado en el telefono hace tres dias sigue diciendo que su `hoy` es el de
 * hace tres dias. Comparar la ventana contra esa fecha vieja es justo lo que
 * hace que se enseñen plazos vencidos como si fueran de ahora.
 *
 * Se fuerza la zona de Guatemala y no la del aparato: el productor puede
 * tener el telefono mal configurado, y la parcela sigue estando donde esta.
 */
export function hoyEnGuatemala(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
