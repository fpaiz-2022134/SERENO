/** Barra flotante de 5: Inicio · Mi parcela · + (roble) · Alertas · Perfil. */
"use client";

export type Vista = "hoy" | "parcela" | "alertas" | "perfil" | "resultado";

const ICONOS: Record<string, string> = {
  hoy: "⌂",
  parcela: "◎",
  alertas: "◔",
  perfil: "☗",
};

export function Navegacion({
  vista,
  ir,
  alCalcular,
}: {
  vista: Vista;
  ir: (v: Vista) => void;
  alCalcular: () => void;
}) {
  const boton = (v: Vista, nombre: string) => (
    <button
      type="button"
      className="navegacion__boton"
      aria-current={vista === v ? "page" : undefined}
      onClick={() => ir(v)}
    >
      <span aria-hidden="true" style={{ fontSize: 16 }}>
        {ICONOS[v]}
      </span>
      {nombre}
    </button>
  );

  return (
    <nav className="navegacion" aria-label="Navegación principal">
      {boton("hoy", "Inicio")}
      {boton("parcela", "Mi parcela")}
      <button
        type="button"
        className="navegacion__mas"
        onClick={alCalcular}
        aria-label="Calcular riesgo y costos"
      >
        <span aria-hidden="true">+</span>
      </button>
      {boton("alertas", "Alertas")}
      {boton("perfil", "Perfil")}
    </nav>
  );
}
