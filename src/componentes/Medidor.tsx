/**
 * EL MEDIDOR · el arco de bandas.
 *
 * Es la gráfica que contesta «¿y 0.67 es mucho o poco?».
 *
 * El arco es la escala 0 a 1 completa, partida en las TRES BANDAS DEL MOTOR
 * a su tamaño real: Calma ocupa la mitad del arco porque va de 0 a 0.5,
 * Atención un cuarto (0.5 – 0.75) y Alerta el otro cuarto (0.75 – 1). Los dos
 * cortes llevan su número escrito. La aguja marca dónde cayó el índice de hoy.
 *
 * Así se ve de un vistazo en qué banda está y qué tan cerca quedó del
 * siguiente corte, que es justo lo que un número suelto no dice.
 */
"use client";

import { pinta } from "@/lib/ui/paleta";

const BANDAS = [
  { desde: 0, hasta: 0.5, nivel: "poco_favorable", vivo: "#4fae6f" },
  { desde: 0.5, hasta: 0.75, nivel: "favorable", vivo: "#e3a01c" },
  { desde: 0.75, hasta: 1, nivel: "muy_favorable", vivo: "#d9533a" },
];

const ANCHO = 260;
const ALTO = 152;
const CX = ANCHO / 2;
const CY = 128;
const RADIO = 96;
const GROSOR = 15;

/** Un punto del arco: 0 queda a la izquierda, 1 a la derecha. */
function punto(v: number, r: number) {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, v)));
  return { x: CX + Math.cos(a) * r, y: CY - Math.sin(a) * r };
}

function arco(desde: number, hasta: number, r: number) {
  const a = punto(desde, r);
  const b = punto(hasta, r);
  return `M${a.x.toFixed(2)},${a.y.toFixed(2)} A${r},${r} 0 0 1 ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
}

export function Medidor({ indice, nivel }: { indice: number; nivel: string | null }) {
  const p = pinta(nivel);
  const v = Math.max(0, Math.min(1, indice));
  const aguja = punto(v, RADIO);

  return (
    <div className="medidor">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label={`Índice ${v.toFixed(2)} de 1, banda ${p.palabra}. Las bandas del motor son: hasta 0.50 Calma, de 0.50 a 0.75 Atención, de 0.75 a 1 Alerta.`}
      >
        {/* Las tres bandas, a su tamaño real sobre el arco */}
        {BANDAS.map((b) => (
          <path
            key={b.nivel}
            d={arco(b.desde + 0.006, b.hasta - 0.006, RADIO)}
            fill="none"
            stroke={b.vivo}
            strokeWidth={GROSOR}
            strokeLinecap="round"
            opacity={b.nivel === p.clave ? 1 : 0.26}
          />
        ))}

        {/* Los dos cortes, con su número */}
        {[0.5, 0.75].map((corte) => {
          const a = punto(corte, RADIO + GROSOR / 2 + 2);
          const b = punto(corte, RADIO - GROSOR / 2 - 2);
          const t = punto(corte, RADIO + GROSOR / 2 + 13);
          return (
            <g key={corte}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--fondo)" strokeWidth="2.5" />
              <text
                className="medidor__corte"
                x={t.x}
                y={t.y + (corte === 0.5 ? 0 : 3)}
                textAnchor={corte === 0.5 ? "middle" : "start"}
              >
                {corte.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Los extremos de la escala */}
        <text className="medidor__corte" x={punto(0, RADIO).x - 2} y={CY + 14} textAnchor="middle">
          0
        </text>
        <text className="medidor__corte" x={punto(1, RADIO).x + 2} y={CY + 14} textAnchor="middle">
          1
        </text>

        {/* La aguja: dónde cayó el índice */}
        <g className="medidor__aguja">
          <circle cx={aguja.x} cy={aguja.y} r="11" fill="var(--nube)" />
          <circle cx={aguja.x} cy={aguja.y} r="7" fill={p.color} />
          <circle cx={aguja.x} cy={aguja.y} r="2.6" fill="#fff" />
        </g>
      </svg>

      <div className="medidor__cifra">
        <span className="medidor__num" style={{ color: p.color }}>
          {v.toFixed(2)}
        </span>
        <span className="medidor__de">índice de 0 a 1</span>
      </div>
    </div>
  );
}
