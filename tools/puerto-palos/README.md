# Puerto de Palos · Inteligencia de ventas y clima

Página (Artifact de claude.ai) con dos modos: **Un día** o **Período** (fecha desde – hasta, hasta 366 días cerrados).
Al elegir una fecha o un período, compara la facturación de
**Puerto de Palos – Puerto** con:

- **A. Misma fecha del año anterior** (el 29/02 pasa al 28/02).
- **B. Mismo día de la semana del año anterior** (52 semanas = 364 días antes).

## Fuentes
| Dato | Origen | Cómo llega |
|---|---|---|
| Ventas, tickets válidos, notas de crédito, anulaciones, por hora, por mozo, por rubro, canal | Morphi (conector MCP del usuario), base `PUERTO DE PALOS  PUERTO`, filtro sucursal `1` | En vivo desde la página, **solo lectura** (`ventas`, `referencias_de_ventas`) |
| Clima histórico (diario y horario) | Open-Meteo Historical Weather API (reanálisis ERA5/ERA5-Land) | `data/clima.json` |
| Pronóstico 16 días | Open-Meteo Forecast API | `data/clima.json` (instantánea) |
| Feriados | ArgentinaDatos | `data/feriados.json` |
| IPC Nacional | INDEC vía apis.datos.gob.ar (serie 148.3_INIVELNAL_DICI_M_26) | `data/ipc.json` |

Las ventas nunca se guardan en el repositorio ni en el Artifact.

## Tickets válidos
Morphi cuenta cada nota de crédito y cada anulación de preticket como un comprobante más.
La tabla de comprobantes (`referencias_de_ventas`, tipo `NC`) identifica cuáles son;
tickets válidos = comprobantes de venta − notas de crédito − anulaciones.

## Mozos
Morphi asigna un mozo a cada comprobante. Las fichadas y horarios del personal solo existen en
Gestión Win32 y no están en el conector: la página muestra **«Dotación real no verificada»** y
trabaja con mozos con ventas registradas y su ventana de actividad (no horas fichadas).

## Definición de facturación
Importe bruto con IVA de todos los comprobantes de la sucursal 1, por **día operativo de caja**,
con notas de crédito restadas. Igual en todos los períodos.

## Actualizar clima, feriados e IPC
```
python3 tools/puerto-palos/build_data.py
```
y volver a publicar el Artifact con los archivos de `data/`.
