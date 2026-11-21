/**
 * LA CURVA DE RIESGO · una gráfica que explica, no que decora.
 *
 * Todo lo que se dibuja aquí está para contestar «¿por qué este número?»:
 *
 *  · las dos líneas punteadas son los UMBRALES REALES del motor (0.5 y 0.75,
 *    las bandas del SENAMHI), rotuladas con su palabra: Calma, Atención,
 *    Alerta. Se ve a simple vista cuándo la curva los cruza;
 *  · la franja sombreada es LA VENTANA DE RIESGO que calculó el motor, con
 *    su nombre encima;
 *  · la línea vertical es HOY;
 *  · los círculos rellenos son los días con EVENTO DE INFECCIÓN confirmado;
 *  · cualquier punto se puede tocar y leer abajo.
 *
 * Nada de ejes mudos: cada elemento lleva su rótulo en español.
 */
"use client";

import { useId, useMemo } from "react";
import { pinta } from "@/lib/ui/paleta";
import { diaSemanaCorto } from "@/lib/ui/fechas";
import type { DiaCurva, VentanaAccion } from "@/lib/ui/tipos";

const ANCHO = 320;
const ALTO = 150;
const IZQ = 4;
const DER = 48; // sitio para los rótulos de banda, a la derecha
const ARRIBA = 16;
const ABAJO = 26;

/** Las bandas son las del motor: no se inventa ninguna ni se mueve un umbral. */
const UMBRALES = [
  { v: 0.75, nivel: "muy_favorable" },
  { v: 0.5, nivel: "favorable" },
];

export function Grafica({
  curva,
  hoy,
  ventana,
  elegido,
  alElegir,
}: {
  curva: DiaCurva[];
  hoy: string;
  ventana: VentanaAccion | null;
  elegido: string;
  alElegir: (dia: string) => void;
}) {
  const id = useId();
  const dias = curva.slice(0, 16);

  const geo = useMemo(() => {
    const anchoUtil = ANCHO - IZQ - DER;
    const altoUtil = ALTO - ARRIBA - ABAJO;
    const x = (i: number) => IZQ + (dias.length <= 1 ? 0 : (i / (dias.length - 1)) * anchoUtil);
    const y = (v: number) => ARRIBA + (1 - Math.max(0, Math.min(1, v))) * altoUtil;
    return { x, y, anchoUtil, altoUtil };
  }, [dias.length]);

  if (dias.length === 0) return null;

  const puntos = dias.map((d, i) => ({ d, i, px: geo.x(i), py: geo.y(d.indice) }));
  const trazo = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(" ");
  const area = `${trazo} L${puntos[puntos.length - 1].px.toFixed(1)},${geo.y(0)} L${puntos[0].px.toFixed(1)},${geo.y(0)} Z`;

  const iHoy = dias.findIndex((d) => d.dia === hoy);
  const pico = dias.reduce((a, b) => (b.indice > a.indice ? b : a));
  const p = pinta(ventana?.nivel ?? pico.nivel);

  // La ventana, en coordenadas de la gráfica.
  const iIni = ventana ? dias.findIndex((d) => d.dia >= ventana.inicio) : -1;
  const iFin = ventana ? dias.map((d) => d.dia <= ventana.fin).lastIndexOf(true) : -1;

  return (
    <div className="grafica">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={leerEnVoz(dias, ventana)}>
        <defs>
          <linearGradient id={`${id}-relleno`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.color} stopOpacity="0.26" />
            <stop offset="100%" stopColor={p.color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* La ventana de riesgo: franja sombreada con su nombre encima.
            Si dura un solo día la franja seria de 2 px, asi que se le da un
            ancho minimo para que se vea y se pueda señalar. */}
        {iIni >= 0 && iFin >= iIni && (() => {
          const xIni = geo.x(iIni);
          const ancho = Math.max(14, geo.x(iFin) - xIni);
          const centro = xIni + ancho / 2;
          // El rotulo no se sale por ningun lado del area de dibujo.
          const xRot = Math.min(Math.max(centro, IZQ + 42), ANCHO - DER - 42);
          return (
            <>
              <rect
                className="grafica__ventana"
                x={xIni - (ancho === 14 ? 7 : 0)}
                y={ARRIBA}
                width={ancho}
                height={geo.y(0) - ARRIBA}
                rx="6"
              />
              <line
                x1={xIni - (ancho === 14 ? 7 : 0)}
                y1={ARRIBA}
                x2={xIni - (ancho === 14 ? 7 : 0) + ancho}
                y2={ARRIBA}
                stroke={p.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />
              <text className="grafica__banda" x={xRot} y={ARRIBA - 6} fill={p.color} textAnchor="middle">
                Ventana de riesgo
              </text>
            </>
          );
        })()}

        {/* Los dos umbrales del motor, rotulados con su palabra */}
        {UMBRALES.map((u) => {
          const pu = pinta(u.nivel);
          return (
            <g key={u.v}>
              <line
                className="grafica__umbral"
                x1={IZQ}
                y1={geo.y(u.v)}
                x2={ANCHO - DER + 4}
                y2={geo.y(u.v)}
              />
              <text className="grafica__banda" x={ANCHO - DER + 8} y={geo.y(u.v) - 2} fill={pu.color}>
                {pu.palabra}
              </text>
              <text className="grafica__eje" x={ANCHO - DER + 8} y={geo.y(u.v) + 9}>
                {u.v.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Hoy: la vertical y su rotulo, siempre dentro del dibujo */}
        {iHoy >= 0 && (
          <>
            <line className="grafica__hoy" x1={geo.x(iHoy)} y1={ARRIBA} x2={geo.x(iHoy)} y2={geo.y(0)} />
            <text
              className="grafica__banda"
              x={Math.min(geo.x(iHoy) + 5, ANCHO - DER - 18)}
              y={geo.y(0) - 4}
              fill="var(--hoja-honda)"
              opacity="0.6"
            >
              Hoy
            </text>
          </>
        )}

        {/* La curva */}
        <path className="grafica__area" d={area} fill={`url(#${id}-relleno)`} />
        <path className="grafica__trazo" d={trazo} stroke={p.color} />

        {/* Los días: evento confirmado = círculo relleno */}
        {puntos.map(({ d, px, py }) => {
          const pd = pinta(d.nivel);
          const activo = d.dia === elegido;
          return (
            <g key={d.dia} className="grafica__punto" onClick={() => alElegir(d.dia)}>
              {/* área de toque generosa: es un teléfono, con dedos */}
              <rect x={px - 10} y={0} width={20} height={ALTO} fill="transparent" />
              {d.hayEvento && <circle cx={px} cy={py} r="4.6" fill={pd.color} />}
              {activo && (
                <>
                  <circle cx={px} cy={py} r="8" fill={pd.color} opacity="0.18" />
                  <circle cx={px} cy={py} r="4.2" fill="#fff" stroke={pd.color} strokeWidth="2.4" />
                </>
              )}
            </g>
          );
        })}

        {/* Fechas de los extremos */}
        <text className="grafica__eje" x={IZQ} y={ALTO - 4}>
          {diaSemanaCorto(dias[0].dia)} {Number(dias[0].dia.slice(8))}
        </text>
        <text className="grafica__eje" x={geo.x(dias.length - 1)} y={ALTO - 4} textAnchor="end">
          {diaSemanaCorto(dias[dias.length - 1].dia)} {Number(dias[dias.length - 1].dia.slice(8))}
        </text>
      </svg>

      <div className="grafica__leyenda">
        <span>
          <i className="grafica__muestra" style={{ background: p.color }} />
          Índice de infección, día por día
        </span>
        <span>
          <i className="grafica__muestra grafica__muestra--punteada" />
          Umbrales del motor
        </span>
        <span>
          <i
            className="grafica__muestra grafica__muestra--area"
            style={{ background: p.color, opacity: 0.16 }}
          />
          Ventana de riesgo
        </span>
        <span>
          <i
            className="grafica__muestra"
            style={{ background: p.color, width: 9, height: 9, borderRadius: 9 }}
          />
          Evento de infección confirmado
        </span>
      </div>
    </div>
  );
}

/** Lo mismo que dice la gráfica, para quien la escucha en vez de verla. */
function leerEnVoz(dias: DiaCurva[], ventana: VentanaAccion | null): string {
  const eventos = dias.filter((d) => d.hayEvento).length;
  const pico = dias.reduce((a, b) => (b.indice > a.indice ? b : a));
  return (
    `Curva del índice de infección de ${dias.length} días. ` +
    `El máximo es ${pico.indice.toFixed(2)} y cae en banda ${pinta(pico.nivel).palabra}. ` +
    (ventana
      ? `La ventana de riesgo va del ${ventana.inicio} al ${ventana.fin}. `
      : "No hay ventana de riesgo en el pronóstico. ") +
    `${eventos} día${eventos === 1 ? "" : "s"} con evento de infección confirmado.`
  );
}

/**
 * LA BALANZA DE MOJADO · la aritmética de Magarey, dibujada.
 *
 * El motor dispara cuando las horas seguidas de hoja mojada alcanzan las que
 * pide el modelo a esa temperatura. Aquí se ven las dos cosas en la misma
 * barra: lo acumulado y, marcada encima, la raya del umbral. Si la barra pasa
 * la raya, hay evento. No hace falta explicar más.
 */
export function Balanza({
  horas,
  requeridas,
  temperatura,
  color,
}: {
  horas: number;
  requeridas: number | null;
  temperatura: number | null;
  color: string;
}) {
  if (requeridas == null) {
    return (
      <p className="balanza__pie" style={{ marginTop: 4 }}>
        A esa temperatura el modelo no pide un número de horas: está fuera del rango de
        infección (15 – 28 °C), así que no hay umbral que cruzar.
      </p>
    );
  }

  // La escala llega a lo que sea más grande, con aire, para que la raya del
  // umbral nunca quede pegada al borde.
  const tope = Math.max(horas, requeridas) * 1.25;
  const pctHoras = Math.min(100, (horas / tope) * 100);
  const pctUmbral = Math.min(97, (requeridas / tope) * 100);
  const alcanza = horas >= requeridas;

  return (
    <div className="balanza">
      <div className="balanza__riel">
        <span
          className="balanza__lleno"
          style={{ width: `${pctHoras}%`, background: `linear-gradient(90deg, ${color}33, ${color})` }}
        />
        <span className="balanza__marca" style={{ left: `${pctUmbral}%` }}>
          <span>{Math.round(requeridas)} h</span>
        </span>
      </div>

      <div className="balanza__pie">
        <span>
          <b>{horas} h</b> de hoja mojada seguidas
        </span>
        <span style={{ textAlign: "right" }}>
          el modelo pide <b>{Math.round(requeridas)} h</b>
          {temperatura != null && ` a ${temperatura.toFixed(1)} °C`}
        </span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.45, margin: "10px 0 0", color: "var(--hoja-honda)" }}>
        {alcanza ? (
          <>
            La barra <b style={{ color }}>pasa la raya</b>: se juntaron las horas de agua libre
            que la roya necesita para entrar en la hoja.
          </>
        ) : (
          <>
            La barra <b>no llega a la raya</b>: faltan{" "}
            <b>{Math.max(0, Math.round(requeridas - horas))} h</b> de hoja mojada para que la
            infección se complete.
          </>
        )}
      </p>
    </div>
  );
}
