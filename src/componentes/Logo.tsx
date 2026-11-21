/**
 * El logo: gota con brote.
 *
 * Y los TRES ANILLOS, que son el medidor de riesgo: hoy, 3 días y 7 días.
 * «Cada anillo es un año de campo. El color es el aviso.» (lámina 10)
 */
import { pintaDeNivel } from "@/lib/ui/riesgo";

export function Gota({ tam = 28, color = "currentColor" }: { tam?: number; color?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 2.5c5.2 6.2 9 11 9 15.6A9 9 0 0 1 7 18.1C7 13.5 10.8 8.7 16 2.5Z"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* el brote */}
      <path
        d="M16 23v-5.4"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 18.2c-2.6 0-4-1.4-4-3.6 2.6 0 4 1.3 4 3.6Zm0 0c2.6 0 4-1.4 4-3.6-2.6 0-4 1.3-4 3.6Z"
        fill={color}
        opacity="0.85"
      />
    </svg>
  );
}

export interface AnilloDato {
  /** "Hoy", "3 días", "7 días". */
  nombre: string;
  /** Banda del motor, o null si no hay dato para ese tramo. */
  nivel: string | null;
  /** Índice 0-1; null = no disponible. */
  indice: number | null;
}

/**
 * El medidor de 3 anillos. Cada anillo se llena con el índice del tramo y se
 * pinta con el color de su banda. Si no hay dato, el anillo queda hueco: no se
 * dibuja un cero que parezca "riesgo bajo".
 */
export function Medidor({
  anillos,
  nivelPrincipal,
  tam = 104,
}: {
  anillos: AnilloDato[];
  nivelPrincipal: string | null;
  tam?: number;
}) {
  const centro = 50;
  const radios = [44, 35, 26];
  const pinta = pintaDeNivel(nivelPrincipal ?? undefined);
  const hayDato = nivelPrincipal != null;

  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 100 100"
      role="img"
      aria-label={
        hayDato
          ? `Medidor de riesgo: ${anillos
              .map((a) => `${a.nombre} ${a.nivel ? pintaDeNivel(a.nivel).palabra : "no disponible"}`)
              .join(", ")}`
          : "Medidor de riesgo sin datos"
      }
    >
      {anillos.slice(0, 3).map((a, i) => {
        const r = radios[i];
        const circ = 2 * Math.PI * r;
        const p = a.indice == null ? 0 : Math.max(0.04, Math.min(1, a.indice));
        const c = a.nivel ? pintaDeNivel(a.nivel).color : "rgba(25,19,15,0.18)";
        return (
          <g key={a.nombre} transform={`rotate(-90 ${centro} ${centro})`}>
            <circle
              cx={centro}
              cy={centro}
              r={r}
              fill="none"
              stroke="rgba(25,19,15,0.09)"
              strokeWidth="6"
            />
            {a.indice != null && (
              <circle
                cx={centro}
                cy={centro}
                r={r}
                fill="none"
                stroke={c}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${circ * p} ${circ}`}
              />
            )}
          </g>
        );
      })}
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fontFamily="var(--display)"
        fontSize="15"
        fontWeight="600"
        fill={hayDato ? pinta.color : "rgba(25,19,15,0.45)"}
      >
        {hayDato ? pinta.palabra : "—"}
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontFamily="var(--texto)"
        fontSize="7.5"
        letterSpacing="1.4"
        fill="rgba(25,19,15,0.45)"
      >
        {hayDato ? pinta.corta : "SIN DATO"}
      </text>
    </svg>
  );
}
