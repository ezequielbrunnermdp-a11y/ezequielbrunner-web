#!/bin/bash
# Uso: bash tests/db/run.sh  (requiere PostgreSQL local; crea la base condor_test desde cero)
set -e
cd "$(dirname "$0")/../.."
PSQL="psql -v ON_ERROR_STOP=1 -q"
su postgres -c "dropdb --if-exists condor_test && createdb condor_test"
su postgres -c "$PSQL -d condor_test -c 'create extension if not exists pgcrypto'"
su postgres -c "$PSQL -d condor_test -f tests/db/supabase_stub.sql"
for f in supabase/migrations/*.sql; do su postgres -c "$PSQL -d condor_test -f $f"; done
su postgres -c "$PSQL -d condor_test -o /dev/null -f tests/db/pruebas.sql" 2>&1 | sed -e "s/^psql:[^ ]* NOTICE:  //"
