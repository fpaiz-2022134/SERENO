/**
 * Iconos de línea, dibujados a mano en SVG.
 *
 * Trazo redondo y algo grueso (1.75) para que acompañen a lo blando del resto
 * de la interfaz. Sin relleno y sin librería: son nueve trazos, no 40 KB de
 * dependencia. Heredan `currentColor`, así que nunca meten color propio.
 */

type Props = { tam?: number; trazo?: number };

function Svg({ tam = 20, trazo = 1.75, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={trazo}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** La marca: gota con brote. Dibujada con una sola intención. */
export function Gota({ tam = 22, trazo = 1.75 }: Props) {
  return (
    <Svg tam={tam} trazo={trazo}>
      <path d="M12 2.6c4.1 5 7 8.8 7 12.1a7 7 0 0 1-14 0c0-3.3 2.9-7.1 7-12.1Z" />
      <path d="M12 20.2v-5" />
      <path d="M12 15.2c-2 0-3.1-1.1-3.1-2.9 2 0 3.1 1 3.1 2.9Z" />
      <path d="M12 15.2c2 0 3.1-1.1 3.1-2.9-2 0-3.1 1-3.1 2.9Z" />
    </Svg>
  );
}

export const Casa = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9.6V20h13V9.6" />
    <path d="M9.8 20v-5.4h4.4V20" />
  </Svg>
);

export const Parcela = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 7.6 9 4.8l6 2.8 5.5-2.8v11.6L15 19.2l-6-2.8-5.5 2.8Z" />
    <path d="M9 4.8v11.6M15 7.6v11.6" />
  </Svg>
);

export const Campana = (p: Props) => (
  <Svg {...p}>
    <path d="M6.2 10.4a5.8 5.8 0 0 1 11.6 0c0 4 1.4 5.6 1.4 5.6H4.8s1.4-1.6 1.4-5.6Z" />
    <path d="M10.2 19a2 2 0 0 0 3.6 0" />
  </Svg>
);

export const Persona = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8.4" r="3.6" />
    <path d="M4.8 20.2c.6-3.8 3.6-5.8 7.2-5.8s6.6 2 7.2 5.8" />
  </Svg>
);

export const Regla = (p: Props) => (
  <Svg {...p}>
    <path d="M3.4 14.6 8 10l3.2 3.2L16 8.4l4.6 4.6" />
    <path d="M3.4 19.6h17.2" />
  </Svg>
);

export const Hoja = (p: Props) => (
  <Svg {...p}>
    <path d="M20 4.4c0 8.2-4.4 12.4-10 12.4-2.2 0-3.8-.6-3.8-.6S5.6 4.4 20 4.4Z" />
    <path d="M4.4 19.6c1.8-4.6 4.6-8 9-10.4" />
  </Svg>
);

export const Sobre = (p: Props) => (
  <Svg {...p}>
    <rect x="3.2" y="5.6" width="17.6" height="12.8" rx="1" />
    <path d="m3.6 6.6 8.4 6.2 8.4-6.2" />
  </Svg>
);

export const Flecha = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h13" />
    <path d="m12.6 6.4 5.8 5.6-5.8 5.6" />
  </Svg>
);

export const Compartir = (p: Props) => (
  <Svg {...p}>
    <path d="M12 15.6V3.8" />
    <path d="m7.4 8.2 4.6-4.4 4.6 4.4" />
    <path d="M5 14v5.4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V14" />
  </Svg>
);

export const Guardar = (p: Props) => (
  <Svg {...p}>
    <path d="M5 4.6h10.4L19 8.2v11.2H5Z" />
    <path d="M8.2 4.6v5h6.2v-5M8.2 19.4v-5.6h7.6v5.6" />
  </Svg>
);

export const Mira = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7.2" />
    <path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2" />
  </Svg>
);
