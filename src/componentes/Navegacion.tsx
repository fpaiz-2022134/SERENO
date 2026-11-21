/**
 * La barra: una regla negra pegada al borde, no una píldora flotante.
 *
 * El botón del medio («CALCULAR») es el único elemento de la barra con color,
 * y lleva el color del riesgo vigente: desde cualquier pantalla se ve en qué
 * banda está la parcela sin volver al inicio.
 */
"use client";

import { Campana, Casa, Parcela, Persona, Regla } from "@/componentes/Iconos";

export type Vista = "hoy" | "parcela" | "alertas" | "perfil" | "resultado";

export function Navegacion({
  vista,
  ir,
  alCalcular,
}: {
  vista: Vista;
  ir: (v: Vista) => void;
  alCalcular: () => void;
}) {
  const ITEMS: { v: Vista; nombre: string; Icono: typeof Casa }[] = [
    { v: "hoy", nombre: "Hoy", Icono: Casa },
    { v: "parcela", nombre: "Parcela", Icono: Parcela },
  ];
  const FIN: { v: Vista; nombre: string; Icono: typeof Casa }[] = [
    { v: "alertas", nombre: "Alertas", Icono: Campana },
    { v: "perfil", nombre: "Perfil", Icono: Persona },
  ];

  const boton = ({ v, nombre, Icono }: { v: Vista; nombre: string; Icono: typeof Casa }) => (
    <button
      key={v}
      type="button"
      className="barra__ir"
      aria-current={vista === v ? "page" : undefined}
      onClick={() => ir(v)}
    >
      <Icono tam={19} />
      {nombre}
    </button>
  );

  return (
    <nav className="barra" aria-label="Navegación principal">
      {ITEMS.map(boton)}
      <button
        type="button"
        className="barra__calcular"
        onClick={alCalcular}
        aria-label="Calcular riesgo y costos"
      >
        <Regla tam={19} />
        Calcular
      </button>
      {FIN.map(boton)}
    </nav>
  );
}
