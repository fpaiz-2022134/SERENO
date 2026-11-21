# SERENO · tokens de diseño

Extraídos del PDF **BRANDING FINAL** (17 páginas). Esto es la referencia en
texto; el PDF manda si hay duda.

> **Sepa antes. Decida usted.** · *Clima para el agricultor*

## Paleta

| Token | Hex | Para qué |
|---|---|---|
| `niebla` | `#2F6585` | **Principal · acción.** Botones primarios, datos |
| `niebla-profunda` | `#104560` | Encabezados |
| `cedro` | `#7A3518` | Marca · **riesgo alto** |
| `miel` | `#96601A` | **Riesgo medio** · atención |
| `olivo` | `#4F6B23` | **Riesgo bajo** · calma · siembra · WhatsApp |
| `roble` | `#D2A86A` | Filetes, patrones, detalles dorados |
| `humo` | `#E5D0AE` | Superficie cálida |
| `lino` | `#F4EBDC` | Papel de fondo |
| `ebano` | `#19130F` | Texto · navegación |

**Proporción:** 60 lino · 22 cedro · 8 miel · 5 olivo · 5 niebla.
La lámina de UI v2 lo matiza: *«Niebla manda; el resto acompaña. **Nunca
naranja.**»* — en pantallas de producto, niebla es el color de acción.

## Riesgo: SIEMPRE color **y** palabra

La lámina lo dice literal: `RIESGO · COLOR + PALABRA`. Nunca solo color — es
accesibilidad, y además el aviso tiene que leerse en una captura de WhatsApp.

| Banda del motor | Palabra | Color |
|---|---|---|
| `poco_favorable` (0–0.5) | **Calma** / BAJO | olivo `#4F6B23` |
| `favorable` (0.5–0.75) | **Atención** / MEDIO | miel `#96601A` |
| `muy_favorable` (0.75–1) | **Alerta** / ALTO | cedro `#7A3518` |
| (pronóstico de lluvia) | **Lluvia** | niebla `#2F6585` |

Las tres primeras salen tal cual de `bandaDeIndice()` en
`src/lib/motor/parametros.ts`. El mapeo es uno a uno; no hay que inventar nada.

## Tipografía

| Uso | Fuente |
|---|---|
| Display y títulos | **Playfair Display** (serif) |
| Texto y botones | **DM Sans** |
| Números y datos | **IBM Plex Mono** (`18 mm`, `17°`, `92%`) |

## Forma

- **Radios:** 14 px botones · 18–24 px tarjetas · 999 px chips.
- **Sombras:** con niebla, **nunca negras**.
- **Fondo:** patrón de curvas de nivel (topográfico), muy sutil.
- **Logo:** gota con brote. Los **3 anillos** son el medidor de riesgo:
  hoy, 3 días y 7 días. *«Cada anillo es un año de campo. El color es el aviso.»*

## Navegación

Barra **flotante** de 5: `Inicio` · `Mi parcela` · **`+`** (destacado, roble) ·
`Alertas` · `Perfil`.

## Las pantallas del MVP

```
Abre Sereno → ¿tiene sesión?
   no → Acceso (correo + contraseña) → Confirmar correo (código de 6) → Hoy en mi finca
   sí → directo a Hoy en mi finca
Hoy en mi finca (5 datos · 3 acciones) → Mi parcela (hasta 5 datos)
   → Calcular riesgo y costos → Resultado (riesgo, por qué, costos)
   → Guardar seguimiento · compartir por WhatsApp → vuelve a Hoy
```

1. **Acceso** — solo correo y contraseña. *«La parcela se agrega después.»*
2. **Confirmar correo** — código de 6 números.
3. **Sin parcela** — estado vacío honesto: las tarjetas dicen **«No disponible»**,
   no ceros ni datos inventados. CTA: «Configurar mi parcela».
4. **Hoy en mi finca** — 5 datos y 3 acciones (ver nota de abajo).
5. **Mi parcela** — 5 datos: ubicación · altitud (`<900` / `900–1500` /
   `1500–1800` / `>1800`) · cultivo y variedad · área · estado del cultivo
   (sin síntomas / sospecha / plaga observada / no sé).
6. **Resultado** — riesgo, **¿por qué?** (las condiciones que lo dispararon) y
   costos orientativos editables, con `Guardar` y `WhatsApp`.

## Reglas de honestidad que el propio diseño ya trae

Están en las láminas y hay que respetarlas en el código:

- **Motor determinista:** *«umbrales explícitos, no IA, deciden el riesgo.»*
- **Sin datos:** «No disponible» **y qué falta**. Nunca un cero inventado.
- **Sin conexión:** se muestra el último reporte **con su fecha**
  («Viendo el reporte del sáb 21 nov, 11:30»).
- **«Estimación meteorológica. No es una medición en su finca.»**
- **«Open-Meteo para su municipio · no medido en la finca.»**
- En costos: **«No es una recomendación automática de aplicar fungicida ni
  plaguicida. Consulte a su técnico.»**
