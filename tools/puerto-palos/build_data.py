#!/usr/bin/env python3
"""Genera los datos de referencia de Puerto de Palos · Inteligencia de ventas y clima.

Salidas (en ./data):
  clima.json     Open-Meteo: reanálisis histórico (ERA5) + historical-forecast para días recientes
                 + pronóstico de los próximos 16 días (instantánea, con fecha de generación).
  feriados.json  Feriados nacionales de Argentina (api.argentinadatos.com).
  ipc.json       IPC Nacional INDEC, nivel general, base dic-2016 (apis.datos.gob.ar).

Las ventas NO se guardan acá: la página las consulta en vivo en Morphi (solo lectura).
"""
import json, datetime as dt, urllib.parse, os, subprocess, time

LAT, LON = -38.0435, -57.5390          # Centro Comercial del Puerto, Mar del Plata
TZ = "America/Argentina/Buenos_Aires"
DESDE = dt.date(2022, 11, 1)
HOY = dt.date.today()
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(OUT, exist_ok=True)

DAILY = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum",
         "precipitation_hours", "wind_speed_10m_max", "wind_gusts_10m_max", "sunshine_duration",
         "daylight_duration", "cloud_cover_mean"]
HOURLY = ["temperature_2m", "precipitation", "weather_code", "cloud_cover", "wind_speed_10m"]

def get(url, params=None):
    """Descarga con curl (respeta el proxy y su CA) y reintenta ante cortes."""
    q = ("?" + urllib.parse.urlencode(params, safe=",/")) if params else ""
    for intento in range(5):
        r = subprocess.run(["curl", "-sS", "-f", "-m", "180", f"{url}{q}"], capture_output=True, text=True)
        if r.returncode == 0:
            return json.loads(r.stdout)
        time.sleep(3 * (intento + 1))
    raise RuntimeError(f"no se pudo descargar {url}: {r.stderr.strip()}")

def bloque(url, d0, d1, extra=None):
    p = {"latitude": LAT, "longitude": LON, "timezone": TZ, "daily": ",".join(DAILY),
         "hourly": ",".join(HOURLY), "start_date": d0.isoformat(), "end_date": d1.isoformat()}
    p.update(extra or {})
    return get(url, p)

def compactar(js, fuente, dias):
    d, h = js["daily"], js["hourly"]
    for i, fecha in enumerate(d["time"]):
        if d["temperature_2m_max"][i] is None:
            continue
        hs = slice(i * 24, i * 24 + 24)
        def hr(k, mult=1):
            return [None if v is None else round(v * mult) for v in h[k][hs]]
        dias[fecha] = {
            "f": fuente,
            "cod": d["weather_code"][i], "tmax": d["temperature_2m_max"][i], "tmin": d["temperature_2m_min"][i],
            "pp": d["precipitation_sum"][i], "pph": d["precipitation_hours"][i],
            "vmax": d["wind_speed_10m_max"][i], "rmax": d["wind_gusts_10m_max"][i],
            "sol": None if d["sunshine_duration"][i] is None else round(d["sunshine_duration"][i] / 3600, 1),
            "luz": None if d["daylight_duration"][i] is None else round(d["daylight_duration"][i] / 3600, 1),
            "nub": d["cloud_cover_mean"][i],
            "h": {"t": hr("temperature_2m"), "pp": hr("precipitation", 10), "cod": hr("weather_code"),
                  "nub": hr("cloud_cover"), "v": hr("wind_speed_10m")},
        }

dias = {}
# 1) Reanálisis (ERA5, ERA5-Land), por años
y = DESDE
while y <= HOY:
    fin = min(dt.date(y.year, 12, 31), HOY - dt.timedelta(days=1))
    compactar(bloque("https://archive-api.open-meteo.com/v1/archive", y, fin), "reanalisis", dias)
    y = dt.date(y.year + 1, 1, 1)
# 2) Días recientes que el reanálisis todavía no publicó: modelo de pronóstico archivado
faltan = [DESDE + dt.timedelta(days=i) for i in range((HOY - DESDE).days)]
faltan = [f for f in faltan if f.isoformat() not in dias]
if faltan:
    js = bloque("https://historical-forecast-api.open-meteo.com/v1/forecast", min(faltan), HOY - dt.timedelta(days=1))
    tmp = {}; compactar(js, "modelo_archivado", tmp)
    for k, v in tmp.items():
        dias.setdefault(k, v)
# 3) Pronóstico (hoy + 15 días)
pron = {}
js = get("https://api.open-meteo.com/v1/forecast", {"latitude": LAT, "longitude": LON, "timezone": TZ,
         "daily": ",".join(DAILY), "hourly": ",".join(HOURLY), "forecast_days": 16})
compactar(js, "pronostico", pron)

clima = {
    "generado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
    "ubicacion": {"lat": LAT, "lon": LON, "zona": TZ, "nombre": "Puerto de Mar del Plata",
                  "celda_lat": js.get("latitude"), "celda_lon": js.get("longitude")},
    "fuentes": {
        "reanalisis": "Open-Meteo Historical Weather API (reanálisis ERA5 / ERA5-Land de Copernicus/ECMWF). Datos reconstruidos por modelo sobre una grilla de ~9–25 km; no son mediciones en el restaurante.",
        "modelo_archivado": "Open-Meteo Historical Forecast API (salidas archivadas de modelos de pronóstico) para los días que el reanálisis todavía no publicó. Datos de modelo, no medidos.",
        "pronostico": "Open-Meteo Forecast API. Pronóstico: puede cambiar; vale para la fecha de generación.",
    },
    "unidades": {"t": "°C", "pp": "mm (horario: décimas de mm)", "v": "km/h", "sol": "horas", "nub": "%"},
    "dias": dict(sorted(dias.items())),
    "pronostico": pron,
}
with open(os.path.join(OUT, "clima.json"), "w") as f:
    json.dump(clima, f, ensure_ascii=False, separators=(",", ":"))

# Feriados
fer = []
for anio in range(DESDE.year, HOY.year + 2):
    try:
        fer += get(f"https://api.argentinadatos.com/v1/feriados/{anio}")
    except Exception as e:
        print("feriados", anio, "no disponible:", e)
with open(os.path.join(OUT, "feriados.json"), "w") as f:
    json.dump({"generado": clima["generado"], "fuente": "ArgentinaDatos (api.argentinadatos.com), feriados nacionales oficiales",
               "feriados": fer}, f, ensure_ascii=False, separators=(",", ":"))

# IPC INDEC
ipc = get("https://apis.datos.gob.ar/series/api/series/", {"ids": "148.3_INIVELNAL_DICI_M_26",
          "start_date": "2022-01-01", "limit": 1000, "format": "json"})
with open(os.path.join(OUT, "ipc.json"), "w") as f:
    json.dump({"generado": clima["generado"],
               "fuente": "INDEC · IPC Nacional, nivel general, base diciembre 2016 = 100 (serie 148.3_INIVELNAL_DICI_M_26, apis.datos.gob.ar)",
               "serie": {r[0][:7]: r[1] for r in ipc["data"]}}, f, ensure_ascii=False, separators=(",", ":"))
print("días de clima:", len(dias), "| pronóstico:", len(pron), "| feriados:", len(fer), "| meses IPC:", len(ipc["data"]))
