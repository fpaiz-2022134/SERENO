/**
 * Acceso y registro — cuentas de verdad.
 *
 * Una sola pantalla con dos modos, porque para un productor que abre la app
 * por primera vez «crear cuenta» e «iniciar sesión» son la misma intención:
 * entrar. Que la contraseña vaya a `/api/cuenta/registro` o a
 * `/api/cuenta/acceso` es un detalle del servidor, no una decisión suya.
 *
 * La contraseña viaja a un endpoint propio sobre HTTPS, se guarda hasheada con
 * scrypt y la sesión vuelve en una cookie `HttpOnly`. Ya no hay nada que
 * advertir aquí: esta pantalla sí valida contra el servidor.
 */
"use client";

import { useState } from "react";
import { Gota } from "@/componentes/Iconos";
import { FOTOS } from "@/componentes/Fotos";
import { entrar, registrarse, type EstadoCuenta } from "@/lib/ui/cuenta";

type Modo = "entrar" | "crear";

export function Acceso({
  alEntrar,
  baseConfigurada,
}: {
  alEntrar: (estado: EstadoCuenta) => void;
  baseConfigurada: boolean;
}) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setError(null);

    const limpio = correo.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpio)) {
      setError("Escriba un correo electrónico válido.");
      return;
    }
    if (clave.length === 0) {
      setError("Escriba su contraseña.");
      return;
    }
    if (modo === "crear" && clave.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      const estado =
        modo === "crear"
          ? await registrarse({ correo: limpio, clave, nombre: nombre.trim() || undefined })
          : await entrar({ correo: limpio, clave });
      alEntrar(estado);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
      setEnviando(false);
    }
  }

  return (
    <div className="portada">
      <div className="portada__fondo" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={FOTOS.cafetal.src} alt="" />
      </div>

      <div className="portada__alto">
        <div className="portada__gota entra entra-1">
          <Gota tam={54} trazo={1.5} />
        </div>
        <h1 className="portada__titulo entra entra-1">Sereno</h1>
        <div className="portada__lema entra entra-2">Clima para el agricultor</div>
        <p className="portada__promesa entra entra-3">Sepa antes. Decida usted.</p>
      </div>

      <form onSubmit={enviar} noValidate>
        {!baseConfigurada && (
          <div className="nota nota--alta" style={{ marginBottom: 14 }}>
            <span className="nota__signo" aria-hidden="true">!</span>
            <span>
              <b>El servidor no tiene base de datos configurada.</b> No se pueden crear
              cuentas ahora mismo.
            </span>
          </div>
        )}

        <div className="fichas entra entra-3" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="ficha"
            aria-pressed={modo === "entrar"}
            onClick={() => { setModo("entrar"); setError(null); }}
          >
            Ya tengo cuenta
          </button>
          <button
            type="button"
            className="ficha"
            aria-pressed={modo === "crear"}
            onClick={() => { setModo("crear"); setError(null); }}
          >
            Crear cuenta
          </button>
        </div>

        {modo === "crear" && (
          <label className="campo entra entra-3">
            <span className="campo__que">Su nombre (opcional)</span>
            <input
              type="text"
              autoComplete="name"
              placeholder="Ana Ramírez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
        )}

        <label className="campo entra entra-3">
          <span className="campo__que">Correo electrónico</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="ana.ramirez@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>

        <label className="campo entra entra-4">
          <span className="campo__que">
            Contraseña{modo === "crear" ? " · mínimo 8 caracteres" : ""}
          </span>
          <input
            type="password"
            autoComplete={modo === "crear" ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>

        {error && (
          <div className="nota nota--alta" role="alert" style={{ marginBottom: 12 }}>
            <span className="nota__signo" aria-hidden="true">!</span>
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="boton entra entra-5"
          style={{ marginTop: 4 }}
          disabled={enviando || !baseConfigurada}
        >
          {enviando ? "Un momento…" : modo === "crear" ? "Crear mi cuenta" : "Entrar"}
        </button>

        <p className="portada__pie">
          {modo === "crear"
            ? "La parcela se agrega después"
            : "Su sesión queda abierta 30 días en este teléfono"}
        </p>
      </form>
    </div>
  );
}
