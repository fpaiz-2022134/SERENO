/**
 * El armazón de la PWA.
 *
 * Es una sola página con las pantallas en estado del cliente, y no rutas de
 * servidor, a propósito: así el service worker cachea UN documento y la app
 * abre completa sin conexión, sin pedir la carga parcial de ninguna ruta.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gota } from "@/componentes/Logo";
import { Navegacion, type Vista } from "@/componentes/Navegacion";
import { Acceso } from "@/pantallas/Acceso";
import { ConfirmarCorreo } from "@/pantallas/ConfirmarCorreo";
import { SinParcela } from "@/pantallas/SinParcela";
import { Hoy } from "@/pantallas/Hoy";
import { MiParcela } from "@/pantallas/MiParcela";
import { Resultado } from "@/pantallas/Resultado";
import { Alertas } from "@/pantallas/Alertas";
import { Perfil } from "@/pantallas/Perfil";
import { marcaDeTiempo } from "@/lib/ui/fechas";
import {
  borrarParcela,
  borrarSesion,
  guardarAccionesHechas,
  guardarParcela,
  guardarSesion,
  leerAccionesHechas,
  leerCostos,
  leerParcela,
  leerSesion,
  nombreDesdeCorreo,
  type Costos,
  type Parcela,
  type Sesion,
} from "@/lib/ui/almacen";
import { SinDatos, clavePrevencion, pedirConRespaldo, rutaPrevencion, type Resultado as Res } from "@/lib/ui/red";
import type { RespuestaPrevencion } from "@/lib/ui/tipos";

type Paso = "cargando" | "acceso" | "codigo" | "app";

export function App() {
  const [paso, setPaso] = useState<Paso>("cargando");
  const [correoPendiente, setCorreoPendiente] = useState("");
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [parcela, setParcela] = useState<Parcela | null>(null);
  const [vista, setVista] = useState<Vista>("hoy");

  const [reporte, setReporte] = useState<Res<RespuestaPrevencion> | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);

  const [acciones, setAcciones] = useState<string[]>([]);
  const [costos, setCostos] = useState<Costos | null>(null);
  const [enLinea, setEnLinea] = useState(true);

  /* --- arranque: leer lo que ya está en el teléfono ----------------- */
  useEffect(() => {
    const s = leerSesion();
    setSesion(s);
    setParcela(leerParcela());
    setAcciones(leerAccionesHechas());
    setCostos(leerCostos());
    setPaso(s?.correoConfirmado ? "app" : "acceso");
    setEnLinea(navigator.onLine);

    const sube = () => setEnLinea(true);
    const baja = () => setEnLinea(false);
    window.addEventListener("online", sube);
    window.addEventListener("offline", baja);
    return () => {
      window.removeEventListener("online", sube);
      window.removeEventListener("offline", baja);
    };
  }, []);

  /* --- registrar el service worker ---------------------------------- */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* sin service worker la app sigue andando, solo que sin modo avión */
      });
    }
  }, []);

  /* --- consultar el pronóstico de la parcela ------------------------ */
  const consultar = useCallback(async (p: Parcela) => {
    setCargando(true);
    setErrorReporte(null);
    try {
      const r = await pedirConRespaldo<RespuestaPrevencion>(
        clavePrevencion(p.latitud, p.longitud),
        rutaPrevencion(p),
      );
      setReporte(r);
      // La altitud la mide la fuente; si cambió, se guarda en la parcela.
      const alt = r.datos.punto?.altitudMetros ?? null;
      if (alt != null && alt !== p.altitudMetros) {
        const actualizada = { ...p, altitudMetros: alt };
        guardarParcela(actualizada);
        setParcela(actualizada);
      }
    } catch (e) {
      setErrorReporte(e instanceof SinDatos ? e.message : "No se pudo consultar el pronóstico.");
      setReporte(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (paso === "app" && parcela) void consultar(parcela);
    // Solo por coordenada: cambiar el nombre no vuelve a pedir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, parcela?.latitud, parcela?.longitud, parcela?.ultimaAplicacion]);

  const nombre = useMemo(() => sesion?.nombre ?? "productor", [sesion]);

  /* --- sesión -------------------------------------------------------- */
  function entrar(correo: string) {
    setCorreoPendiente(correo);
    setPaso("codigo");
  }

  function confirmar() {
    const s: Sesion = {
      correo: correoPendiente,
      nombre: nombreDesdeCorreo(correoPendiente),
      correoConfirmado: true,
      soloLocal: true,
      creadaEn: new Date().toISOString(),
    };
    guardarSesion(s);
    setSesion(s);
    setPaso("app");
    setVista("hoy");
  }

  function salir() {
    borrarSesion();
    borrarParcela();
    setSesion(null);
    setParcela(null);
    setReporte(null);
    setPaso("acceso");
  }

  /* --- parcela ------------------------------------------------------- */
  function guardar(p: Parcela) {
    guardarParcela(p);
    setParcela(p);
  }

  function marcarAccion(id: string) {
    const nuevas = acciones.includes(id) ? acciones.filter((x) => x !== id) : [...acciones, id];
    setAcciones(nuevas);
    guardarAccionesHechas(nuevas);
  }

  /* --- render -------------------------------------------------------- */
  if (paso === "cargando") {
    return (
      <div className="cargando" style={{ minHeight: "100dvh" }}>
        <div className="giro" />
        Abriendo Sereno…
      </div>
    );
  }

  if (paso === "acceso") return <Acceso alEntrar={entrar} />;

  if (paso === "codigo") {
    return (
      <ConfirmarCorreo
        correo={correoPendiente}
        alConfirmar={confirmar}
        alVolver={() => setPaso("acceso")}
      />
    );
  }

  const cuerpo = (() => {
    if (vista === "parcela") {
      return (
        <MiParcela
          parcela={parcela}
          altitudMedida={reporte?.datos.punto?.altitudMetros ?? null}
          alGuardar={guardar}
          alCalcular={() => setVista(reporte || parcela ? "resultado" : "hoy")}
        />
      );
    }

    if (vista === "perfil" && sesion) {
      return <Perfil sesion={sesion} parcela={parcela} resultado={reporte} alSalir={salir} />;
    }

    if (vista === "alertas") return <Alertas resultado={reporte} />;

    if (!parcela) {
      return <SinParcela nombre={nombre} alConfigurar={() => setVista("parcela")} />;
    }

    // Mientras no haya reporte: o estamos consultando, o falló de verdad.
    // No se muestra "No disponible" por el hueco entre guardar la parcela y
    // que salga la petición.
    if (!reporte && !errorReporte) {
      return (
        <div className="cargando">
          <div className="giro" />
          Consultando el pronóstico de su parcela…
        </div>
      );
    }

    if (errorReporte || !reporte) {
      return (
        <div className="pantalla">
          <div className="tarjeta seccion">
            <div className="dato dato--vacio" style={{ minHeight: 0 }}>
              <div className="dato__titulo">Riesgo de plaga</div>
              <div className="dato__valor">No disponible</div>
              <div className="dato__pie">
                {errorReporte ?? "No hay reporte."} No hay ningún reporte guardado en este
                teléfono para esta coordenada, así que no hay nada que mostrar todavía.
              </div>
            </div>
            <button
              type="button"
              className="boton boton--principal"
              style={{ marginTop: 12 }}
              onClick={() => void consultar(parcela)}
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    if (vista === "resultado") {
      return (
        <Resultado
          parcela={parcela}
          resultado={reporte}
          costosGuardados={costos}
          alVolver={() => setVista("hoy")}
        />
      );
    }

    return (
      <Hoy
        nombre={nombre}
        parcela={parcela}
        resultado={reporte}
        accionesHechas={acciones}
        alMarcarAccion={marcarAccion}
        alVerResultado={() => setVista("resultado")}
        alIrAParcela={() => setVista("parcela")}
      />
    );
  })();

  return (
    <div className="app">
      <header className="cabecera">
        <div className="cabecera__marca">
          <Gota tam={24} color="var(--niebla)" />
          Sereno
        </div>
        <div className="cabecera__estado">
          <span aria-hidden="true">{enLinea ? "◉" : "◌"}</span>
          {reporte
            ? `${reporte.origen === "red" ? "Actualizado" : "Guardado"} ${marcaDeTiempo(reporte.recibidoEn)}`
            : enLinea
              ? "En línea"
              : "Sin conexión"}
        </div>
      </header>

      {cuerpo}

      <Navegacion
        vista={vista}
        ir={setVista}
        alCalcular={() => setVista(parcela ? "resultado" : "parcela")}
      />
    </div>
  );
}
