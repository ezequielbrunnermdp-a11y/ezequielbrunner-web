#!/usr/bin/env bash
# Copia de seguridad comprimida de la base (formato custom de pg_dump, restaurable con pg_restore).
# Uso: DATABASE_URL=... ./scripts/backup.sh [carpeta]   — programarlo a diario (cron) y copiar a otro almacenamiento.
set -euo pipefail
DIR="${1:-backups}"
mkdir -p "$DIR"
FILE="$DIR/asistencia_$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$FILE"
echo "Copia creada: $FILE"
# Conserva 30 días localmente
find "$DIR" -name 'asistencia_*.dump' -mtime +30 -delete
