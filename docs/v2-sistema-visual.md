# SERENO v2 · «Luz de cafetal»

Segunda versión visual de la PWA, en la rama `frontend/pwa-v2`. Mismo backend,
mismos endpoints, mismas utilidades de cliente: **solo cambia la capa de
presentación**.

## De dónde sale

De dos referencias que el equipo eligió: una app de agricultura oscura con
fotografía a sangre y un gauge de arco, y una clara con tarjetas blancas,
pastillas de estado e iconos en círculos teñidos. Lo que las hace sentir
humanas y no de plantilla es, en este orden:

1. **Fotografía real.** Una app de campo sin una sola foto del campo se siente
   de oficina.
2. **Tarjetas blancas flotando sobre verde claro**, sin bordes: lo que separa
   es el aire y una sombra suave.
3. **Pastillas de estado** con color y palabra.
4. **Iconos pequeños dentro de círculos teñidos**, nunca sueltos.
5. **Números grandes con su unidad pequeña al lado.**
6. **Un gauge de arco** que pone el número en una escala.
7. **Navegación flotante** con el botón de acción al centro.

## Paleta

Una sola familia. El verde es el fondo del producto porque el producto vive
entre plantas; el riesgo son tres tonos naturales de la misma familia.

| Token | Hex | Para qué |
|---|---|---|
| `--fondo` | `#e9f1ea` | el lienzo |
| `--nube` | `#ffffff` | tarjetas, campos |
| `--musgo` | `#e8f1e9` | superficies hundidas, rieles |
| `--hoja-honda` | `#14301e` | texto principal (verde muy oscuro, **no negro**) |
| `--hoja-media` | `#2f5d3f` | títulos secundarios, iconos |
| `--hoja-clara` | `#3c8f5a` | acento vivo |
| `--tinta-2` | `#637a69` | texto secundario |
| `--tinta-3` | `#9bab9f` | filetes, deshabilitado, texto de ejemplo |

**Riesgo** — hoja, miel, barro. Cada banda tiene dos valores: uno de texto
(pasa 4.5:1) y uno vivo (solo arcos y rellenos, nunca detrás de texto).

| Banda del motor | Palabra | Texto | Vivo | Tono |
|---|---|---|---|---|
| `poco_favorable` | **Calma** | `#2e7d4f` | `#4fae6f` | `#d9eadf` |
| `favorable` | **Atención** | `#9d6710` | `#e3a01c` | `#f5e7c8` |
| `muy_favorable` | **Alerta** | `#bb4530` | `#d9533a` | `#f7ded6` |

El mapeo sale uno a uno de `bandaDeIndice()` del motor. **El color nunca va
solo: al lado va siempre la palabra.**

## Tipografía

| Uso | Fuente | Por qué |
|---|---|---|
| Títulos y cifras | **Fraunces** | variable en `SOFT` y `WONK`: se le pide que sea redonda y un poco irregular, como algo que creció |
| Texto y botones | **Figtree** | geométrica pero cálida, legible en pantalla chica y al sol |

Nada de monoespaciada: es lo que le daba cara de terminal al primer intento.
Los números se alinean con `font-variant-numeric: tabular-nums`.

## Forma y movimiento

Radios de 14 a 34 px, pastillas a 999 px. **Sin bordes**: sombras verdes muy
difusas. Botones con resorte (`scale(0.965)` al tocar). Entrada escalonada de
la página, la curva se dibuja sola, el halo del riesgo late despacio, la luz
del fondo respira. Todo se apaga con `prefers-reduced-motion`.

## Las gráficas explican

Regla: **si una gráfica no enseña por qué, no va.**

| Gráfica | Qué explica |
|---|---|
| **El medidor** (`Medidor.tsx`) | arco con las tres bandas del motor **a su tamaño real** (Calma ocupa la mitad porque va de 0 a 0.5), los cortes 0.50 y 0.75 escritos, y la aguja donde cayó el índice. Contesta «¿0.67 es mucho o poco?» |
| **La curva** (`Grafica.tsx`) | 16 días con los dos umbrales punteados y rotulados con su palabra, la ventana sombreada y nombrada, «hoy» marcado, círculos en los días con evento confirmado. Cualquier punto se toca y se lee |
| **La balanza** (`Grafica.tsx`) | horas de hoja mojada contra las que pide Magarey a esa temperatura, con la raya del umbral marcada encima de la barra y la frase «faltan 2 h» o «pasa la raya» |
| **La incubación** (en `Hoy.tsx`) | la línea de hoy a la fecha en que se verían las manchas, con la foto de la pústula al lado |

## Las fotografías, y la regla que las gobierna

Las cuatro imágenes están en `public/fotos/` (336 KB en total, cacheadas por el
service worker) y se declaran en un solo sitio, `src/componentes/Fotos.tsx`.

**Son imágenes de referencia generadas. Ninguna es una foto de la parcela del
productor, y cada una lo dice en pantalla**: la cabecera lleva la etiqueta
«Imagen de referencia» y las fotos de hoja llevan «Imagen de referencia, no es
una foto de su parcela». Una foto que parece de su finca y no lo es sería un
dato inventado con otra cara. Si algún día hay fotos reales, se cambia el
campo `credito`.

| Archivo | Qué es | Dónde |
|---|---|---|
| `cafetal.jpg` | cafetal bajo sombra, neblina y volcán | cabecera de Hoy, fondo del acceso |
| `parcela.jpg` | ladera con surcos de café | cabecera de Mi parcela |
| `roya.jpg` | envés de hoja con pústulas de roya | sección «Si hoy se infecta» — **enseña qué buscar** |
| `sana.jpg` | envés de hoja sana | reservada para comparación |
