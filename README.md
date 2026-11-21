# SERENO · backend

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

### 3 · GDELT DOC 2.0 — ⚠️ **integrada y funcional; las consultas de roya no traen cobertura**

| | |
|---|---|
| Endpoint | `api.gdeltproject.org/api/v2/doc/doc` |
| Límite | **1 petición cada 5 s** (devuelve HTTP 429 con ese texto). El módulo serializa con 5.5 s y cachea 30 min |
| Temas | roya, broca, ojo de gallo, sequía, precio del café, exportaciones |
| Dedup | por URL y por título normalizado; Guatemala y Centroamérica suben en el orden |

**La API funciona — eso está probado.** Consulta de control
`query=guatemala&timespan=1week`: **5 artículos**, entre ellos uno de
`prensalibre.com` sobre la oferta de café de Guatemala. Así que cuando una
consulta devuelve 0, **no es que la fuente esté caída**.

**Lo que no trae nada son las frases exactas.** `"roya del cafe"`,
`"roya del café"`, `"coffee leaf rust"` y `"precio del café"` devolvieron
**0 artículos** en ventanas de 1 semana a 24 meses. Y el término `roya` solo, sin
`cafe`, trae ruido (devolvió un artículo de cine).

Lo que aprendimos y ya está corregido en el módulo:

- Los términos con `OR` **van entre paréntesis** o la API responde en texto plano:
  `"Queries containing OR'd terms must be surrounded by ()."`
- Las consultas ahora usan **términos sueltos en AND** (GDELT los une con AND
  implícito) y la frase exacta solo como alternativa del `OR`:
  `(roya OR "coffee leaf rust" OR "Hemileia vastatrix") (cafe OR café OR coffee)`.
  Ningún tema de enfermedad va sin el término del cultivo, por el ruido.
- **DOC 2.0 cubre una ventana reciente**: pedir `timespan=24months` no sirve. El
  valor por defecto del módulo bajó de 12 a **3 meses**.

> **Queda sin confirmar, y hay que decirlo así:** las consultas corregidas **no
> se pudieron probar** porque de tanto probar la API durante el día nuestra IP
> quedó en HTTP 429. **Volver a correr `npm run probar-fuentes` en frío** para
> separar «sin cobertura» de «IP limitada».
>
> **Para el pitch: no prometer el mapa de brotes por noticias.** El módulo está
> listo y el panel dice «esta fuente no devolvió nada» en vez de quedarse en
> blanco, pero todavía no tenemos una sola noticia de roya en la mano.

Invariantes que el módulo cumple, y que además están **en la base de datos** como
`check` (`0001_esquema_inicial.sql`): una noticia **nunca** es veredicto del
motor (`es_veredicto = false` forzado), y una noticia de precios **nunca** es una
cotización (`noEsCotizacion: true`).

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

## Supabase

Migraciones en [`supabase/migraciones/`](supabase/migraciones/):

- **`0001_esquema_inicial.sql`** — productores, parcelas con GPS y altura, los
  **diez datos del productor** (atributos de ExpeRoya: incidencia, variedad,
  aplicaciones, sombra, poda, carga de fruto, floración, cosecha, fertilización),
  series horarias cacheadas, eventos de infección calculados, avisos, documentos
  de Anacafé, noticias y precios.
- **`0002_rls.sql`** — RLS activado en las 12 tablas. **Un productor ve solo sus
  parcelas** y lo que cuelga de ellas.

**Verificado de verdad**, no asumido: las dos migraciones se aplicaron contra un
Postgres 16 local (con `auth.users` y los roles de Supabase simulados) y se probó
el aislamiento con dos usuarios:

```
Como Ana  → parcelas visibles: 1   (0 de Beto)   variedades: 10 (público)
Como Beto → parcelas visibles: 1
authenticated INSERT en noticias        → ERROR: violates row-level security policy
authenticated UPDATE de parcela ajena   → UPDATE 0
```

El contenido público (variedades, documentos, noticias, precios, series) es de
**lectura** para autenticados y **sin ninguna policy de escritura**: solo el
`service_role` del backend escribe las fuentes externas.

**Nada de llaves en el repo.** `.env.local` está en `.gitignore`; la plantilla es
[`.env.example`](.env.example). El backend **funciona sin Supabase**: clima,
prevención, mercado e histórico corren contra las APIs públicas.

### ⛔ Lo que falta y necesita al usuario

**Las migraciones no se han aplicado a un proyecto de Supabase real** porque no
tenemos credenciales. Hace falta `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.

---

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
src/app/api/      clima · prevencion · mercado · historico · fuentes
supabase/migraciones/
scripts/          probar-fuentes.ts · corrida-historica.ts
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
