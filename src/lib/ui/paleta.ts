/**
 * La paleta de v2 «Luz de cafetal».
 *
 * El fondo es verde porque el producto vive entre plantas. El riesgo son tres
 * tonos naturales de una misma familia —hoja, miel, barro— y nunca va el
 * color solo: al lado va siempre la palabra.
 *
 * La semántica NO se duplica aquí. `pintaDeNivel()` (src/lib/ui/riesgo.ts)
 * sigue siendo la única que traduce banda → palabra, y sale de
 * `bandaDeIndice()` del motor. Este módulo solo le pone el color de v2.
 */

import { pintaDeNivel } from "@/lib/ui/riesgo";

export interface PintaV2 {
  /** "Calma" · "Atención" · "Alerta". Viene de pintaDeNivel(). */
  palabra: string;
  /** "BAJO" · "MEDIO" · "ALTO". Viene de pintaDeNivel(). */
  corta: string;
  /** El color de v2 para esa banda. */
  color: string;
  /** Tono suave del mismo color, para rellenos y fondos. */
  lavado: string;
  /** El valor que se le pone a [data-riesgo] para que las variables bajen. */
  clave: string;
}

/**
 * Tres tonos naturales de una misma familia —hoja, miel, barro— que combinan
 * entre sí y con el verde del fondo. Se entienden como progresión sin que
 * nadie los explique, y los tres pasan 4.5:1 sobre el papel de la app.
 *
 * Son los MISMOS valores que `--calma`, `--atencion` y `--alerta` en
 * globales.css. Si cambia uno, cambian los dos sitios.
 */
const COLORES: Record<string, { color: string; lavado: string }> = {
  poco_favorable: { color: "#2e7d4f", lavado: "#d9eadf" },
  favorable: { color: "#9a6b12", lavado: "#f5e7c8" },
  muy_favorable: { color: "#b0462f", lavado: "#f7ded6" },
};

export function pinta(nivel: string | null | undefined): PintaV2 {
  const base = pintaDeNivel(nivel ?? undefined);
  const clave = nivel && COLORES[nivel] ? nivel : "poco_favorable";
  return { palabra: base.palabra, corta: base.corta, clave, ...COLORES[clave] };
}

/** Días completos entre dos fechas de calendario (YYYY-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}
