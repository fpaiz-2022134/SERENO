# SERENO

**Alerta de ventana de infeccion de roya del cafe, por parcela, con dias de anticipacion.**

Cuando el caficultor ve las manchas anaranjadas en el enves de la hoja, la
infeccion ocurrio hace **25 a 30 dias**: el fungicida aplicado en ese momento es
dinero tirado. Las condiciones que la causan —horas de **hoja mojada** dentro de
un rango de temperatura favorable— **se ven venir en el pronostico**.

> Build & Pitch · Open2.io · UVG · track DeepTech *Del paper al producto*

---

## Lo primero que hay que entender del motor

```
f(T) = ((Tmax-T)/(Tmax-Topt)) · ((T-Tmin)/(Topt-Tmin))^((Topt-Tmin)/(Tmax-Topt))
W(T) = min( Wmin / f(T) , Wmax )
evento  ⇔  horas_mojadas_consecutivas ≥ W(T media de la racha)   Y   no hubo lavado
indice  =  min(1, horas/W(T)) · (lavado ? 0.5 : 1)
```

**Es aritmetica. No hay nada que un modelo pueda alucinar.** El riesgo lo decide
el motor (`src/lib/motor/riesgo.ts`); la IA solo redactaria el aviso en espanol
llano, y hoy ni eso: el aviso lo arma una plantilla determinista
(`src/lib/aviso.ts`). Si la IA falla, el numero sigue siendo correcto.

Modelo: **Magarey, Sutton & Thayer (2005)**, *A Simple Generic Infection Model for
Foliar Fungal Plant Pathogens*, Phytopathology 95(1):92-100,
DOI [10.1094/PHYTO-95-0092](https://doi.org/10.1094/PHYTO-95-0092). Ecuaciones
verificadas contra R4PDE §21.2.1.4 y el codigo del paquete R ZeBook.

Parametros de roya (`src/lib/motor/parametros.ts`): `Tmin=15, Topt=22, Tmax=28,
Wmin=6, Wmax=48`. **Cada constante lleva su fuente en el campo `fuentes`.**
Para agregar un cultivo se cambia **solo esa tabla**, no el motor.

### ⚠️ Lo que este motor NO hace — y hay que decirlo antes de que lo pregunte el jurado

**El conteo de eventos no distingue el año del brote.** Corrido sobre la
coordenada de demo (14.50, −91.15, **912 m**), temporada abril–noviembre:

| Temporada | Eventos | Rachas evaluadas | Descartadas por lavado | Primer evento |
|---|---|---|---|---|
| 2010 | 55 | 361 | 156 | 2010-04-01 |
| 2011 | **72** | 435 | 169 | 2011-04-04 |
| **2012 — año de la emergencia nacional** | **70** | 494 | 178 | 2012-04-06 |
| 2013 | 52 | 479 | 252 | 2013-04-07 |

2011 dio **más** eventos que 2012. En la coordenada fría de Huehuetenango
(15.32, −91.47, 1905 m) el orden es aún peor: 2012 es el año con **menos**
eventos de los cuatro.

**El clima solo no explica un brote.** Hace falta el inóculo, la variedad, la
sombra, la poda y la carga de fruto — los diez datos que aporta el productor
(atributos de ExpeRoya; `supabase/migraciones/0001_esquema_inicial.sql`). El
SENAMHI pone la misma advertencia: su índice vale *«asumiendo que hay suficiente
inóculo en el ambiente»*.

Por eso, en el código y en el pitch:

- ✅ **Sí se puede afirmar:** «la alerta se habría disparado el 6 de abril de 2012,
  semanas antes de que nadie viera una mancha». Es verificable, está arriba.
- ❌ **No se puede afirmar:** «el modelo predice los años de brote». No lo tenemos
  probado y un jurado técnico lo tumba en una pregunta.
- Es **apoyo a la decisión, no un agrónomo.** La última palabra es del productor.

Esa advertencia viaja en el campo `advertencia` de **toda** respuesta de la API
(`ADVERTENCIA_MOTOR` en `src/lib/api.ts`).

### Las dos reglas de lluvia que el prototipo en Python no tenía

1. **Lluvia > 10 mm/día lava las esporas** al suelo y **reduce** el riesgo
   (*H. vastatrix* es parásito obligado). Sin esto el motor sobreestima en
   tormenta. **Pesa mucho:** en la corrida 2013 descartó 252 de 479 rachas.
2. **El óptimo de infección son días con > 5 mm** (`lluviaOptima` en cada evento).

### Huecos declarados del motor

| Hueco | Qué significa |
|---|---|
| **Tabla 2 de Magarey 2005** | No pudimos abrirla (APS da 403). **No podemos confirmar que *H. vastatrix* esté ahí con Wmin/Wmax oficiales.** Nuestros valores son un ensamblado de literatura primaria: APS (cardinales) + Kushalappa 1983 vía Pozza 2021 (Wmin=6). Decirlo así: «parámetros de literatura primaria, no de una tabla única» |
| **Umbral de 0.2 mm/hora** para contar una hora como mojada | **Criterio de implementación nuestro**, no de literatura. Lo respaldado es que hace falta agua libre y que la lluvia la produce |
| **Factor de castigo 0.5** por lavado | La **dirección** del efecto está en ExpeRoya; la **magnitud** es criterio nuestro |
| **Error en horas/día** del método HR ≥ 90 % contra sensor real | El PDF de Sentelhas 2008 no abre. El umbral y el DOI sí están confirmados |

---

## Las seis fuentes · qué quedó funcionando y qué no

Todas se probaron **con peticiones HTTP reales** el 21 de noviembre de 2026.
Ninguna necesita llave. Reproducible con `npm run probar-fuentes`.

### 1 · Open-Meteo — ✅ **integrada, es la fuente del motor**

| | |
|---|---|
| **Pronóstico horario** | `api.open-meteo.com/v1/forecast` · **384 pasos = 16 días**, verificado |
| **Histórico horario** | `archive-api.open-meteo.com/v1/archive` · **desde 1940-01-01**, verificado (1940-01-01 responde 200) |
| Variables | `temperature_2m, relative_humidity_2m, dew_point_2m, precipitation, precipitation_probability, wind_speed_10m` |
| Altitud del punto | **sí la devuelve** — por eso se puede validar una coordenada de demo |
| Llave | **ninguna** |

Es la única de las tres APIs de clima probadas que da histórico horario **y**
pronóstico horario **y** punto de rocío, en la misma forma. Módulo:
[`src/lib/fuentes/open-meteo.ts`](src/lib/fuentes/open-meteo.ts).

El módulo **marca con un aviso** toda serie cuya celda esté arriba de 1700 m:
ahí sale fría, `W(T)` se infla y el motor exige rachas larguísimas.

> **Hueco:** no encontramos la página de límites de uso del plan gratuito. Lo que
> sabemos es que las llamadas corren sin llave ni registro. **Ojo para el demo:**
> probándola hoy intensivamente llegó a devolver `fetch failed` por un rato.
> **Cachear antes del pitch, no llamar en vivo.**

### 2 · MET Norway / yr.no — ✅ **integrada como segunda opinión. NO alimenta el motor**

| | |
|---|---|
| Endpoint | `api.met.no/weatherapi/locationforecast/2.0/compact` |
| Alcance | **89 pasos ≈ 9.5 días**, verificado |
| Punto de rocío | **no lo tiene.** Lo derivamos con Magnus-Tetens y lo marcamos como derivado |
| Histórico | **no tiene** |
| Precipitación | en `next_1_hours.precipitation_amount` |
| Llave | ninguna, pero **exige User-Agent identificable** |

El `User-Agent` es la URL pública del repo (`src/lib/fuentes/base.ts`): **sin
correo ni datos personales de nadie.** El módulo respeta la cabecera `Expires`
que devuelve met.no y la usa como TTL de caché.

**Queda descartada para el motor** —sin punto de rocío y sin histórico— y se usa
solo para comparar: `/api/clima?...&comparar=1`.

### 3 · GDELT DOC 2.0 — ⚠️ **integrada y funcional. NO hay cobertura de roya**

| | |
|---|---|
| Endpoint | `api.gdeltproject.org/api/v2/doc/doc` |
| Límite | **1 petición cada 5 s** (devuelve HTTP 429 con ese texto). El módulo serializa con 5.5 s y cachea 30 min |
| Ventana | DOC 2.0 cubre poco hacia atrás: el módulo pide **3 meses** |
| Dedup | por URL y por título normalizado; Guatemala y Centroamérica suben en el orden |

**El veredicto, con las consultas ya corregidas y respuesta HTTP 200:**

| Tema | Artículos |
|---|---|
| `roya` | **0** |
| `broca` | **0** |
| `ojo_de_gallo` | **0** |
| `sequia` | **0** |
| `precio_cafe` | pendiente de confirmar |
| `exportaciones` | pendiente de confirmar |

**Esto descarta las dos explicaciones fáciles**, y por eso se puede afirmar:

- **No es la sintaxis.** Las consultas corregidas son válidas y GDELT las aceptó
  con 200. Lo que sí aprendimos: los `OR` **van entre paréntesis** o responde en
  texto plano (`"Queries containing OR'd terms must be surrounded by ()."`), y las
  **frases exactas** (`"roya del cafe"`, `"coffee leaf rust"`) no traen nada, así
  que las consultas usan términos sueltos en AND.
- **No es nuestra IP.** El 429 aparece y desaparece entre intentos, pero cuando la
  petición pasa, pasa con **200 y cero resultados**. La consulta de control
  `query=guatemala&timespan=1week` devolvió **5 artículos**, uno de
  `prensalibre.com` sobre la oferta de café de Guatemala: la fuente funciona.
- **Tampoco es el término suelto.** `roya` sin `cafe` sí devuelve algo, pero es
  ruido (un artículo de cine). Por eso ningún tema de enfermedad consulta sin el
  término del cultivo, y hay una prueba que lo exige.

> ## 📰 **Lo que hay que decir en el pitch**
>
> **GDELT no tiene cobertura de roya, broca ni ojo de gallo del café en los
> últimos 3 meses.** El módulo funciona, la fuente responde, y no hay noticias que
> traer. Es un hueco **de la fuente**, no un bug nuestro.
>
> Por lo tanto: **la feature #5 (mapa de brotes por noticias) queda fuera del
> MVP** y no se promete. El panel dice «esta fuente no devolvió nada» en vez de
> quedarse en blanco.
>
> Un hueco declarado es útil. Mostrar un mapa de brotes vacío en el demo, no.

Invariantes que el módulo cumple, y que además están **en la base de datos** como
`check` (`0002_rls.sql` no da permiso de escritura, y `0001` fuerza
`es_veredicto = false`): una noticia **nunca** es veredicto del motor, y una
noticia de precios **nunca** es una cotización (`noEsCotizacion: true`).

### 4 · NASA POWER — ✅ **integrada como respaldo histórico**

| Endpoint | Rango **verificado con petición real** |
|---|---|
| `temporal/hourly/point` | **desde 2001-01-01.** 1990 → HTTP 422 *«The data starts at 2001/01/01»* |
| `temporal/daily/point` | **desde 1981-01-01.** 1981-01-01 → 200 con datos; 1980-01-01 → HTTP 422 *«The data starts at 1981/01/01»* |

El rango del endpoint diario **lo verificamos nosotros**, como pedía el brief: no
está prometido de memoria. Devuelve la altitud en `geometry.coordinates[2]`
(1884 m en Huehuetenango). **No tiene pronóstico**, por eso es respaldo y no
fuente del aviso.

Vale como argumento: es la fuente del paper ancla de Brasil (Aparecido et al.,
*Theor. Appl. Climatol.* 157:456, DOI
[10.1007/s00704-026-06384-8](https://doi.org/10.1007/s00704-026-06384-8)), cuyo
resumen dice que usó *«open-access meteorological data from the NASA-POWER
system»*.

Viene en **UTC** y Open-Meteo en hora local: el módulo lo avisa y el endpoint
`/api/historico?...&respaldo=1` compara los conteos **como orden de magnitud, no
uno a uno**.

### 5 · Anacafé / CEDICAFÉ — ✅ **integrada. No hay API; se lee un índice público**

**No hay API REST.** Lo que sí hay, y lo verificamos:

| Probado | Resultado |
|---|---|
| `www.anacafe.org/Servicios/Cedicafe/Boletines` | **HTTP 200, ~72 KB, 137 enlaces a PDF públicos** con título y mes en el texto del enlace |
| `www.anacafe.org/robots.txt` | **404** — el sitio no publica política de robots |
| URLs de PDF | **200, `application/pdf`** |
| `/cedicafe`, `/boletines`, `/publicaciones` | **404** — esas rutas de la especificación no existen |

El importador lee **esa única página de índice** y extrae título, periodo
(`YYYY-MM`), URL y tema, con buscador por enfermedad. Probado: encuentra los
boletines mensuales *Reporte de Roya y Recomendaciones* hasta **octubre de 2026**.
En la corrida completa extrajo **149 documentos**: 74 de roya, 17 de broca, 8 de
poda y tejido, 5 de fertilización, 4 de variedades, 3 de ojo de gallo, 1 de clima.

**Lo que a propósito NO hace:** no rastrea el sitio, no descarga ni redistribuye
los PDF (`urlDocumento` apunta al PDF oficial de Anacafé) y no extrae su texto
para «resumirlos». El contenido es de Anacafé.

**Limitación declarada:** sin API, el formato de esa página puede cambiar sin
aviso. Por eso `DOCUMENTOS_DE_REFERENCIA` guarda enlaces públicos verificados a
mano como respaldo.

### 6 · MAGA vía `catalogo.senacyt.gob.gt` (CKAN) — ✅ **integrada, con una limitación grande**

Es CKAN, así que los CSV se descubren por API, no a mano:

| Endpoint | Resultado verificado |
|---|---|
| `/api/3/action/package_search?q=precios` | 200 · **2 datasets del MAGA** |
| `/api/3/action/package_show?id=…` | 200 · lista de recursos con sus URL |
| `/api/3/action/organization_list` | 200 |

Datasets: *Precios al mayorista…* (**127 recursos**, licencia CC0) y *Precios
Promedio Mensual…* (9 recursos). El módulo baja el CSV más reciente y lo parsea.

> ## ☕ **EL CAFÉ NO APARECE EN LOS CSV DEL MAGA**
>
> Verificado en el CSV de **agosto 2026, 203 filas**: ni una sola de café.
> El MAGA publica precios **mayoristas de mercados terminales** (CENMA, La
> Terminal) y el café no se vende ahí: va a beneficio o exportador.
>
> **El cacao sí aparece:** `Cacao (Despulpado), seco, de primera`, quintal,
> **GTQ 2,500.00**, La Terminal, mayorista, 2026-08-01.
>
> Por eso `/api/mercado` devuelve `cafe.disponible: false` con el motivo escrito,
> y **no lo rellena con el contrato C de Nueva York**: un precio internacional no
> es un precio nacional, y un **precio mayorista no es un precio al productor en
> finca**. Eso último viaja como aviso en toda respuesta de precios.

El módulo marca el dato como viejo si pasa de 45 días (los precios son
mensuales): el CSV más reciente del catálogo es de **agosto 2026**, publicado en
noviembre.

### Lo que toda fuente registra

Cada respuesta viene envuelta en `Procedencia`: **`fuente`, `url` exacta
consultada, `fechaPublicacion`, `ultimaConsulta`, `esPronostico` y `avisos`**.
Las llamadas salen **siempre del servidor**; ninguna credencial toca el frontend.
Si un dato está viejo, se ve.

---

## La API

| Endpoint | Panel | Qué devuelve |
|---|---|---|
| `GET /api/clima?lat&lon&dias&comparar=1` | **climático** | pronóstico 16 d, curva de riesgo diaria, eventos, parámetros con sus fuentes, segunda opinión de met.no |
| `GET /api/prevencion?lat&lon&parcela&ultimaAplicacion` | **prevención** | los 5 datos que cambian una decisión + el aviso redactado + boletines de Anacafé de roya |
| `GET /api/mercado?noticias=1` | **mercado** | precios del MAGA (con el `cafe.disponible:false`) y noticias de GDELT |
| `GET /api/historico?lat&lon&anio&respaldo=1` | la corrida hacia atrás | eventos sobre la temporada histórica. `esPronostico: false` explícito |
| `GET /api/fuentes?probar=1&lat&lon` | diagnóstico | ficha de las seis fuentes y, con `probar=1`, una petición real a cada una |

### ⚠️ Observación de la corrida de hoy, para antes del pitch

En la coordenada de demo (912 m, noviembre), el pronóstico de 16 días da
**19 rachas, 8 eventos confirmados** y la ventana de acción **abarca los 16 días
completos**: el índice queda ≥ 0.5 todos los días. El motor está diciendo la
verdad —a esa altura y con esa humedad las condiciones son favorables de forma
casi continua— pero entonces la frase «aplicá antes del jueves» pierde filo,
porque no hay un «jueves» que destaque.

**Qué hacer, y es decisión de producto, no de código:** para el demo, o se elige
una coordenada/temporada donde la ventana sea un tramo corto y claro, o se sube
la banda del aviso (por ejemplo avisar solo en `muy_favorable`, ≥ 0.75, en vez de
`favorable`, ≥ 0.5). El umbral de la ventana está en un solo lugar
(`ventanaDeAccion` en `src/lib/motor/riesgo.ts`). **No tocarlo sin decidirlo:**
subirlo hace el aviso más útil pero pierde eventos reales.

Los cinco datos de `/api/prevencion` son los de la investigación §0A: ventana de
acción con fecha · índice 0-1 en tres bandas (las del SENAMHI: 0–0.5 poco
favorable, 0.5–0.75 favorable, 0.75–1 muy favorable) · horas de mojado
acumuladas vs. requeridas · fecha en que se verían las manchas · días desde la
última aplicación y si el último evento quedó cubierto.

**Salida real del endpoint**, coordenada de demo, 21 nov 2026:

> *Finca El Sereno: del domingo 22 de noviembre al domingo 29 de noviembre se
> juntan las condiciones de infección de roya en tu parcela. Aplica antes del
> sábado 21 de noviembre. Se juntan 8 horas de hoja mojada y hacen falta 7 a 19.1
> grados. Si esperas a ver las manchas ya perdiste: de una infección de estos
> días las manchas se verían entre el 17 de diciembre y el 22 de diciembre. Esto
> es apoyo a la decisión, no un agrónomo: la última palabra es tuya.*

---

## Base de datos

**Está en Neon** (proyecto `sereno`, Postgres 17, us-east-1), pero el esquema es
**Postgres puro**: no usa ninguna extensión ni esquema de un proveedor, así que
la misma migración corre en Neon, en Supabase o en un Postgres local.

Migraciones en [`db/migraciones/`](db/migraciones/), aplicadas con
`npm run migrar`, que lleva su propio registro en `public.migraciones` y mete
cada archivo en una transacción:

| Migración | Qué trae |
|---|---|
| `0001_esquema_inicial.sql` | 13 tablas: usuarios, productores, parcelas con GPS y altura, los **diez datos del productor** (atributos de ExpeRoya), series horarias cacheadas, eventos de infección, avisos, documentos de Anacafé, noticias y precios |
| `0002_rls.sql` | RLS en todas. Un productor ve solo sus parcelas |
| `0003_eventos_sin_duplicados.sql` | índice único para que reprocesar la misma serie no duplique eventos |

### Cómo funciona el RLS sin `auth.uid()`

Eso es de Supabase; aquí la identidad viene de una **variable de sesión** que el
backend pone al abrir la transacción:

```sql
SET LOCAL sereno.usuario_id = '<uuid>';
```

`SET LOCAL` es deliberado: muere al terminar la transacción, así que la identidad
no se filtra a la siguiente petición del pool.

**Y hay dos roles, que es la parte que importa:**

| Rol | Quién es | RLS |
|---|---|---|
| `sereno_owner` (dueño) | corre migraciones, el motor, guarda series, escribe las fuentes externas | **lo salta** (en Postgres el dueño de la tabla salta RLS) |
| `sereno_app` | atiende las peticiones de un productor | **se le aplica** |

> Si alguien atiende peticiones de usuario con la conexión de servicio, **el RLS
> deja de servir sin que salte ningún error**. Por eso son dos funciones distintas
> en [`src/lib/db.ts`](src/lib/db.ts) (`conexionServicio()` y `comoProductor()`) y
> no un parámetro, y por eso está escrito también dentro de `0002_rls.sql`.

### Verificado contra la base real, no asumido

`npm run probar-rls` crea dos productores, comprueba el aislamiento y borra lo
que creó. Corrido contra Neon:

```
✓ Ana ve 1 parcela y es la suya                              — vio 1: Parcela de Ana
✓ Ana no ve el reporte de incidencia de Beto                 — vio 0
✓ Ana si lee el contenido publico (variedades)               — vio 10
✓ Beto ve 1 parcela y es la suya                             — vio 1: Parcela de Beto
✓ Ana no puede editar la parcela de Beto                     — afecto 0 filas
✓ Ana no puede robarse la parcela de Beto cambiando el productor_id
✓ La app NO puede escribir las fuentes externas (noticias)
✓ Un usuario desconocido no ve ninguna parcela               — vio 0
✓ Los datos de prueba quedaron borrados (cascada)            — quedan 0
```

**Y el guardado funciona de punta a punta.** `/api/historico?...&guardar=1` sobre
mayo de 2012 escribió **60 filas** en `eventos_infeccion`, 4 de ellas eventos
confirmados y 27 descartadas por lavado de lluvia. Cada fila guarda **los
parámetros con que se calculó**, así que es reproducible: el motor es
determinista. Llamarlo dos veces deja 60 filas, no 120.

**Nada de llaves en el repo.** `.env.local` está en `.gitignore`; la plantilla es
[`.env.example`](.env.example). `npm run crear-rol-app` genera la contraseña de
`sereno_app`, la escribe solo en `.env.local` y **no la imprime**.

---

## El frontend · la PWA

La app que ve el productor vive en `/` y es una **PWA instalable que abre sin
conexión**. Es una sola página de Next (`src/app/page.tsx` → `src/componentes/App.tsx`)
con las pantallas en estado del cliente, a propósito: así el service worker
cachea **un** documento y la app abre completa en modo avión.

```
src/app/globales.css     los tokens de docs/branding.md, en un solo archivo
src/componentes/         App (armazon) · Logo+Medidor · Navegacion · Avisos · MapaParcela
src/pantallas/           Acceso · SinParcela · Hoy · MiParcela · Resultado · Alertas · Perfil
src/lib/ui/              tipos · riesgo (banda → color+palabra) · fechas · almacen · red
public/manifest.webmanifest  public/sw.js  public/icono*.png
```

Las seis pantallas son las de las láminas 7, 8 y 9 del branding, con la paleta,
las tipografías (Playfair Display · DM Sans · IBM Plex Mono), los radios y la
navegación flotante de cinco de la lámina 10.

### Todo lo que muestra sale de `/api/prevencion`

Una sola llamada por parcela. Nada de datos simulados: la curva, la ventana, las
horas de mojado, la altitud (912 m en la coordenada de demo) y el texto de
WhatsApp vienen del endpoint. El botón de WhatsApp comparte `aviso.texto` tal
como lo redactó `src/lib/aviso.ts`, con el total de costos que el productor
escribió y la procedencia al pie.

Para la tarjeta de temperatura/humedad/lluvia el frontend necesitaba la hora
actual, que el motor no exponía. Se agregó `condicionesActuales()` en
`src/lib/api.ts` y el campo **`ahora`** a `/api/clima` y `/api/prevencion`: sale
de la misma serie horaria de Open-Meteo, viaja con `esEstimacion: true` y la UI
lo rotula «estimación meteorológica, no una medición en su finca». El motor no
se tocó.

> **Tensión declarada.** `SERENO-investigacion.md` §0A sostiene que temperatura,
> humedad y lluvia crudas **no** deberían ir en el panel porque «son insumos, no
> decisiones». El branding sí las pide como datos 2, 3 y 4. Se siguió el
> branding, que es la decisión más nueva del equipo, pero esos tres datos van
> **debajo** del dato 1 (el riesgo con su ventana) y rotulados como estimación.

### Los estados honestos, implementados de verdad

| Regla del branding | Dónde está |
|---|---|
| «No disponible» **y qué falta**, nunca un cero | `DatoVacio` en `src/componentes/Avisos.tsx`; pantalla `SinParcela` completa |
| Sin conexión: el último reporte **con su fecha** | `pedirConRespaldo()` en `src/lib/ui/red.ts` devuelve `origen: "cache"` y `recibidoEn`; `AvisoSinConexion` pinta «Viendo el reporte del sáb 21 nov, 12:57» |
| «Estimación meteorológica. No es una medición en su finca.» | `AvisoEstimacion`, en Hoy |
| «Open-Meteo para su municipio · no medido en la finca» | `Procedencia_`, con la hora real de consulta y la altitud de la celda |
| Riesgo = **color + palabra**, siempre | `src/lib/ui/riesgo.ts`: `poco_favorable`→Calma/olivo, `favorable`→Atención/miel, `muy_favorable`→Alerta/cedro. Uno a uno con `bandaDeIndice()` |
| Costos: «no es una recomendación automática» | pantalla `Resultado`; los montos van **vacíos** porque no sabemos cuánto vale el jornal en su municipio |

**El service worker no cachea `/api/*` a propósito.** El último reporte lo
guarda la app en `localStorage` con su fecha, y la pantalla la enseña. Un dato
viejo servido en silencio por el service worker sería un dato viejo disfrazado
de fresco.

### Lo que el branding promete y la UI no finge tener

- **Cinco cultivos.** Solo café tiene umbrales verificados. Los chips de maíz,
  frijol, cardamomo y hortalizas están **deshabilitados y dicen «próximamente»**
  (`CULTIVOS` en `src/lib/ui/almacen.ts`), y si una parcela quedara con otro
  cultivo, la tarjeta de riesgo dice «No disponible» con el motivo.
- **INSIVUMEH.** No está integrado y **no aparece** en ninguna pantalla. El
  Perfil lo dice explícitamente.
- **Mapa de brotes por noticias.** Fuera del MVP: GDELT devuelve cero artículos
  de roya. No hay sección de noticias.
- **Notificaciones push.** No hay. La pantalla de Alertas lo dice: el canal es
  WhatsApp y el mensaje se manda desde «Resultado».

### Autenticación — real, contra Postgres

**Hay cuentas de verdad.** Registro, acceso y sesión, contra la misma base de
Neon, sin dependencias nuevas:

| Pieza | Dónde | Qué hace |
|---|---|---|
| `db/migraciones/0004_cuentas_y_sesiones.sql` | Neon | `usuarios.contrasena_hash`, tabla `sesiones`, índice único de `lower(correo)`, `parcelas.lugar` |
| `src/lib/auth.ts` | servidor | scrypt de `node:crypto` (cero dependencias), sesiones, cookie, freno a la fuerza bruta |
| `/api/cuenta`, `/api/cuenta/registro`, `/api/cuenta/acceso`, `/api/cuenta/salir` | servidor | el ciclo completo |
| `src/lib/parcelas.ts` + `/api/parcelas` | servidor | las parcelas, **siempre** por `comoProductor()` |

**Dos cosas que no se guardan nunca.** La contraseña: se guarda
`scrypt(contraseña, sal)` con sal aleatoria por usuario. Y el token de sesión:
se guarda su SHA-256. Quien se lleve la tabla `sesiones` no entra con nada de
lo que hay ahí, porque el token original solo vive en la cookie `HttpOnly` del
teléfono — donde el JavaScript de la página tampoco lo alcanza.

Detalles que importan y están en el código: el correo es único **sin distinguir
mayúsculas**; «correo que no existe» y «contraseña mala» devuelven el mismo
mensaje y tardan parecido, porque la diferencia regalaría una lista de qué
correos tienen cuenta; y comparar hashes es `timingSafeEqual`, no `===`.

> **Lo que todavía no hay: verificación de correo.** No hay proveedor de correo
> configurado, así que **no se manda ningún código** — y por eso tampoco hay una
> pantalla que finja mandarlo. La cuenta queda usable de una vez. Con una llave
> de un proveedor (Resend, SMTP) el paso se agrega de verdad.

`usuarios.sujeto_externo` queda libre: el día que se conecte Neon Auth o Clerk,
se llena esa columna y conviven las dos formas de entrar.

### El RLS, por fin usado de verdad

Las parcelas ya no viven en el teléfono: están en Postgres y **toda** consulta
de usuario pasa por `comoProductor()`, o sea por el rol `sereno_app`, al que el
RLS **sí** se le aplica. Varias consultas de `src/lib/parcelas.ts` ni siquiera
llevan `where productor_id`: no es un descuido, es que la policy ya lo puso.

Comprobado con dos cuentas reales contra Neon:

```
Ana crea su parcela                              → 201
Beto se registra y lista sus parcelas            → 0
Beto intenta EDITAR la parcela de Ana            → 404
Beto intenta BORRAR la parcela de Ana            → 404
Ana la sigue viendo intacta                      → 1
Sin sesión                                       → 401
```

Es **404 y no 403** a propósito: un 403 confirmaría que esa parcela existe y es
de alguien.

### Sin conexión, ahora que la cuenta está en el servidor

Esto se rompía solo: si la cuenta vive en el servidor, **sin señal la app no
puede preguntar quién entró**, y el productor vería la pantalla de acceso en vez
de su reporte. Por eso se guarda en el teléfono una **instantánea** de lo último
que dijo el servidor —correo, nombre y parcelas, nunca el token— y se usa
**solo** cuando la petición falla por red. Si el servidor responde que no hay
sesión, manda el servidor. En modo copia la pantalla lo dice y los campos de la
parcela quedan de solo lectura, en vez de fingir que guardan.

### El mapa: se arrastra con el dedo

Escribir una latitud y una longitud a mano es inusable en el campo. Hay tres
caminos al mismo punto, de más fácil a más preciso:

1. **Buscar el municipio o la aldea.** `/api/lugares` consulta el
   geocodificador de **Open-Meteo** — la misma casa que da el pronóstico, así
   que no se agrega fuente ni llave nueva. La llamada sale del servidor.
2. **«Estoy parado en mi parcela»**, que usa el GPS del teléfono.
3. **Arrastrar el mapa**, con la mira fija en el centro: lo que queda debajo de
   la mira es la parcela. Es mejor que «tocar el punto» porque el dedo no tapa
   justo lo que se quiere apuntar.

La coordenada escrita a mano sigue ahí, plegada, para quien de verdad la tenga.

El mapa son teselas de OpenStreetMap colocadas a mano y un puñado de cuentas de
Mercator (`src/componentes/MapaParcela.tsx`): **sin librería de mapa, sin llave
y sin JavaScript de terceros.** Leaflet pesa 40 KB para un productor con señal
intermitente. El service worker cachea las teselas; sin conexión queda el fondo
con la coordenada escrita.

> **Ojo con la altitud:** el geocodificador devuelve la del pueblo, no la de la
> celda del pronóstico. Se descarta. La que manda para el motor es la que
> devuelve `/api/prevencion`, y es la que se guarda en la parcela.

### Comprobado corriendo, no asumido

- `npm run build` y `npm test` (41 pruebas) pasan.
- Recorrido completo en viewport de 375×812: Acceso → código → Sin parcela →
  Mi parcela → Hoy → Resultado → Alertas → Perfil, contra los endpoints reales.
- **Sin conexión de verdad:** con el servidor apagado (`pkill next-server`), la
  app recargó completa desde el service worker y mostró «No se pudo actualizar.
  Viendo el reporte del sáb 21 nov, 12:57» con todos los datos del último
  reporte.
- Service worker activo y controlando la página, 15 entradas en caché, manifest
  servido desde la caché estando el servidor caído.

### Lo que queda pendiente

- **La ventana de acción abarca los 16 días** en la coordenada de demo, así que
  «aplique antes del viernes 20» cae **en el pasado**. Es la observación que ya
  traía este README. La UI **no maquilla la fecha**: cuando el límite ya pasó,
  el Resultado dice «La ventana ya empezó» y explica qué queda por hacer. Subir
  la banda del aviso a `muy_favorable` sigue siendo decisión de producto, no de
  código.
- Las parcelas viven en el teléfono, no en Postgres. El esquema y el RLS están
  listos; falta la identidad para poder escribir como productor.


## Cómo correrlo

```bash
npm install
npm test                 # 20 pruebas del motor
npm run build            # compila sin errores
npm run dev              # http://localhost:3000
```

```bash
npm run probar-fuentes               # las 6 fuentes con peticiones reales
npm run corrida-historica            # 2010-2013 en la coordenada de demo
```

Con base de datos:

```bash
npm run migrar                       # aplica las migraciones que falten
npm run crear-rol-app                # crea sereno_app y escribe DATABASE_URL_APP
npm run probar-rls                   # comprueba el aislamiento contra la base real
```

### La coordenada de demo

**14.50, −91.15 → 912 m**, verificado con la API. Es la **única** de 25
coordenadas probadas en el altiplano y el piedemonte que cayó en el rango de
900–1400 m que recomienda la investigación. Ahí las temperaturas de las rachas
caen en 19–24 °C, `W(T)` baja a 6–7 h y el motor dispara. Con el punto de
Huehuetenango (1905 m) el demo se ve pobre.

Verificar siempre la altura antes de fijar una coordenada:

```bash
curl "http://localhost:3000/api/fuentes?probar=1&lat=14.50&lon=-91.15"
```

---

## Estructura

```
src/lib/motor/
  parametros.ts   tabla de constantes con su fuente — lo único que cambia por cultivo
  riesgo.ts       el motor: Magarey, mojado foliar, lavado, eventos, ventana
  tipos.ts        tipos, incluida Procedencia
src/lib/fuentes/
  base.ts         fetch con timeout, User-Agent, caché, Procedencia, avisos de dato viejo
  open-meteo.ts met-norway.ts gdelt.ts nasa-power.ts anacafe.ts maga-precios.ts
src/lib/aviso.ts  redacción determinista del mensaje de WhatsApp
src/lib/db.ts     Postgres: rol de servicio vs. rol con RLS, guardado de eventos
src/app/api/      clima · prevencion · mercado · historico · fuentes
db/migraciones/   0001 esquema · 0002 RLS · 0003 sin duplicados
scripts/          probar-fuentes · corrida-historica · migrar · crear-rol-app · probar-rls
tests/motor.test.ts
```

## Pruebas del motor

20 pruebas en `tests/motor.test.ts`, incluidas las obligatorias: `f(Topt) === 1`,
`f(T) === 0` fuera del rango, una racha de **8 h a 19.6 °C dispara** evento
(W = 7.0 h), una racha de **5 h no**, y el **lavado por lluvia** (12 h mojadas
con 24 mm/día: alcanza el umbral de Magarey pero `esEvento: false` e índice 0.5).

## Fuentes científicas

Todo número del motor lleva su enlace en el campo `fuentes` de
`src/lib/motor/parametros.ts`. Los dos papers ancla y la investigación completa
—con los huecos declarados— están en `SERENO.md` y `SERENO-investigacion.md`.
