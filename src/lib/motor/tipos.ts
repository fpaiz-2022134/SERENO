/** Tipos del motor de riesgo. Ninguno depende de la fuente de datos. */

/**
 * Serie meteorologica horaria normalizada.
 * Todos los arreglos tienen la misma longitud; `null` = dato faltante.
 */
export interface SerieHoraria {
  /** Hora LOCAL en ISO sin zona, p. ej. "2012-05-16T03:00". Una por paso. */
  tiempo: string[];
  /** Temperatura del aire a 2 m, °C. */
  temperatura: (number | null)[];
  /** Humedad relativa a 2 m, %. */
  humedadRelativa: (number | null)[];
  /** Precipitacion acumulada en la hora, mm. */
  precipitacion: (number | null)[];
  /** Punto de rocio a 2 m, °C. Opcional: no todas las fuentes lo dan. */
  puntoRocio?: (number | null)[];
  /** Procedencia del dato, se arrastra hasta la UI. */
  procedencia: Procedencia;
}

export interface Procedencia {
  /** Nombre de la fuente, p. ej. "Open-Meteo (archive-api)". */
  fuente: string;
  /** URL exacta que se consulto. */
  url: string;
  /** Cuando se publico / a que corresponde el dato (ISO). */
  fechaPublicacion: string | null;
  /** Cuando lo consultamos nosotros (ISO). */
  ultimaConsulta: string;
  /** true si son datos de pronostico; false si son historicos. NUNCA mezclar en la UI. */
  esPronostico: boolean;
  /** Metros sobre el nivel del mar del punto que devolvio la fuente, si lo da. */
  altitudMetros?: number | null;
  /** Avisos que deben mostrarse junto al dato (dato viejo, celda fria, etc.). */
  avisos?: string[];
}

/** Una racha de horas mojadas consecutivas, evaluada contra Magarey. */
export interface EventoInfeccion {
  /** Hora local en que empezo la racha. */
  inicio: string;
  /** Hora local de la ultima hora mojada de la racha. */
  fin: string;
  /** Dia (YYYY-MM-DD) al que se le atribuye el evento: el del inicio de la racha. */
  dia: string;
  /** Horas mojadas consecutivas acumuladas. */
  horasMojadas: number;
  /** Temperatura media de la racha, °C. */
  temperaturaMedia: number;
  /** Horas de mojado que Magarey exige a esa temperatura. Infinity si T esta fuera del rango. */
  horasRequeridas: number;
  /** Indice 0-1 ya ajustado por lluvia. */
  indice: number;
  /** Banda del semaforo (bandas del SENAMHI). */
  nivel: string;
  etiqueta: string;
  /** true si la racha alcanzo el umbral aritmetico de Magarey. */
  alcanzoUmbral: boolean;
  /** true si la lluvia del dia paso el umbral de lavado de esporas. */
  lavadoPorLluvia: boolean;
  /** true si la lluvia del dia cayo en el rango optimo de infeccion. */
  lluviaOptima: boolean;
  /** Maxima lluvia diaria (mm) entre los dias que toca la racha. */
  lluviaDiariaMaxMm: number;
  /** true = evento de infeccion: alcanzo el umbral Y no hubo lavado. */
  esEvento: boolean;
  /** Si hoy hay infeccion, los sintomas se verian entre estas dos fechas. */
  sintomasVisiblesDesde: string;
  sintomasVisiblesHasta: string;
}

/** Resumen por dia, para la curva del panel climatico. */
export interface RiesgoDiario {
  dia: string;
  /** Indice 0-1 del dia: el mayor de las rachas que lo tocan. */
  indice: number;
  nivel: string;
  etiqueta: string;
  /** Horas mojadas acumuladas que se le atribuyen al dia. */
  horasMojadas: number;
  /** Horas requeridas de la racha que manda en el dia. Infinity si no hay racha util. */
  horasRequeridas: number;
  /** Temperatura media del dia, °C. */
  temperaturaMedia: number | null;
  /** Lluvia total del dia, mm. */
  lluviaMm: number;
  /** true si ese dia se cerro un evento de infeccion. */
  hayEvento: boolean;
  lavadoPorLluvia: boolean;
}

/** La salida que de verdad usa el productor. */
export interface VentanaAccion {
  /** Primer dia de la ventana (YYYY-MM-DD). */
  inicio: string;
  /** Ultimo dia de la ventana. */
  fin: string;
  /** La fecha limite para aplicar: el dia anterior al inicio de la ventana. */
  aplicarAntesDe: string;
  /** Indice maximo dentro de la ventana. */
  indiceMaximo: number;
  nivel: string;
  /** true si dentro de la ventana hay al menos un evento de infeccion confirmado por el motor. */
  contieneEvento: boolean;
  /** Si hoy hay infeccion, cuando se verian las manchas. */
  sintomasVisiblesDesde: string;
  sintomasVisiblesHasta: string;
}
