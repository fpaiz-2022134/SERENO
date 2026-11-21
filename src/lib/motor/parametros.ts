/**
 * Tabla de parametros del motor de riesgo, por cultivo/patogeno.
 *
 * ESTA ES LA UNICA TABLA QUE HAY QUE CAMBIAR PARA AGREGAR UN CULTIVO.
 * El motor (`src/lib/motor/riesgo.ts`) no contiene ningun numero: todo sale de aqui.
 *
 * Cada valor lleva su fuente. Ver SERENO-investigacion.md §1 para los enlaces
 * completos y los huecos declarados.
 */

export interface ParametrosPatogeno {
  /** Identificador estable, se usa en la base de datos. */
  readonly id: string;
  readonly cultivo: string;
  readonly patogeno: string;
  readonly nombreComun: string;

  // --- Respuesta a temperatura (cardinales de la beta de Magarey et al. 2005) ---
  /** Temperatura minima de infeccion (°C). f(T) = 0 en T <= tMin. */
  readonly tMin: number;
  /** Temperatura optima de infeccion (°C). f(tOpt) = 1. */
  readonly tOpt: number;
  /** Temperatura maxima de infeccion (°C). f(T) = 0 en T >= tMax. */
  readonly tMax: number;

  // --- Horas de mojado foliar ---
  /** Horas minimas de agua libre para que haya infeccion, a la temperatura optima. */
  readonly wMin: number;
  /** Tope de horas de mojado requeridas: W(T) nunca pide mas que esto. */
  readonly wMax: number;

  // --- Estimacion de mojado foliar sin sensor ---
  /** Humedad relativa (%) a partir de la cual se cuenta la hora como mojada. */
  readonly hrMojado: number;
  /** Lluvia (mm en la hora) a partir de la cual se cuenta la hora como mojada. */
  readonly lluviaMojado: number;

  // --- Lluvia: lavado de esporas y optimo de infeccion ---
  /**
   * Lluvia diaria (mm) por encima de la cual la lluvia LAVA las esporas al suelo
   * y REDUCE el riesgo. H. vastatrix es parasito obligado: la espora que cae al
   * suelo se pierde.
   */
  readonly lluviaLavadoDia: number;
  /** Lluvia diaria (mm) por encima de la cual el dia es optimo para infeccion. */
  readonly lluviaOptimaDia: number;
  /**
   * Factor que multiplica el indice de un evento cuyo dia excedio lluviaLavadoDia.
   * 0 = el evento se descarta por completo; 1 = la lluvia no afecta.
   */
  readonly factorLavado: number;

  // --- Incubacion ---
  /** Dias minimos de infeccion a sintoma visible. */
  readonly incubacionMinDias: number;
  /** Dias maximos de infeccion a sintoma visible. */
  readonly incubacionMaxDias: number;

  /** Umbral de incidencia en campo (% de plantas) a partir del cual la literatura recomienda avisar. */
  readonly incidenciaAvisoPct: number;

  /** Procedencia de cada numero, para mostrarla en la UI y en el pitch. */
  readonly fuentes: Readonly<Record<string, string>>;
}

/**
 * Roya del cafe · Hemileia vastatrix
 *
 * HUECO DECLARADO (SERENO-investigacion.md §1.4 y §6.1): no pudimos abrir la
 * Tabla 2 de Magarey et al. 2005, asi que NO podemos confirmar que H. vastatrix
 * aparezca ahi con valores oficiales de Wmin/Wmax. Estos parametros son un
 * ensamblado nuestro a partir de literatura primaria (APS para los cardinales,
 * Kushalappa 1983 via Pozza 2021 para Wmin). Decirlo asi: "parametros de
 * literatura primaria, no de una tabla unica".
 */
export const ROYA_CAFE: ParametrosPatogeno = {
  id: "roya-cafe",
  cultivo: "cafe",
  patogeno: "Hemileia vastatrix",
  nombreComun: "roya del cafe",

  tMin: 15,
  tOpt: 22,
  tMax: 28,

  wMin: 6,
  wMax: 48,

  hrMojado: 90,
  lluviaMojado: 0.2,

  lluviaLavadoDia: 10,
  lluviaOptimaDia: 5,
  factorLavado: 0.5,

  incubacionMinDias: 25,
  incubacionMaxDias: 30,

  incidenciaAvisoPct: 5,

  fuentes: {
    tMin: "APS, Coffee rust — https://www.apsnet.org/edcenter/disandpath/fungalbasidio/pdlessons/Pages/CoffeeRust.aspx",
    tOpt: "APS, Coffee rust (idem)",
    tMax: "APS, Coffee rust (idem)",
    wMin: "Kushalappa, Akutsu & Ludwing 1983, Phytopathology 73:96, citado en Pozza et al. 2021 §4 — https://doi.org/10.3390/agronomy11112284",
    wMax: "APS: el proceso completo de infeccion requiere 24-48 h de humedad libre",
    hrMojado: "Sentelhas et al. 2008, Agric. For. Meteorol. 148:392-400 — https://doi.org/10.1016/j.agrformet.2007.09.011 (umbral HR>=90% tambien en SENAMHI)",
    lluviaMojado: "HUECO DECLARADO: criterio de implementacion nuestro (limite de deteccion tipico de pluviometro), NO parametro de literatura",
    lluviaLavadoDia: "ExpeRoya A1/P1, Motisi et al. 2021 — https://agritrop.cirad.fr/600136/7/600136_MAA.pdf ; SENAMHI pone 'Lluvias < 10 mm' como condicion favorable",
    lluviaOptimaDia: "ExpeRoya A1/P2 (idem): el optimo de infeccion son dias con > 5 mm",
    factorLavado: "HUECO DECLARADO: la direccion del efecto (lluvia fuerte reduce riesgo) esta en ExpeRoya; la MAGNITUD del castigo (0.5) es criterio nuestro, no esta en la fuente",
    incubacion: "Pozza et al. 2021 §4, citando Alfonsi et al. y Kushalappa & Martins: 25-30 dias",
    incidenciaAvisoPct: "Pozza et al. 2021, citando Kushalappa et al. 1984: avisar al 5 % de incidencia",
    modelo: "Magarey, Sutton & Thayer (2005) A Simple Generic Infection Model for Foliar Fungal Plant Pathogens, Phytopathology 95(1):92-100 — https://doi.org/10.1094/PHYTO-95-0092",
  },
} as const;

/**
 * Broca del cafe · Hypothenemus hampei — PREPARADO, NO VALIDADO.
 *
 * La feature #2 del mapa es "broca: mismo motor, otros umbrales". La estructura
 * esta lista, pero NO tenemos los cardinales de broca verificados en fuente
 * primaria, asi que este patogeno queda DESHABILITADO: el motor se niega a
 * correr con parametros marcados como no validados.
 */
export const PATOGENOS_NO_VALIDADOS = ["broca-cafe"] as const;

export const PATOGENOS: Readonly<Record<string, ParametrosPatogeno>> = {
  [ROYA_CAFE.id]: ROYA_CAFE,
} as const;

export function obtenerParametros(id: string): ParametrosPatogeno {
  const p = PATOGENOS[id];
  if (!p) {
    throw new Error(
      `Patogeno "${id}" no esta en la tabla de parametros. Disponibles: ${Object.keys(PATOGENOS).join(", ")}`,
    );
  }
  return p;
}

/** Bandas del semaforo, tal como las publica el SENAMHI de Peru. */
export const BANDAS_RIESGO = [
  { max: 0.5, nivel: "poco_favorable", etiqueta: "Poco favorable" },
  { max: 0.75, nivel: "favorable", etiqueta: "Favorable" },
  { max: Infinity, nivel: "muy_favorable", etiqueta: "Muy favorable" },
] as const;

export type NivelRiesgo = (typeof BANDAS_RIESGO)[number]["nivel"];

export function bandaDeIndice(indice: number): { nivel: NivelRiesgo; etiqueta: string } {
  const b = BANDAS_RIESGO.find((x) => indice < x.max) ?? BANDAS_RIESGO[BANDAS_RIESGO.length - 1];
  return { nivel: b.nivel, etiqueta: b.etiqueta };
}
