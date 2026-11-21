import { describe, expect, it } from "vitest";
import { faseDeVentana, redactarAviso } from "@/lib/aviso";
import type { EventoInfeccion, RiesgoDiario, VentanaAccion } from "@/lib/motor/tipos";

/**
 * EL BUG QUE ESTAS PRUEBAS IMPIDEN QUE VUELVA
 *
 * El motor calcula `aplicarAntesDe` como el dia ANTERIOR al inicio de la
 * ventana, y la ventana se busca a partir de hoy. O sea que si hoy ya hay
 * riesgo, la "fecha limite" cae AYER.
 *
 * En produccion, un sabado 21, el mensaje de WhatsApp decia literalmente
 * "Aplica antes del viernes 20 de noviembre": le informaba al productor de lo
 * que ya no hizo. No es un caso raro — en la coordenada del demo el indice
 * pasa de 0.5 casi todos los dias, asi que la ventana empieza hoy casi
 * siempre y la fecha limite es ayer casi siempre.
 */

function ventana(inicio: string, fin: string, aplicarAntesDe: string): VentanaAccion {
  return {
    inicio,
    fin,
    aplicarAntesDe,
    indiceMaximo: 0.8,
    nivel: "muy_favorable",
    contieneEvento: true,
    sintomasVisiblesDesde: "2026-12-16",
    sintomasVisiblesHasta: "2026-12-21",
  };
}

function dia(d: string, indice = 0.8): RiesgoDiario {
  return {
    dia: d,
    indice,
    nivel: "muy_favorable",
    etiqueta: "Muy favorable",
    horasMojadas: 8,
    horasRequeridas: 6,
    temperaturaMedia: 22,
    lluviaMm: 3,
    hayEvento: true,
    lavadoPorLluvia: false,
  };
}

const SIN_EVENTOS: EventoInfeccion[] = [];

describe("faseDeVentana", () => {
  it("la ventana que empieza manana esta por venir, y el plazo es positivo", () => {
    const f = faseDeVentana(ventana("2026-11-25", "2026-11-28", "2026-11-24"), "2026-11-21");
    expect(f.fase).toBe("por_venir");
    expect(f.diasHastaLimite).toBe(3);
  });

  it("si la fecha limite es hoy, el plazo es cero y no negativo", () => {
    const f = faseDeVentana(ventana("2026-11-22", "2026-11-25", "2026-11-21"), "2026-11-21");
    expect(f.fase).toBe("por_venir");
    expect(f.diasHastaLimite).toBe(0);
  });

  it("EL CASO DEL BUG: la ventana que empieza hoy esta ABIERTA, no por venir", () => {
    const f = faseDeVentana(ventana("2026-11-21", "2026-11-24", "2026-11-20"), "2026-11-21");
    expect(f.fase).toBe("abierta");
    // Contando hoy: 21, 22, 23 y 24.
    expect(f.diasQueQuedan).toBe(4);
    // Y nunca se expone un plazo, que es lo que salia en el pasado.
    expect(f.diasHastaLimite).toBeNull();
  });

  it("la ventana que termina hoy deja un dia: el de hoy", () => {
    const f = faseDeVentana(ventana("2026-11-21", "2026-11-21", "2026-11-20"), "2026-11-21");
    expect(f.fase).toBe("abierta");
    expect(f.diasQueQuedan).toBe(1);
  });

  it("una ventana que ya termino esta vencida (el reporte guardado sin conexion)", () => {
    const f = faseDeVentana(ventana("2026-11-10", "2026-11-14", "2026-11-09"), "2026-11-21");
    expect(f.fase).toBe("vencida");
    expect(f.diasQueQuedan).toBeNull();
    expect(f.diasHastaLimite).toBeNull();
  });
});

describe("redactarAviso: lo que se manda por WhatsApp", () => {
  it("NO dice 'aplica antes de' con una fecha que ya paso", () => {
    const v = ventana("2026-11-21", "2026-11-21", "2026-11-20");
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: v,
      dias: [dia("2026-11-21")],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    // La fecha de ayer no aparece ni en el titular ni en el mensaje.
    expect(a.texto).not.toContain("20 de noviembre");
    expect(a.titular).not.toContain("20 de noviembre");
    expect(a.texto.toLowerCase()).not.toContain("aplica antes del viernes");
  });

  it("con la ventana abierta dice hasta cuando dura y que aplicar hoy sirve", () => {
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: ventana("2026-11-21", "2026-11-24", "2026-11-20"),
      dias: [dia("2026-11-21"), dia("2026-11-22"), dia("2026-11-23"), dia("2026-11-24")],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    expect(a.texto).toContain("YA ESTA ABIERTA");
    expect(a.texto).toContain("24 de noviembre");
    expect(a.texto).toContain("quedan 4 dias");
    // Dice que actuar es hoy, pero NO promete que aplicar hoy "cubra" los
    // dias que faltan: de la eficacia del fungicida el motor no sabe nada.
    expect(a.texto).toContain("hoy");
    expect(a.texto).not.toContain("cubre");
    expect(a.texto).not.toContain("protege");
  });

  it("si la ventana termina hoy lo dice asi, sin inventar dias que no quedan", () => {
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: ventana("2026-11-21", "2026-11-21", "2026-11-20"),
      dias: [dia("2026-11-21")],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    expect(a.texto).toContain("HOY es el ultimo dia");
    expect(a.titular).toContain("ultimo dia");
  });

  it("si la ventana esta por venir SI conserva la fecha limite: ahi si sirve", () => {
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: ventana("2026-11-25", "2026-11-28", "2026-11-24"),
      dias: [dia("2026-11-25"), dia("2026-11-26")],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    expect(a.texto).toContain("Aplica antes del");
    expect(a.texto).toContain("24 de noviembre");
  });

  it("un reporte vencido lo dice y manda a actualizar, no a aplicar", () => {
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: ventana("2026-11-10", "2026-11-14", "2026-11-09"),
      dias: [dia("2026-11-10")],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    expect(a.titular).toContain("vencio");
    expect(a.texto).toContain("Conectate");
    expect(a.texto).not.toContain("Aplica antes del");
  });

  it("no dice 'se juntan las condiciones' cuando la banda es solo favorable", () => {
    const v = { ...ventana("2026-11-25", "2026-11-26", "2026-11-24"), nivel: "favorable" };
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: v,
      dias: [dia("2026-11-25", 0.67)],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    // Usa la palabra de la banda del motor, que es lo que el numero dice.
    expect(a.texto).toContain("FAVORABLES a la infeccion");
    expect(a.texto).not.toContain("se juntan las condiciones");
  });

  /**
   * LA REGRESION CLAVADA.
   *
   * No basta con comprobar una fecha concreta: lo que no puede pasar es que
   * el mensaje de una ventana ABIERTA contenga CUALQUIER fecha anterior a
   * hoy. Esta prueba saca todas las fechas del texto y las compara.
   */
  it("con la ventana abierta, NINGUNA fecha del texto es anterior a hoy", () => {
    const MESES = [
      "enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
    ];
    const hoy = "2026-11-21";

    // Ventana que empezo hace tres dias y sigue abierta: el peor caso, porque
    // tanto el inicio como aplicarAntesDe quedaron atras.
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: ventana("2026-11-18", "2026-11-24", "2026-11-17"),
      dias: [dia("2026-11-18"), dia("2026-11-21"), dia("2026-11-24")],
      eventos: SIN_EVENTOS,
      hoy,
    });

    const encontradas = [...a.texto.matchAll(/(\d{1,2}) de ([a-z]+)/g)]
      .map((m) => {
        const mes = MESES.indexOf(m[2]);
        if (mes < 0) return null;
        // Las fechas de sintomas caen en diciembre: mismo año, sin cruce.
        return `2026-${String(mes + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      })
      .filter((x): x is string => x !== null);

    expect(encontradas.length).toBeGreaterThan(0);
    for (const f of encontradas) {
      expect(f >= hoy, `el texto trae ${f}, que ya paso:\n${a.texto}`).toBe(true);
    }
  });

  it("el texto nunca promete cuantos dias protege una aplicacion", () => {
    // El motor calcula condiciones de infeccion, no la eficacia de un
    // fungicida. Afirmar "cubre N dias" seria inventar un dato que no
    // tenemos en ninguna fuente.
    for (const v of [
      ventana("2026-11-21", "2026-11-24", "2026-11-20"),
      ventana("2026-11-21", "2026-11-21", "2026-11-20"),
      ventana("2026-11-25", "2026-11-28", "2026-11-24"),
    ]) {
      const a = redactarAviso({
        nombreParcela: "Finca El Sereno",
        ventana: v,
        dias: [dia(v.inicio)],
        eventos: SIN_EVENTOS,
        hoy: "2026-11-21",
      });
      expect(a.texto).not.toMatch(/cubre|protege|proteccion|protección/i);
    }
  });

  it("sin ventana no inventa ninguna fecha", () => {
    const a = redactarAviso({
      nombreParcela: "Finca El Sereno",
      ventana: null,
      dias: [dia("2026-11-21", 0.1)],
      eventos: SIN_EVENTOS,
      hoy: "2026-11-21",
    });
    expect(a.texto).toContain("no junta");
    expect(a.texto).not.toContain("Aplica antes");
  });
});
