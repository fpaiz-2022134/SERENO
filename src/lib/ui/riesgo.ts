/**
 * Riesgo: SIEMPRE color Y palabra.
 *
 * La lámina de branding lo dice literal: `RIESGO · COLOR + PALABRA`. Nunca
 * solo color — es accesibilidad, y el aviso tiene que leerse en una captura
 * de WhatsApp.
 *
 * Las tres bandas salen tal cual de `bandaDeIndice()` del motor
 * (src/lib/motor/parametros.ts). El mapeo es uno a uno: aquí no se inventa
 * ninguna banda nueva ni se mueve ningún umbral.
 */

export interface PintaRiesgo {
  /** La palabra que acompaña al color. Nunca va sola la una sin la otra. */
  palabra: string;
  /** Mayúscula corta para la insignia. */
  corta: string;
  color: string;
  claseInsignia: string;
  claseDato: string;
}

const CALMA: PintaRiesgo = {
  palabra: "Calma",
  corta: "BAJO",
  color: "#4f6b23",
  claseInsignia: "insignia insignia--bajo",
  claseDato: "dato dato--olivo",
};

const ATENCION: PintaRiesgo = {
  palabra: "Atención",
  corta: "MEDIO",
  color: "#96601a",
  claseInsignia: "insignia insignia--medio",
  claseDato: "dato dato--miel",
};

const ALERTA: PintaRiesgo = {
  palabra: "Alerta",
  corta: "ALTO",
  color: "#7a3518",
  claseInsignia: "insignia insignia--alto",
  claseDato: "dato dato--miel",
};

export function pintaDeNivel(nivel: string | null | undefined): PintaRiesgo {
  switch (nivel) {
    case "muy_favorable":
      return ALERTA;
    case "favorable":
      return ATENCION;
    case "poco_favorable":
      return CALMA;
    default:
      return CALMA;
  }
}
