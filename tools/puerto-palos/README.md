# Puerto de Palos · Inteligencia de ventas y clima

Página (Artifact de claude.ai) que, al elegir una fecha, compara la facturación de
**Puerto de Palos – Puerto** con:

- **A. Misma fecha del año anterior** (el 29/02 pasa al 28/02).
- **B. Mismo día de la semana del año anterior** (52 semanas = 364 días antes).

## Fuentes
| Dato | Origen | Cómo llega |
|---|---|---|
| Ventas, tickets, ticket promedio, cubiertos, por hora, por rubro, canal, notas de crédito | Morphi (conector MCP del usuario), base `PUERTO DE PALOS  PUERTO`, filtro sucursal `1` | En vivo desde la página, **solo lectura** (`ventas`, `ventas_por_hora`, `comprobantes_de_venta`) |
| Clima histórico (diario y horario) | Open-Meteo Historical Weather API (reanálisis ERA5/ERA5-Land) | `data/clima.json` |
| Pronóstico 16 días | Open-Meteo Forecast API | `data/clima.json` (instantánea) |
| Feriados | ArgentinaDatos | `data/feriados.json` |
| IPC Nacional | INDEC vía apis.datos.gob.ar (serie 148.3_INIVELNAL_DICI_M_26) | `data/ipc.json` |

Las ventas nunca se guardan en el repositorio ni en el Artifact.

## Definición de facturación
Importe bruto con IVA de todos los comprobantes de la sucursal 1, por **día operativo de caja**,
con notas de crédito restadas. Igual en todos los períodos.

## Actualizar clima, feriados e IPC
```
python3 tools/puerto-palos/build_data.py
```
y volver a publicar el Artifact con los archivos de `data/`.
