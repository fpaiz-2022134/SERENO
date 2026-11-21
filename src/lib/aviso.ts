/**
 * Redaccion del aviso en espanol llano.
 *
 * REGLA DEL PROYECTO: el riesgo lo decide el motor, no un modelo de lenguaje.
 * Esta funcion arma la frase con PLANTILLAS deterministas a partir de los
 * numeros que ya calculo el motor. No llama a ninguna IA.
 *
 * Si mas adelante se le pasa este texto a un modelo para que lo reescriba mas
 * natural, el contrato es: el modelo puede cambiar las PALABRAS, nunca los
 * NUMEROS ni las FECHAS. Si la IA falla, este texto sigue siendo correcto y
 * suficiente para enviar por WhatsApp.
 */

import type { EventoInfeccion, RiesgoDiario, VentanaAccion } from "@/lib/motor/tipos";

const DIAS_SEMANA = [
  "domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado",
];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function diaSemana(dia: string): string {
  return DIAS_SEMANA[new Date(`${dia}T00:00:00Z`).getUTCDay()];
}

export function fechaLarga(dia: string): string {
  const d = new Date(`${dia}T00:00:00Z`);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** Dias de calendario entre dos fechas YYYY-MM-DD. Negativo si `hasta` es antes. */
export function diasEntreFechas(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/* ------------------------------------------------------------------ *
 * EN QUE MOMENTO DE LA VENTANA ESTAMOS
 *
 * El motor devuelve `aplicarAntesDe` = el dia ANTERIOR al inicio de la
 * ventana. Es correcto como aritmetica, pero la ventana se busca a partir de
 * hoy: si hoy ya hay riesgo, el inicio es hoy y esa fecha limite cae AYER.
 *
 * Decirle a un productor "aplique antes del viernes 20" un sabado 21 es
 * informarle de lo que ya no hizo. No sirve para decidir nada.
 *
 * Por eso la fase se decide aqui, UNA sola vez, y la usan tanto el texto que
 * va por WhatsApp como las pantallas. Si cada uno lo calculara por su lado
 * terminarian diciendo cosas distintas el mismo dia.
 * ------------------------------------------------------------------ */

export type Fase = "por_venir" | "abierta" | "vencida";

export interface FaseVentana {
  fase: Fase;
  /** Dias de aqui a la fecha limite. Solo en "por_venir", y es >= 0. */
  diasHastaLimite: number | null;
  /** Dias de ventana que quedan contando hoy. Solo en "abierta", y es >= 1. */
  diasQueQuedan: number | null;
}

/**
 * OJO con el `hoy` que se le pasa: en el servidor es el dia del pronostico,
 * pero en la pantalla tiene que ser el dia REAL. Un reporte guardado hace
 * tres dias trae su propio `hoy` viejo, y es justo ese caso el que hace falta
 * detectar para no mostrar fechas vencidas como si fueran de ahora.
 */
export function faseDeVentana(
  ventana: Pick<VentanaAccion, "inicio" | "fin" | "aplicarAntesDe">,
  hoy: string,
): FaseVentana {
  if (ventana.fin < hoy) {
    return { fase: "vencida", diasHastaLimite: null, diasQueQuedan: null };
  }
  if (ventana.inicio > hoy) {
    return {
      fase: "por_venir",
      diasHastaLimite: Math.max(0, diasEntreFechas(hoy, ventana.aplicarAntesDe)),
      diasQueQuedan: null,
    };
  }
  return {
    fase: "abierta",
    diasHastaLimite: null,
    // Contando hoy: si la ventana termina hoy, queda 1 dia (el de hoy).
    diasQueQuedan: Math.max(1, diasEntreFechas(hoy, ventana.fin) + 1),
  };
}

export interface Aviso {
  /** El mensaje listo para WhatsApp. */
  texto: string;
  /** Una linea para el encabezado del panel. */
  titular: string;
  /** Los numeros en que se basa el texto, para poder auditarlo. */
  soporte: {
    ventana: VentanaAccion | null;
    horasMojadas: number | null;
    horasRequeridas: number | null;
    indiceMaximo: number | null;
    eventosConfirmados: number;
  };
}

export function redactarAviso(opciones: {
  nombreParcela: string;
  ventana: VentanaAccion | null;
  dias: RiesgoDiario[];
  eventos: EventoInfeccion[];
  /** El dia de hoy. Si no viene, se toma el primer dia del pronostico. */
  hoy?: string;
}): Aviso {
  const { nombreParcela, ventana, dias, eventos } = opciones;
  const hoy = opciones.hoy ?? dias[0]?.dia ?? "";
  const confirmados = eventos.filter((e) => e.esEvento);

  if (!ventana) {
    const maximo = dias.length > 0 ? Math.max(...dias.map((d) => d.indice)) : 0;
    return {
      titular: "Sin ventana de infeccion en el pronostico",
      texto:
        `${nombreParcela}: en los proximos ${dias.length} dias el pronostico no junta ` +
        `condiciones de infeccion de roya. Indice maximo ${maximo.toFixed(2)} de 1. ` +
        `No hace falta aplicar por este motivo. Seguimos mirando.`,
      soporte: {
        ventana: null,
        horasMojadas: null,
        horasRequeridas: null,
        indiceMaximo: maximo,
        eventosConfirmados: confirmados.length,
      },
    };
  }

  const diasVentana = dias.filter((d) => d.dia >= ventana.inicio && d.dia <= ventana.fin);
  const pico = diasVentana.reduce((a, b) => (b.indice > a.indice ? b : a), diasVentana[0]);

  const cuando =
    ventana.inicio === ventana.fin
      ? `el ${diaSemana(ventana.inicio)} ${fechaLarga(ventana.inicio)}`
      : `del ${diaSemana(ventana.inicio)} ${fechaLarga(ventana.inicio)} al ` +
        `${diaSemana(ventana.fin)} ${fechaLarga(ventana.fin)}`;

  const horas = Number.isFinite(pico.horasRequeridas)
    ? `Se juntan ${pico.horasMojadas} horas de hoja mojada y hacen falta ` +
      `${Math.round(pico.horasRequeridas)} a ${pico.temperaturaMedia ?? "?"} grados.`
    : "";

  const lavado = diasVentana.some((d) => d.lavadoPorLluvia)
    ? " Ojo: hay dias de lluvia fuerte, que lava la espora y baja el riesgo; el numero ya lo toma en cuenta."
    : "";

  // La banda, con las palabras del propio motor. Antes decia siempre "se
  // juntan las condiciones", incluso cuando el mismo mensaje admitia que
  // faltaban horas para el umbral. "Favorable" no es "ya paso".
  const banda =
    ventana.nivel === "muy_favorable"
      ? "MUY FAVORABLES a la infeccion de roya"
      : "FAVORABLES a la infeccion de roya";

  const consecuencia =
    `Si esperas a ver las manchas ya perdiste: de una infeccion de estos dias las manchas ` +
    `se verian entre el ${fechaLarga(ventana.sintomasVisiblesDesde)} y el ` +
    `${fechaLarga(ventana.sintomasVisiblesHasta)}. ` +
    `Esto es apoyo a la decision, no un agronomo: la ultima palabra es tuya.`;

  const { fase, diasQueQuedan } = faseDeVentana(ventana, hoy);
  const limite = `${diaSemana(ventana.aplicarAntesDe)} ${fechaLarga(ventana.aplicarAntesDe)}`;
  const finLargo = `${diaSemana(ventana.fin)} ${fechaLarga(ventana.fin)}`;

  let titular: string;
  let accion: string;

  if (fase === "vencida") {
    // Pasa con un reporte guardado que ya tiene dias. No se enseña una fecha
    // limite de la semana pasada: se dice que el reporte caduco.
    titular = `Este reporte vencio: la ventana termino el ${finLargo}`;
    accion =
      `${nombreParcela}: la ventana de riesgo que traia este reporte termino el ${finLargo}, ` +
      `asi que ya no sirve para decidir. Conectate para bajar el pronostico de hoy. `;
    return {
      titular,
      // Sin la frase de los sintomas: sus fechas salen de una ventana que ya
      // vencio, y repetirlas aqui seria dar por buenas unas fechas viejas.
      texto:
        accion +
        `Esto es apoyo a la decision, no un agronomo: la ultima palabra es tuya.`,
      soporte: {
        ventana,
        horasMojadas: pico.horasMojadas,
        horasRequeridas: Number.isFinite(pico.horasRequeridas) ? pico.horasRequeridas : null,
        indiceMaximo: ventana.indiceMaximo,
        eventosConfirmados: confirmados.length,
      },
    };
  }

  if (fase === "por_venir") {
    // El unico caso donde "antes de" significa algo: la fecha esta adelante.
    titular = `Condiciones ${banda} ${cuando} · aplicar antes del ${limite}`;
    accion =
      `${nombreParcela}: ${cuando} las condiciones son ${banda} en tu parcela. ` +
      `Aplica antes del ${limite}. `;
  } else if (diasQueQuedan === 1) {
    titular = `Condiciones ${banda} · hoy es el ultimo dia de la ventana`;
    accion =
      `${nombreParcela}: HOY es el ultimo dia de la ventana en que las condiciones son ` +
      `${banda} en tu parcela. Si vas a actuar, habla hoy con tu tecnico. `;
  } else {
    // Ventana abierta: lo util no es una fecha pasada, sino hasta cuando dura.
    //
    // OJO: aqui NO se dice que aplicar hoy "cubre" o "protege" los dias que
    // faltan. Eso seria una afirmacion sobre la EFICACIA del fungicida —
    // cuantos dias dura una aplicacion— y este motor no calcula eso, no lo
    // tenemos en ninguna fuente, y contradice el aviso de que no es una
    // recomendacion automatica de aplicar. Lo que si es cierto y util: hasta
    // cuando dura la ventana, y que ya no hay dias de anticipacion que ganar.
    titular = `Condiciones ${banda} · ventana abierta hasta el ${finLargo}`;
    accion =
      `${nombreParcela}: la ventana en que las condiciones son ${banda} en tu parcela ` +
      `YA ESTA ABIERTA y va hasta el ${finLargo}; quedan ${diasQueQuedan} dias. ` +
      `Ya no hay dias de anticipacion que ganar: si vas a actuar, habla hoy con tu tecnico. `;
  }

  return {
    titular,
    texto: `${accion}${horas}${lavado} ${consecuencia}`,
    soporte: {
      ventana,
      horasMojadas: pico.horasMojadas,
      horasRequeridas: Number.isFinite(pico.horasRequeridas) ? pico.horasRequeridas : null,
      indiceMaximo: ventana.indiceMaximo,
      eventosConfirmados: confirmados.length,
    },
  };
}
