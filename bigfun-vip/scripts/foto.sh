#!/bin/bash
# Convierte una foto cualquiera en la imagen de un producto (480x480 JPEG optimizado).
# Uso: scripts/foto.sh <archivo-origen> <id-producto> [cover|pad]
#   cover: recorta al cuadrado (por defecto)   pad: entra completa sobre fondo difuminado
# Ejemplo: scripts/foto.sh ~/Descargas/chandon.jpg chandon pad
set -e
src="$1"; id="$2"; mode="${3:-cover}"
[ -f "$src" ] && [ -n "$id" ] || { echo "Uso: $0 <archivo> <id> [cover|pad]"; exit 1; }
out="$(dirname "$0")/../src/img/$id.jpg"
S=480
if [ "$mode" = pad ]; then
  convert "$src[0]" -auto-orient \( +clone -resize ${S}x${S}^ -gravity center -extent ${S}x${S} -blur 0x18 -fill black -colorize 35% \) +swap \
    \( -clone 1 -resize ${S}x${S} \) -delete 1 -gravity center -composite -strip -sampling-factor 4:2:0 -quality 74 -interlace JPEG "$out"
else
  convert "$src[0]" -auto-orient -resize ${S}x${S}^ -gravity center -extent ${S}x${S} -strip -sampling-factor 4:2:0 -quality 74 -interlace JPEG "$out"
fi
echo "$id → $out ($(stat -c %s "$out") bytes)"
