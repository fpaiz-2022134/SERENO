import { describe, expect, it } from "vitest";
import {
  coberturaDeAplicacion,
  detectarEventos,
  esHoraMojada,
  fechaSintomas,
  horasMojadoRequeridas,
  lluviaPorDia,
  respuestaTemperatura,
  riesgoPorDia,
  ventanaDeAccion,
} from "@/lib/motor/riesgo";
import { ROYA_CAFE, bandaDeIndice } from "@/lib/motor/parametros";
import type { SerieHoraria } from "@/lib/motor/tipos";

const PROCEDENCIA = {
  fuente: "serie sintetica de prueba",
  url: "test://motor",
  fechaPublicacion: null,
  ultimaConsulta: "2026-11-21T00:00:00.000Z",
  esPronostico: false,
};

/**
 * Construye una serie horaria sintetica a partir de horas mojadas/secas.
 * `horasMojadas` horas con HR = 95 % y la temperatura dada, luego una hora seca
 * que cierra la racha.
 */
function serie(opciones: {
  desde?: string;
  horasMojadas: number;
  temperatura: number;
  lluviaPorHoraMm?: number;
  cerrarRacha?: boolean;
}): SerieHoraria {
  const {
    desde = "2012-05-23T00:00",
    horasMojadas,
    temperatura,
    lluviaPorHoraMm = 0,
    cerrarRacha = true,
  } = opciones;
  const tiempo: string[] = [];
  const t: (number | null)[] = [];
  const hr: (number | null)[] = [];
  const p: (number | null)[] = [];

  const base = new Date(`${desde}:00Z`);
  const empuja = (i: number, mojada: boolean) => {
    const d = new Date(base.getTime() + i * 3_600_000);
    tiempo.push(d.toISOString().slice(0, 16));
    t.push(temperatura);
    hr.push(mojada ? 95 : 60);
    p.push(mojada ? lluviaPorHoraMm : 0);
  };
  for (let i = 0; i < horasMojadas; i++) empuja(i, true);
  if (cerrarRacha) empuja(horasMojadas, false);

  return { tiempo, temperatura: t, humedadRelativa: hr, precipitacion: p, procedencia: PROCEDENCIA };
}

describe("respuestaTemperatura · beta de Magarey et al. 2005", () => {
  it("f(Topt) === 1", () => {
    expect(respuestaTemperatura(ROYA_CAFE.tOpt)).toBeCloseTo(1, 12);
  });

  it("f(T) === 0 fuera del rango [Tmin, Tmax]", () => {
    expect(respuestaTemperatura(ROYA_CAFE.tMin)).toBe(0);
    expect(respuestaTemperatura(ROYA_CAFE.tMax)).toBe(0);
    expect(respuestaTemperatura(10)).toBe(0);
    expect(respuestaTemperatura(14.99)).toBe(0);
    expect(respuestaTemperatura(28.01)).toBe(0);
    expect(respuestaTemperatura(35)).toBe(0);
    expect(respuestaTemperatura(-5)).toBe(0);
  });

  it("es positiva y menor que 1 dentro del rango, con el maximo en Topt", () => {
    for (const T of [15.5, 18, 19.6, 22.5, 25, 27.5]) {
      const f = respuestaTemperatura(T);
      expect(f).toBeGreaterThan(0);
      expect(f).toBeLessThanOrEqual(1);
    }
    expect(respuestaTemperatura(22)).toBeGreaterThan(respuestaTemperatura(19.6));
    expect(respuestaTemperatura(22)).toBeGreaterThan(respuestaTemperatura(25));
  });

  it("W(T) = min(Wmin/f(T), Wmax) y vale Wmin en el optimo", () => {
    expect(horasMojadoRequeridas(22)).toBeCloseTo(ROYA_CAFE.wMin, 10);
    // A 19.6 °C la investigacion reporta W ~ 7.0 h (SERENO-investigacion.md §4).
    expect(horasMojadoRequeridas(19.6)).toBeCloseTo(7.0, 1);
    // Fuera del rango no hay cantidad de mojado que infecte.
    expect(horasMojadoRequeridas(12)).toBe(Infinity);
    expect(horasMojadoRequeridas(30)).toBe(Infinity);
    // Nunca pide mas que Wmax.
    expect(horasMojadoRequeridas(15.1)).toBeLessThanOrEqual(ROYA_CAFE.wMax);
    expect(horasMojadoRequeridas(27.9)).toBeLessThanOrEqual(ROYA_CAFE.wMax);
  });
});

describe("mojado foliar estimado sin sensor", () => {
  it("hora mojada si HR >= 90 % O lluvia >= 0.2 mm", () => {
    expect(esHoraMojada(90, 0)).toBe(true);
    expect(esHoraMojada(95, 0)).toBe(true);
    expect(esHoraMojada(60, 0.2)).toBe(true);
    expect(esHoraMojada(60, 5)).toBe(true);
    expect(esHoraMojada(89.9, 0.1)).toBe(false);
    expect(esHoraMojada(null, null)).toBe(false);
  });
});

describe("deteccion de eventos de infeccion", () => {
  it("una racha de 8 h a 19.6 °C dispara evento (W = 7.0 h)", () => {
    const eventos = detectarEventos(serie({ horasMojadas: 8, temperatura: 19.6 }));
    expect(eventos).toHaveLength(1);
    const e = eventos[0];
    expect(e.horasMojadas).toBe(8);
    expect(e.temperaturaMedia).toBeCloseTo(19.6, 1);
    expect(e.horasRequeridas).toBeCloseTo(7.0, 1);
    expect(e.alcanzoUmbral).toBe(true);
    expect(e.esEvento).toBe(true);
    expect(e.indice).toBe(1);
    expect(e.nivel).toBe("muy_favorable");
  });

  it("una racha de 5 h a 19.6 °C NO dispara evento", () => {
    const eventos = detectarEventos(serie({ horasMojadas: 5, temperatura: 19.6 }));
    expect(eventos).toHaveLength(1);
    const e = eventos[0];
    expect(e.horasMojadas).toBe(5);
    expect(e.alcanzoUmbral).toBe(false);
    expect(e.esEvento).toBe(false);
    // 5 / 7.0 = 0.71 -> banda "favorable", todavia no "muy favorable"
    expect(e.indice).toBeCloseTo(0.71, 2);
    expect(e.nivel).toBe("favorable");
  });

  it("no hay evento si la temperatura esta fuera del rango, aunque llueva 40 h", () => {
    const eventos = detectarEventos(serie({ horasMojadas: 40, temperatura: 12 }));
    // indice 0 -> la racha no se reporta
    expect(eventos).toHaveLength(0);
  });

  it("lavado por lluvia: > 10 mm/dia anula el evento y baja el indice", () => {
    // 12 h mojadas a 19.6 °C con 2 mm/h = 24 mm en el dia.
    // Sin la regla de lavado esto seria un evento con indice 1.
    const eventos = detectarEventos(
      serie({ horasMojadas: 12, temperatura: 19.6, lluviaPorHoraMm: 2 }),
    );
    expect(eventos).toHaveLength(1);
    const e = eventos[0];
    expect(e.lluviaDiariaMaxMm).toBeGreaterThan(ROYA_CAFE.lluviaLavadoDia);
    expect(e.alcanzoUmbral).toBe(true); // la aritmetica de Magarey si se cumplio
    expect(e.lavadoPorLluvia).toBe(true);
    expect(e.esEvento).toBe(false); // pero no hay evento: la lluvia lavo las esporas
    expect(e.indice).toBeCloseTo(ROYA_CAFE.factorLavado, 5);
  });

  it("lluvia moderada (> 5 mm, < 10 mm/dia) es el optimo: evento con lluviaOptima", () => {
    // 12 h mojadas a 19.6 °C con 0.6 mm/h = 7.2 mm en el dia.
    const eventos = detectarEventos(
      serie({ horasMojadas: 12, temperatura: 19.6, lluviaPorHoraMm: 0.6 }),
    );
    const e = eventos[0];
    expect(e.lluviaDiariaMaxMm).toBeGreaterThan(ROYA_CAFE.lluviaOptimaDia);
    expect(e.lluviaDiariaMaxMm).toBeLessThanOrEqual(ROYA_CAFE.lluviaLavadoDia);
    expect(e.lavadoPorLluvia).toBe(false);
    expect(e.lluviaOptima).toBe(true);
    expect(e.esEvento).toBe(true);
    expect(e.indice).toBe(1);
  });

  it("una hora sin temperatura rompe la racha", () => {
    const s = serie({ horasMojadas: 8, temperatura: 19.6 });
    s.temperatura[4] = null; // parte la racha en 4 + 3
    const eventos = detectarEventos(s);
    expect(eventos.every((e) => e.esEvento === false)).toBe(true);
  });

  it("incubacion 25-30 dias", () => {
    const eventos = detectarEventos(
      serie({ desde: "2012-05-16T00:00", horasMojadas: 10, temperatura: 19.6 }),
    );
    expect(eventos[0].dia).toBe("2012-05-16");
    expect(eventos[0].sintomasVisiblesDesde).toBe("2012-06-10");
    expect(eventos[0].sintomasVisiblesHasta).toBe("2012-06-15");
    expect(fechaSintomas("2012-05-16")).toEqual({
      desde: "2012-06-10",
      hasta: "2012-06-15",
    });
  });
});

describe("bandas del SENAMHI", () => {
  it("0-0.5 poco favorable, 0.5-0.75 favorable, 0.75-1 muy favorable", () => {
    expect(bandaDeIndice(0).nivel).toBe("poco_favorable");
    expect(bandaDeIndice(0.49).nivel).toBe("poco_favorable");
    expect(bandaDeIndice(0.5).nivel).toBe("favorable");
    expect(bandaDeIndice(0.74).nivel).toBe("favorable");
    expect(bandaDeIndice(0.75).nivel).toBe("muy_favorable");
    expect(bandaDeIndice(1).nivel).toBe("muy_favorable");
  });
});

describe("curva diaria y ventana de accion", () => {
  it("lluviaPorDia suma por dia local", () => {
    const s = serie({ horasMojadas: 10, temperatura: 19.6, lluviaPorHoraMm: 1 });
    const m = lluviaPorDia(s);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(10, 5);
  });

  it("riesgoPorDia pinta el dia que toca la racha y la ventana apunta al dia anterior", () => {
    const s = serie({ desde: "2026-11-25T00:00", horasMojadas: 10, temperatura: 19.6 });
    const dias = riesgoPorDia(s);
    expect(dias[0].dia).toBe("2026-11-25");
    expect(dias[0].indice).toBe(1);
    expect(dias[0].hayEvento).toBe(true);

    const v = ventanaDeAccion(dias);
    expect(v).not.toBeNull();
    expect(v!.inicio).toBe("2026-11-25");
    expect(v!.aplicarAntesDe).toBe("2026-11-24");
    expect(v!.contieneEvento).toBe(true);
  });

  it("sin dias favorables no hay ventana", () => {
    const s = serie({ horasMojadas: 3, temperatura: 16 });
    expect(ventanaDeAccion(riesgoPorDia(s))).toBeNull();
  });
});

describe("cobertura de aplicacion (dato 5 del dashboard)", () => {
  it("marca cubierto si la aplicacion fue antes del evento", () => {
    const eventos = detectarEventos(
      serie({ desde: "2026-11-10T00:00", horasMojadas: 10, temperatura: 19.6 }),
    );
    const c = coberturaDeAplicacion("2026-11-21", "2026-11-05", eventos);
    expect(c.diasDesdeUltimaAplicacion).toBe(16);
    expect(c.ultimoEvento).toBe("2026-11-10");
    expect(c.ultimoEventoCubierto).toBe(true);
  });

  it("marca NO cubierto si la aplicacion fue despues del evento", () => {
    const eventos = detectarEventos(
      serie({ desde: "2026-11-10T00:00", horasMojadas: 10, temperatura: 19.6 }),
    );
    const c = coberturaDeAplicacion("2026-11-21", "2026-11-18", eventos);
    expect(c.ultimoEventoCubierto).toBe(false);
  });

  it("ignora los eventos que todavia no ocurrieron (pronostico)", () => {
    const eventos = detectarEventos(
      serie({ desde: "2026-12-10T00:00", horasMojadas: 10, temperatura: 19.6 }),
    );
    // El evento es del 10 de diciembre; hoy es el 21 de noviembre.
    const c = coberturaDeAplicacion("2026-11-21", "2026-11-05", eventos);
    expect(c.ultimoEvento).toBeNull();
    expect(c.diasDesdeUltimaAplicacion).toBe(16);
  });

  it("sin aplicacion registrada devuelve null", () => {
    const c = coberturaDeAplicacion("2026-11-21", null, []);
    expect(c.diasDesdeUltimaAplicacion).toBeNull();
    expect(c.ultimoEventoCubierto).toBeNull();
  });
});
