/**
 * MOTOR DE RIESGO DE SERENO — determinista.
 *
 * Aritmetica sobre series meteorologicas horarias. NINGUN modelo de lenguaje
 * participa en el calculo del riesgo. La IA solo redacta el aviso a partir de
 * estos numeros (ver src/lib/aviso.ts).
 *
 * Modelo: Magarey, Sutton & Thayer (2005), "A Simple Generic Infection Model
 * for Foliar Fungal Plant Pathogens", Phytopathology 95(1):92-100,
 * DOI 10.1094/PHYTO-95-0092. Ecuaciones verificadas contra R4PDE §21.2.1.4 y
 * el codigo del paquete R ZeBook (funcion magarey.model).
 *
 * ================================ ADVERTENCIA ================================
 * El conteo de eventos NO distingue el ano del brote. Verificado en la misma
 * coordenada de Huehuetenango (15.32, -91.47): 2010 -> 34 eventos, 2011 -> 18,
 * 2012 (ano de la emergencia nacional) -> 12, 2013 -> 23. El ano del brote es el
 * que MENOS eventos tiene.
 *
 * El clima por si solo no explica un brote: hace falta el inoculo, la variedad,
 * la sombra, la poda y la carga de fruto. Eso lo reporta el productor (los 10
 * datos de SERENO-investigacion.md §0B, atributos de ExpeRoya). El propio
 * SENAMHI advierte que su indice vale "asumiendo que hay suficiente inoculo".
 *
 * Por eso ESTE MOTOR NO PREDICE BROTES. Predice ventanas en que las condiciones
 * meteorologicas son favorables a la infeccion. No escribir copy ni comentarios
 * que afirmen otra cosa.
 * =============================================================================
 */

import {
  ROYA_CAFE,
  bandaDeIndice,
  type ParametrosPatogeno,
} from "./parametros";
import type {
  EventoInfeccion,
  RiesgoDiario,
  SerieHoraria,
  VentanaAccion,
} from "./tipos";

/* ------------------------------------------------------------------ *
 * 1 · Las dos ecuaciones de Magarey
 * ------------------------------------------------------------------ */

/**
 * Respuesta a temperatura: funcion beta de Yin et al. 1995 (eq. 8b, beta = 1),
 * tal como la usa Magarey et al. 2005.
 *
 *   f(T) = ((Tmax-T)/(Tmax-Topt)) * ((T-Tmin)/(Topt-Tmin))^((Topt-Tmin)/(Tmax-Topt))
 *
 * f(Topt) = 1 y f(T) = 0 fuera de [Tmin, Tmax].
 */
export function respuestaTemperatura(
  t: number,
  p: ParametrosPatogeno = ROYA_CAFE,
): number {
  if (!Number.isFinite(t)) return 0;
  if (t <= p.tMin || t >= p.tMax) return 0;
  const rama = (p.tMax - t) / (p.tMax - p.tOpt);
  const base = (t - p.tMin) / (p.tOpt - p.tMin);
  const exponente = (p.tOpt - p.tMin) / (p.tMax - p.tOpt);
  return rama * Math.pow(base, exponente);
}

/**
 * Horas de mojado foliar requeridas a esa temperatura:
 *
 *   W(T) = min( Wmin / f(T) , Wmax )
 *
 * Devuelve Infinity si f(T) = 0 (temperatura fuera del rango de infeccion):
 * ninguna cantidad de mojado produce infeccion a esa temperatura.
 */
export function horasMojadoRequeridas(
  t: number,
  p: ParametrosPatogeno = ROYA_CAFE,
): number {
  const f = respuestaTemperatura(t, p);
  if (f <= 0) return Infinity;
  return Math.min(p.wMin / f, p.wMax);
}

/* ------------------------------------------------------------------ *
 * 2 · Mojado foliar estimado sin sensor
 * ------------------------------------------------------------------ */

/**
 * Una hora cuenta como MOJADA si HR >= hrMojado O llovio >= lluviaMojado.
 *
 * El "o" es deliberado: APS es explicito en que las urediniosporas germinan solo
 * en presencia de AGUA LIBRE (lluvia o rocio abundante), no con humedad alta
 * sola. La HR alta es el proxy del rocio; la lluvia es agua libre directa.
 */
export function esHoraMojada(
  humedadRelativa: number | null,
  precipitacionMm: number | null,
  p: ParametrosPatogeno = ROYA_CAFE,
): boolean {
  const hr = humedadRelativa ?? -Infinity;
  const mm = precipitacionMm ?? 0;
  return hr >= p.hrMojado || mm >= p.lluviaMojado;
}

/** Variante por deficit de punto de rocio (DPD), para comparar: mojada si (T - Trocio) <= 2 °C. */
export function esHoraMojadaPorRocio(
  temperatura: number | null,
  puntoRocio: number | null,
  umbralDpd = 2,
): boolean {
  if (temperatura == null || puntoRocio == null) return false;
  return temperatura - puntoRocio <= umbralDpd;
}

/* ------------------------------------------------------------------ *
 * 3 · Lluvia por dia (lavado de esporas / optimo de infeccion)
 * ------------------------------------------------------------------ */

/** Suma la precipitacion horaria por dia local. Devuelve mm por YYYY-MM-DD. */
export function lluviaPorDia(serie: SerieHoraria): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 0; i < serie.tiempo.length; i++) {
    const dia = diaDe(serie.tiempo[i]);
    out.set(dia, (out.get(dia) ?? 0) + (serie.precipitacion[i] ?? 0));
  }
  return out;
}

function diaDe(iso: string): string {
  return iso.slice(0, 10);
}

/* ------------------------------------------------------------------ *
 * 4 · Deteccion de eventos de infeccion
 * ------------------------------------------------------------------ */

interface Racha {
  indiceInicio: number;
  horas: number;
  temperaturas: number[];
}

/**
 * Recorre la serie, arma rachas de horas mojadas consecutivas y evalua cada una
 * contra W(T media de la racha).
 *
 * Reglas, en orden:
 *   1. `alcanzoUmbral` = horasMojadas >= W(T media)  ← la condicion de Magarey
 *   2. `lavadoPorLluvia` = algun dia que toca la racha paso lluviaLavadoDia
 *   3. `indice` = min(1, horas/W) * (lavado ? factorLavado : 1)
 *   4. `esEvento` = alcanzoUmbral Y NO hubo lavado
 *
 * El paso 2-4 es la correccion que el prototipo en Python no tenia: sin ella el
 * motor sobreestima el riesgo en tormenta, porque un aguacero produce muchas
 * horas mojadas a la vez que se lleva las esporas al suelo.
 */
export function detectarEventos(
  serie: SerieHoraria,
  p: ParametrosPatogeno = ROYA_CAFE,
): EventoInfeccion[] {
  const lluviaDia = lluviaPorDia(serie);
  const eventos: EventoInfeccion[] = [];
  let racha: Racha | null = null;

  const cerrar = () => {
    if (racha && racha.horas > 0) {
      const ev = evaluarRacha(racha, serie, lluviaDia, p);
      if (ev) eventos.push(ev);
    }
    racha = null;
  };

  for (let i = 0; i < serie.tiempo.length; i++) {
    const t = serie.temperatura[i];
    const hr = serie.humedadRelativa[i];
    // Sin temperatura no se puede evaluar Magarey: la hora rompe la racha.
    if (t == null) {
      cerrar();
      continue;
    }
    if (esHoraMojada(hr, serie.precipitacion[i], p)) {
      if (!racha) racha = { indiceInicio: i, horas: 0, temperaturas: [] };
      racha.horas += 1;
      racha.temperaturas.push(t);
    } else {
      cerrar();
    }
  }
  cerrar();
  return eventos;
}

function evaluarRacha(
  racha: Racha,
  serie: SerieHoraria,
  lluviaDia: Map<string, number>,
  p: ParametrosPatogeno,
): EventoInfeccion | null {
  const tMedia =
    racha.temperaturas.reduce((a, b) => a + b, 0) / racha.temperaturas.length;
  const requeridas = horasMojadoRequeridas(tMedia, p);
  const inicio = serie.tiempo[racha.indiceInicio];
  const fin = serie.tiempo[racha.indiceInicio + racha.horas - 1];

  // Lluvia maxima entre los dias que toca la racha.
  let lluviaMax = 0;
  for (let i = racha.indiceInicio; i < racha.indiceInicio + racha.horas; i++) {
    lluviaMax = Math.max(lluviaMax, lluviaDia.get(diaDe(serie.tiempo[i])) ?? 0);
  }

  const alcanzoUmbral = Number.isFinite(requeridas) && racha.horas >= requeridas;
  const lavado = lluviaMax > p.lluviaLavadoDia;
  const lluviaOptima = !lavado && lluviaMax > p.lluviaOptimaDia;

  const bruto = Number.isFinite(requeridas)
    ? Math.min(1, racha.horas / requeridas)
    : 0;
  const indice = redondear(bruto * (lavado ? p.factorLavado : 1));
  const banda = bandaDeIndice(indice);
  const dia = diaDe(inicio);

  // Solo reportamos rachas que llegaron a algo: las que no mueven el semaforo
  // se descartan para no inundar la salida.
  if (indice <= 0) return null;

  return {
    inicio,
    fin,
    dia,
    horasMojadas: racha.horas,
    temperaturaMedia: redondear(tMedia),
    horasRequeridas: Number.isFinite(requeridas) ? redondear(requeridas) : Infinity,
    indice,
    nivel: banda.nivel,
    etiqueta: banda.etiqueta,
    alcanzoUmbral,
    lavadoPorLluvia: lavado,
    lluviaOptima,
    lluviaDiariaMaxMm: redondear(lluviaMax),
    esEvento: alcanzoUmbral && !lavado,
    sintomasVisiblesDesde: sumarDias(dia, p.incubacionMinDias),
    sintomasVisiblesHasta: sumarDias(dia, p.incubacionMaxDias),
  };
}

/* ------------------------------------------------------------------ *
 * 5 · Curva diaria y ventana de accion
 * ------------------------------------------------------------------ */

/** Indice por dia: el mayor de las rachas que tocan el dia. Para la curva de 10 dias. */
export function riesgoPorDia(
  serie: SerieHoraria,
  p: ParametrosPatogeno = ROYA_CAFE,
): RiesgoDiario[] {
  const eventos = detectarEventos(serie, p);
  const lluviaDia = lluviaPorDia(serie);

  const porDia = new Map<
    string,
    { temps: number[]; indice: number; horas: number; req: number; evento: boolean; lavado: boolean }
  >();

  for (let i = 0; i < serie.tiempo.length; i++) {
    const dia = diaDe(serie.tiempo[i]);
    const d =
      porDia.get(dia) ??
      { temps: [], indice: 0, horas: 0, req: Infinity, evento: false, lavado: false };
    const t = serie.temperatura[i];
    if (t != null) d.temps.push(t);
    porDia.set(dia, d);
  }

  // Cada racha pinta todos los dias que toca.
  for (const ev of eventos) {
    const diasTocados = diasEntre(diaDe(ev.inicio), diaDe(ev.fin));
    for (const dia of diasTocados) {
      const d = porDia.get(dia);
      if (!d) continue;
      if (ev.indice >= d.indice) {
        d.indice = ev.indice;
        d.horas = ev.horasMojadas;
        d.req = ev.horasRequeridas;
      }
      d.evento = d.evento || ev.esEvento;
      d.lavado = d.lavado || ev.lavadoPorLluvia;
    }
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dia, d]) => {
      const banda = bandaDeIndice(d.indice);
      return {
        dia,
        indice: d.indice,
        nivel: banda.nivel,
        etiqueta: banda.etiqueta,
        horasMojadas: d.horas,
        horasRequeridas: d.req,
        temperaturaMedia:
          d.temps.length > 0
            ? redondear(d.temps.reduce((a, b) => a + b, 0) / d.temps.length)
            : null,
        lluviaMm: redondear(lluviaDia.get(dia) ?? 0),
        hayEvento: d.evento,
        lavadoPorLluvia: d.lavado,
      };
    });
}

/**
 * La primera ventana de accion: la racha de dias consecutivos con indice >= 0.5
 * (banda "favorable" o mejor) a partir de `desdeDia`.
 *
 * `aplicarAntesDe` es el dia ANTERIOR al inicio: el fungicida tiene que estar
 * puesto antes de que las condiciones se junten, no despues.
 */
export function ventanaDeAccion(
  dias: RiesgoDiario[],
  p: ParametrosPatogeno = ROYA_CAFE,
  desdeDia?: string,
): VentanaAccion | null {
  const candidatos = desdeDia ? dias.filter((d) => d.dia >= desdeDia) : dias;
  let i = candidatos.findIndex((d) => d.indice >= 0.5);
  if (i < 0) return null;

  let j = i;
  while (j + 1 < candidatos.length && candidatos[j + 1].indice >= 0.5) j++;

  const tramo = candidatos.slice(i, j + 1);
  const indiceMaximo = Math.max(...tramo.map((d) => d.indice));
  const inicio = tramo[0].dia;

  return {
    inicio,
    fin: tramo[tramo.length - 1].dia,
    aplicarAntesDe: sumarDias(inicio, -1),
    indiceMaximo,
    nivel: bandaDeIndice(indiceMaximo).nivel,
    contieneEvento: tramo.some((d) => d.hayEvento),
    sintomasVisiblesDesde: sumarDias(inicio, p.incubacionMinDias),
    sintomasVisiblesHasta: sumarDias(inicio, p.incubacionMaxDias),
  };
}

/* ------------------------------------------------------------------ *
 * 6 · Incubacion y cobertura de aplicaciones
 * ------------------------------------------------------------------ */

/** Si hoy hay infeccion, entre que fechas se verian las manchas. */
export function fechaSintomas(
  diaInfeccion: string,
  p: ParametrosPatogeno = ROYA_CAFE,
): { desde: string; hasta: string } {
  return {
    desde: sumarDias(diaInfeccion, p.incubacionMinDias),
    hasta: sumarDias(diaInfeccion, p.incubacionMaxDias),
  };
}

/**
 * Dato 5 del dashboard: dias desde la ultima aplicacion y si el ultimo evento
 * quedo cubierto (la aplicacion fue ANTES o el mismo dia del evento).
 */
export function coberturaDeAplicacion(
  diaHoy: string,
  ultimaAplicacion: string | null,
  eventos: EventoInfeccion[],
): {
  diasDesdeUltimaAplicacion: number | null;
  ultimoEvento: string | null;
  ultimoEventoCubierto: boolean | null;
} {
  // Solo cuentan los eventos YA OCURRIDOS. Un evento del pronostico no se puede
  // haber "cubierto" con una aplicacion pasada, y presentarlo como tal seria
  // mezclar pronostico con historia.
  const confirmados = eventos.filter((e) => e.esEvento && e.dia <= diaHoy);
  const ultimoEvento =
    confirmados.length > 0 ? confirmados[confirmados.length - 1].dia : null;

  if (!ultimaAplicacion) {
    return { diasDesdeUltimaAplicacion: null, ultimoEvento, ultimoEventoCubierto: ultimoEvento ? false : null };
  }
  return {
    diasDesdeUltimaAplicacion: diferenciaDias(ultimaAplicacion, diaHoy),
    ultimoEvento,
    ultimoEventoCubierto: ultimoEvento ? ultimaAplicacion <= ultimoEvento : null,
  };
}

/* ------------------------------------------------------------------ *
 * Utilidades de fecha — aritmetica en UTC sobre YYYY-MM-DD, sin zonas.
 * ------------------------------------------------------------------ */

export function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function diferenciaDias(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = [];
  let d = desde;
  for (let i = 0; i < 400 && d <= hasta; i++) {
    out.push(d);
    d = sumarDias(d, 1);
  }
  return out;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}
