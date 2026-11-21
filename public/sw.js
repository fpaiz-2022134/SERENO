/**
 * Service worker de SERENO.
 *
 * El productor tiene señal intermitente, así que la regla es:
 *
 *  - El armazón de la app (documento, CSS, JS, fuentes, iconos) se sirve de la
 *    caché primero. Abre sin conexión, siempre.
 *  - Las llamadas a /api/* van a la red primero y NO se sirven de caché aquí:
 *    el último reporte lo guarda la app en localStorage CON SU FECHA, y la
 *    pantalla dice «Viendo el reporte del sáb 21 nov, 11:30». Un dato viejo
 *    servido en silencio por el service worker sería un dato viejo disfrazado
 *    de fresco, y eso es justo lo que no queremos.
 *  - Las teselas del mapa se cachean cuando pasan: si no hay red, el mapa se
 *    degrada al patrón de curvas de nivel con la coordenada escrita.
 */

const VERSION = "sereno-v2";
const ARMAZON = `${VERSION}-armazon`;
const MAPAS = `${VERSION}-mapas`;

const BASICOS = ["/", "/manifest.webmanifest", "/icono.svg", "/fotos/cafetal.jpg"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(ARMAZON)
      .then((c) => c.addAll(BASICOS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** ¿Es parte del armazón que debe abrir sin conexión? */
function esArmazon(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname === "/" ||
      url.pathname === "/manifest.webmanifest" ||
      url.pathname.startsWith("/icono") ||
      // Las fotos del cafetal y de la hoja con roya: son parte de la app, no
      // un dato. Sin ellas la pantalla se entiende, pero con ellas se lee
      // mejor, asi que se cachean con el armazon.
      url.pathname.startsWith("/fotos/"))
  );
}

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;

  const url = new URL(peticion.url);

  // Las respuestas de la API nunca se sirven desde el service worker.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Teselas del mapa: caché primero, se rellena con lo que pase por la red.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    evento.respondWith(
      caches.open(MAPAS).then(async (cache) => {
        const guardada = await cache.match(peticion);
        if (guardada) return guardada;
        try {
          const r = await fetch(peticion);
          if (r.ok) cache.put(peticion, r.clone());
          return r;
        } catch {
          return Response.error();
        }
      }),
    );
    return;
  }

  if (!esArmazon(url)) return;

  // Documento: red primero (para traer la versión nueva), caché si falla.
  if (peticion.mode === "navigate") {
    evento.respondWith(
      (async () => {
        try {
          const r = await fetch(peticion);
          const cache = await caches.open(ARMAZON);
          cache.put("/", r.clone());
          return r;
        } catch {
          const cache = await caches.open(ARMAZON);
          return (await cache.match("/")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Estáticos con huella: caché primero, son inmutables.
  evento.respondWith(
    (async () => {
      const cache = await caches.open(ARMAZON);
      const guardada = await cache.match(peticion);
      if (guardada) return guardada;
      try {
        const r = await fetch(peticion);
        if (r.ok) cache.put(peticion, r.clone());
        return r;
      } catch {
        return Response.error();
      }
    })(),
  );
});
