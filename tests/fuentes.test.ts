/**
 * Pruebas de las partes PURAS de los modulos de fuentes: las que se pueden
 * comprobar sin red. Lo que necesita red se prueba con `npm run probar-fuentes`,
 * que hace peticiones reales y no finge nada.
 */
import { describe, expect, it } from "vitest";
import { deduplicar, TEMAS, type Noticia } from "@/lib/fuentes/gdelt";
import { clasificarTema, parsearIndice, periodoDeTitulo } from "@/lib/fuentes/anacafe";
import { filasDeCsv, parsearCsv, precioCacao, precioCafe } from "@/lib/fuentes/maga-precios";
import { puntoRocioMagnus } from "@/lib/fuentes/met-norway";

function noticia(p: Partial<Noticia>): Noticia {
  return {
    titulo: "Titulo",
    url: "https://ejemplo.com/a",
    dominio: "ejemplo.com",
    pais: null,
    idioma: "Spanish",
    vistoEn: "2026-11-01T00:00:00Z",
    tema: "roya",
    esVeredicto: false,
    noEsCotizacion: false,
    prioritario: false,
    ...p,
  };
}

describe("GDELT · consultas", () => {
  it("todo OR va entre parentesis (la API lo exige)", () => {
    // "Queries containing OR'd terms must be surrounded by ()."
    for (const [tema, def] of Object.entries(TEMAS)) {
      const abiertos = (def.consulta.match(/\(/g) ?? []).length;
      const cerrados = (def.consulta.match(/\)/g) ?? []).length;
      expect(abiertos, tema).toBe(cerrados);
      if (def.consulta.includes(" OR ")) {
        expect(def.consulta.trim().startsWith("("), tema).toBe(true);
      }
    }
  });

  it("ningun tema de enfermedad consulta sin el termino del cultivo", () => {
    // `roya` a secas trae ruido: en la prueba real devolvio un articulo de cine.
    for (const tema of ["roya", "broca", "ojo_de_gallo"] as const) {
      expect(TEMAS[tema].consulta.toLowerCase(), tema).toMatch(/caf|coffee/);
    }
  });

  it("solo el tema de precios se marca como no-cotizacion", () => {
    expect(TEMAS.precio_cafe.noEsCotizacion).toBe(true);
    expect(TEMAS.roya.noEsCotizacion).toBeUndefined();
  });
});

describe("GDELT · deduplicacion y orden", () => {
  it("quita la misma URL con y sin barra final, y con http/https", () => {
    const r = deduplicar([
      noticia({ url: "https://a.com/x", titulo: "Uno" }),
      noticia({ url: "https://a.com/x/", titulo: "Otro distinto" }),
      noticia({ url: "http://a.com/x", titulo: "Tercero distinto" }),
    ]);
    expect(r).toHaveLength(1);
  });

  it("quita titulos iguales salvo acentos y puntuacion", () => {
    const r = deduplicar([
      noticia({ url: "https://a.com/1", titulo: "La roya del café avanza en Huehuetenango" }),
      noticia({ url: "https://b.com/2", titulo: "La roya del cafe avanza en Huehuetenango!" }),
    ]);
    expect(r).toHaveLength(1);
  });

  it("no confunde dos titulos cortos distintos", () => {
    const r = deduplicar([
      noticia({ url: "https://a.com/1", titulo: "Roya en GT" }),
      noticia({ url: "https://b.com/2", titulo: "Broca en GT" }),
    ]);
    expect(r).toHaveLength(2);
  });

  it("Guatemala y Centroamerica van primero, y dentro de eso lo mas reciente", () => {
    const r = deduplicar([
      noticia({ url: "https://a.com/1", pais: "France", prioritario: false, vistoEn: "2026-11-20T00:00:00Z" }),
      noticia({ url: "https://b.com/2", pais: "Guatemala", prioritario: true, vistoEn: "2026-11-01T00:00:00Z" }),
      noticia({ url: "https://c.com/3", pais: "Honduras", prioritario: true, vistoEn: "2026-11-15T00:00:00Z" }),
    ]);
    expect(r.map((n) => n.pais)).toEqual(["Honduras", "Guatemala", "France"]);
  });

  it("una noticia nunca es veredicto del motor", () => {
    for (const n of deduplicar([noticia({}), noticia({ url: "https://z.com" })])) {
      expect(n.esVeredicto).toBe(false);
    }
  });
});

describe("Anacafe · parseo del indice publico", () => {
  // Fragmento con la forma REAL de la pagina (verificada el 21 nov 2026).
  const html = `
    <ul>
      <li><a href="https://www.anacafe.org/uploads/file/abc/10_Octubre_Monitoreo_de_Roya_2026.pdf" target="_blank">DESCARGAR INFOGRAF&Iacute;A</a></li>
      <li><a href="https://www.anacafe.org/uploads/file/abc/10_Octubre_Monitoreo_de_Roya_2026.pdf" target="_blank">Reporte de Roya y Recomendaciones | Octubre 2026</a></li>
      <li><a href="https://www.anacafe.org/uploads/file/def/Boletin-Roya-Abril-2025.pdf" target="_blank">Reporte de Roya y Recomendaciones | Abril 2025</a></li>
      <li><a href="https://anc.gt/?x=essiT" target="_blank">Infograf&iacute;a de Beauveria Bassiana | Junio 2025</a></li>
      <li><a href="/Servicios/Cedicafe">Cedicafe</a></li>
      <li><a href="https://otrositio.com/algo.pdf">Algo que no es de Anacafe</a></li>
    </ul>`;

  it("extrae solo PDF de Anacafe y sus acortadores, el mas reciente primero", () => {
    const docs = parsearIndice(html);
    expect(docs.map((d) => d.periodo)).toEqual(["2026-10", "2025-06", "2025-04"]);
    expect(docs[0].titulo).toBe("Reporte de Roya y Recomendaciones | Octubre 2026");
    // No se cuela un PDF de otro dominio ni un enlace de navegacion.
    expect(docs.some((d) => d.urlDocumento.includes("otrositio.com"))).toBe(false);
    expect(docs.some((d) => d.titulo === "Cedicafe")).toBe(false);
  });

  it("descarta los enlaces que son un boton, no un documento", () => {
    expect(parsearIndice(html).some((d) => /^descargar/i.test(d.titulo))).toBe(false);
  });

  it("deduplica por URL cuando el mismo PDF aparece dos veces", () => {
    const urls = parsearIndice(html).map((d) => d.urlDocumento);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("desescapa las entidades HTML del titulo", () => {
    const d = parsearIndice(html).find((x) => x.formato === "enlace");
    expect(d?.titulo).toContain("Infografía");
  });

  it("saca el periodo del titulo, con y sin acentos", () => {
    expect(periodoDeTitulo("Reporte | Octubre 2026")).toBe("2026-10");
    expect(periodoDeTitulo("Boletin de Setiembre de 2024")).toBe("2024-09");
    expect(periodoDeTitulo("Memoria de Labores 2025")).toBe("2025-01");
    expect(periodoDeTitulo("Sin fecha")).toBeNull();
  });

  it("clasifica el tema por el titulo", () => {
    expect(clasificarTema("Reporte de Roya y Recomendaciones")).toBe("roya");
    expect(clasificarTema("Manejo de broca con Beauveria")).toBe("broca");
    expect(clasificarTema("Ojo de gallo en el cafetal")).toBe("ojo_de_gallo");
    expect(clasificarTema("Pronostico de lluvias y ENOS")).toBe("clima");
    expect(clasificarTema("Ficha de variedad Anacafe-14")).toBe("variedades");
    expect(clasificarTema("Algo que no encaja")).toBe("otro");
  });
});

describe("MAGA · CSV de precios", () => {
  // Cabecera y filas con la forma REAL del CSV (agosto 2026), con BOM incluido.
  const csv =
    '﻿Actor,Peridiocidad,Mercado,Producto,Medida,Fecha,Moneda,Promedio de Precio\n' +
    'Mayorista,Mensual,CENMA,"Aguacate Hass, mediano, de primera",Ciento,1/08/2026,GTQ,325.00\n' +
    'Mayorista,Mensual,La Terminal,"Cacao (Despulpado), seco, de primera",Quintal,1/08/2026,GTQ,"2,500.00"\n' +
    'Mayorista,Mensual,CENMA,"Arroz oro, blanco de primera",Quintal,1/08/2026,GTQ,447.50\n';

  it("respeta las comillas y el BOM", () => {
    const filas = parsearCsv(csv);
    expect(filas).toHaveLength(4);
    expect(filas[0][0]).toBe("Actor");
    expect(filas[1][3]).toBe("Aguacate Hass, mediano, de primera");
  });

  it("convierte fecha d/m/aaaa y numero con separador de miles", () => {
    const filas = filasDeCsv(csv);
    const cacao = filas.find((f) => f.producto.startsWith("Cacao"))!;
    expect(cacao.fecha).toBe("2026-08-01");
    expect(cacao.precio).toBe(2500);
    expect(cacao.medida).toBe("Quintal");
    expect(cacao.actor).toBe("Mayorista");
  });

  it("CAFE: dice que no hay cotizacion nacional, con el motivo", () => {
    const r = precioCafe(filasDeCsv(csv));
    expect(r.disponible).toBe(false);
    expect(r.filas).toHaveLength(0);
    expect(r.motivo).toMatch(/[Ss]in cotizacion nacional/);
    // Lo que NO debe hacer: inventar un numero o traer el C de Nueva York.
    expect(r.motivo).toMatch(/Nueva York/);
  });

  it("CACAO: si aparece, con su precio", () => {
    const r = precioCacao(filasDeCsv(csv));
    expect(r.disponible).toBe(true);
    expect(r.filas[0].precio).toBe(2500);
  });

  it("no confunde 'cafe' con otro producto por coincidencia parcial", () => {
    const conAguacate = precioCafe(filasDeCsv(csv));
    expect(conAguacate.disponible).toBe(false);
  });
});

describe("met.no · punto de rocio derivado", () => {
  it("con HR 100 % el punto de rocio es la propia temperatura", () => {
    expect(puntoRocioMagnus(20, 100)).toBeCloseTo(20, 1);
  });

  it("baja cuando baja la humedad, y siempre por debajo de la temperatura", () => {
    expect(puntoRocioMagnus(20, 50)).toBeLessThan(20);
    expect(puntoRocioMagnus(20, 50)).toBeGreaterThan(puntoRocioMagnus(20, 30));
  });
});
