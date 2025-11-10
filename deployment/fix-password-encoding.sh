#!/bin/bash

# Nobis - Fix Supabase Password Encoding Issue
# Dieses Script behebt das Problem mit Sonderzeichen im Postgres-Passwort

set -e

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUPABASE_DIR="/opt/nobis/supabase/docker"

echo -e "${GREEN}=== Nobis: Behebung des Passwort-Encoding-Problems ===${NC}\n"

# Prüfe ob wir im richtigen Verzeichnis sind
if [ ! -f "$SUPABASE_DIR/.env" ]; then
    echo -e "${RED}Fehler: .env Datei nicht gefunden in $SUPABASE_DIR${NC}"
    exit 1
fi

if [ ! -f "$SUPABASE_DIR/docker-compose.yml" ]; then
    echo -e "${RED}Fehler: docker-compose.yml nicht gefunden in $SUPABASE_DIR${NC}"
    exit 1
fi

cd "$SUPABASE_DIR"

# Schritt 1: URL-kodiertes Passwort zur .env hinzufügen
echo -e "${YELLOW}Schritt 1: URL-kodiertes Passwort zur .env hinzufügen...${NC}"

# Lese das aktuelle Passwort
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env | cut -d'=' -f2- | tr -d '"')

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}Fehler: POSTGRES_PASSWORD nicht in .env gefunden${NC}"
    exit 1
fi

echo "Aktuelles Passwort gefunden: ${POSTGRES_PASSWORD:0:10}..."

# URL-encode das Passwort
POSTGRES_PASSWORD_ENCODED=$(echo -n "$POSTGRES_PASSWORD" | sed 's/+/%2B/g; s/\//%2F/g; s/=/%3D/g')

echo "URL-kodiertes Passwort: ${POSTGRES_PASSWORD_ENCODED:0:10}..."

# Prüfe ob POSTGRES_PASSWORD_ENCODED bereits existiert
if grep -q "^POSTGRES_PASSWORD_ENCODED=" .env; then
    echo "POSTGRES_PASSWORD_ENCODED existiert bereits, wird aktualisiert..."
    sed -i "s|^POSTGRES_PASSWORD_ENCODED=.*|POSTGRES_PASSWORD_ENCODED=\"$POSTGRES_PASSWORD_ENCODED\"|" .env
else
    echo "POSTGRES_PASSWORD_ENCODED wird hinzugefügt..."
    echo "" >> .env
    echo "# URL-encoded password for connection strings" >> .env
    echo "POSTGRES_PASSWORD_ENCODED=\"$POSTGRES_PASSWORD_ENCODED\"" >> .env
fi

echo -e "${GREEN}✓ URL-kodiertes Passwort zur .env hinzugefügt${NC}\n"

# Schritt 2: Backup der docker-compose.yml erstellen
echo -e "${YELLOW}Schritt 2: Backup der docker-compose.yml erstellen...${NC}"
cp docker-compose.yml docker-compose.yml.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Backup erstellt${NC}\n"

# Schritt 3: docker-compose.yml aktualisieren
echo -e "${YELLOW}Schritt 3: docker-compose.yml aktualisieren...${NC}"

# Auth Service - GOTRUE_DB_DATABASE_URL
if grep -q "GOTRUE_DB_DATABASE_URL.*\${POSTGRES_PASSWORD}" docker-compose.yml; then
    echo "Aktualisiere Auth Service..."
    sed -i "s|\${POSTGRES_PASSWORD}@\${POSTGRES_HOST}|\${POSTGRES_PASSWORD_ENCODED}@\${POSTGRES_HOST}|g" docker-compose.yml
    echo "✓ Auth Service aktualisiert"
fi

# Rest Service - PGRST_DB_URI
if grep -q "PGRST_DB_URI.*\${POSTGRES_PASSWORD}" docker-compose.yml; then
    echo "Aktualisiere Rest Service..."
    sed -i "s|PGRST_DB_URI:.*postgres://authenticator:\${POSTGRES_PASSWORD}|PGRST_DB_URI: postgres://authenticator:\${POSTGRES_PASSWORD_ENCODED}|g" docker-compose.yml
    echo "✓ Rest Service aktualisiert"
fi

# Analytics Service
if grep -q "analytics:" docker-compose.yml; then
    echo "Prüfe Analytics Service..."
    sed -i "/analytics:/,/^[^ ]/ s|\${POSTGRES_PASSWORD}@db|\${POSTGRES_PASSWORD_ENCODED}@db|g" docker-compose.yml
    echo "✓ Analytics Service geprüft"
fi

# Supavisor Service
if grep -q "supavisor:" docker-compose.yml; then
    echo "Prüfe Supavisor Service..."
    sed -i "/supavisor:/,/^[^ ]/ s|\${POSTGRES_PASSWORD}@db|\${POSTGRES_PASSWORD_ENCODED}@db|g" docker-compose.yml
    echo "✓ Supavisor Service geprüft"
fi

# Functions Service
if grep -q "functions:" docker-compose.yml; then
    echo "Prüfe Functions Service..."
    sed -i "/functions:/,/^[^ ]/ s|SUPABASE_DB_URL:.*postgres://postgres:\${POSTGRES_PASSWORD}|SUPABASE_DB_URL: postgres://postgres:\${POSTGRES_PASSWORD_ENCODED}|g" docker-compose.yml
    echo "✓ Functions Service geprüft"
fi

echo -e "${GREEN}✓ docker-compose.yml aktualisiert${NC}\n"

# Schritt 4: Services neu starten
echo -e "${YELLOW}Schritt 4: Services neu starten...${NC}"
echo "Services werden gestoppt..."
docker compose down

echo "Services werden gestartet..."
docker compose up -d

echo -e "${GREEN}✓ Services neu gestartet${NC}\n"

# Schritt 5: Warte auf Services
echo -e "${YELLOW}Schritt 5: Warte auf Services (15 Sekunden)...${NC}"
sleep 15

# Schritt 6: Verifizierung
echo -e "${YELLOW}Schritt 6: Verifizierung...${NC}\n"

echo "=== Container Status ==="
docker compose ps

echo -e "\n=== Auth Service Logs (letzte 10 Zeilen) ==="
docker logs supabase-auth --tail 10

echo -e "\n=== Rest Service Logs (letzte 10 Zeilen) ==="
docker logs supabase-rest --tail 10

# Prüfe ob Auth Service läuft
if docker compose ps | grep -q "supabase-auth.*running"; then
    echo -e "\n${GREEN}✓ Auth Service läuft!${NC}"
else
    echo -e "\n${RED}✗ Auth Service läuft nicht. Prüfe die Logs mit: docker logs supabase-auth${NC}"
fi

# Prüfe ob Rest Service läuft
if docker compose ps | grep -q "supabase-rest.*running"; then
    echo -e "${GREEN}✓ Rest Service läuft!${NC}"
else
    echo -e "${RED}✗ Rest Service läuft nicht. Prüfe die Logs mit: docker logs supabase-rest${NC}"
fi

echo -e "\n${GREEN}=== Fertig! ===${NC}"
echo -e "Das Passwort-Encoding-Problem sollte nun behoben sein."
echo -e "\nWenn weiterhin Probleme auftreten, prüfe die Logs mit:"
echo -e "  docker logs supabase-auth"
echo -e "  docker logs supabase-rest"
echo -e "\nBackup der alten docker-compose.yml: docker-compose.yml.backup.*"
