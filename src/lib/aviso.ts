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
}): Aviso {
  const { nombreParcela, ventana, dias, eventos } = opciones;
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

  return {
    titular:
      `${ventana.nivel === "muy_favorable" ? "Riesgo muy favorable" : "Riesgo favorable"} ` +
      `${cuando} · aplicar antes del ${diaSemana(ventana.aplicarAntesDe)} ${fechaLarga(ventana.aplicarAntesDe)}`,
    texto:
      `${nombreParcela}: ${cuando} se juntan las condiciones de infeccion de roya en tu parcela. ` +
      `Aplica antes del ${diaSemana(ventana.aplicarAntesDe)} ${fechaLarga(ventana.aplicarAntesDe)}. ` +
      `${horas}${lavado} ` +
      `Si esperas a ver las manchas ya perdiste: de una infeccion de estos dias las manchas ` +
      `se verian entre el ${fechaLarga(ventana.sintomasVisiblesDesde)} y el ` +
      `${fechaLarga(ventana.sintomasVisiblesHasta)}. ` +
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
