#!/bin/bash
set -e

echo "🚀 Supabase Self-Hosted Installation Script"
echo "==========================================="

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktion für farbige Ausgabe
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# System-Voraussetzungen prüfen
log_info "Prüfe System-Voraussetzungen..."

if ! command -v docker &> /dev/null; then
    log_error "Docker ist nicht installiert!"
    echo "Installiere Docker mit: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose ist nicht installiert!"
    echo "Installiere Docker Compose: sudo apt install docker-compose-plugin"
    exit 1
fi

log_info "Docker Version: $(docker --version)"
log_info "Docker Compose Version: $(docker-compose --version)"

# Verzeichnis erstellen
INSTALL_DIR="/opt/supabase"
log_info "Erstelle Installationsverzeichnis: $INSTALL_DIR"
sudo mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Supabase Repository klonen
if [ ! -d "$INSTALL_DIR/supabase" ]; then
    log_info "Clone Supabase Repository..."
    sudo git clone --depth 1 https://github.com/supabase/supabase.git
else
    log_warn "Supabase Repository existiert bereits"
fi

cd $INSTALL_DIR/supabase/docker

# .env Datei konfigurieren
log_info "Konfiguriere Umgebungsvariablen..."

if [ -f .env ]; then
    log_warn ".env existiert bereits - Erstelle Backup"
    sudo cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
fi

sudo cp .env.example .env

# Secrets generieren
log_info "Generiere Secrets..."
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
DASHBOARD_PASSWORD=$(openssl rand -base64 16)
ANON_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)
SERVICE_ROLE_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)

# .env aktualisieren
log_info "Aktualisiere .env Datei..."
sudo sed -i "s|POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password|POSTGRES_PASSWORD=$POSTGRES_PASSWORD|g" .env
sudo sed -i "s|JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long|JWT_SECRET=$JWT_SECRET|g" .env
sudo sed -i "s|ANON_KEY=.*|ANON_KEY=$ANON_KEY|g" .env
sudo sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|g" .env
sudo sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$DASHBOARD_PASSWORD|g" .env

# Domain konfigurieren
read -p "Geben Sie Ihre Domain ein (z.B. api.ihre-domain.de): " DOMAIN
if [ -z "$DOMAIN" ]; then
    log_warn "Keine Domain angegeben - verwende localhost"
    DOMAIN="localhost"
fi

sudo sed -i "s|SITE_URL=http://localhost:3000|SITE_URL=https://$DOMAIN|g" .env
sudo sed -i "s|API_EXTERNAL_URL=http://localhost:8000|API_EXTERNAL_URL=https://$DOMAIN|g" .env

# Public URL für Storage
sudo sed -i "s|PUBLIC_REST_URL=http://localhost:3000/rest/v1/|PUBLIC_REST_URL=https://$DOMAIN/rest/v1/|g" .env

log_info "Konfiguration abgeschlossen!"

# Credentials-Datei erstellen
CREDS_FILE="$INSTALL_DIR/supabase-credentials.txt"
log_info "Speichere Credentials in $CREDS_FILE"
sudo tee $CREDS_FILE > /dev/null <<EOF
===========================================
SUPABASE CREDENTIALS
===========================================
Domain: $DOMAIN
Postgres Password: $POSTGRES_PASSWORD
JWT Secret: $JWT_SECRET
Anon Key: $ANON_KEY
Service Role Key: $SERVICE_ROLE_KEY
Dashboard Password: $DASHBOARD_PASSWORD

Dashboard URL: http://$DOMAIN:8000
Studio URL: http://$DOMAIN:3000

Postgres Connection:
  Host: localhost
  Port: 5432
  Database: postgres
  User: postgres
  Password: $POSTGRES_PASSWORD

===========================================
⚠️  WICHTIG: Speichern Sie diese Datei sicher!
===========================================
EOF

sudo chmod 600 $CREDS_FILE

# Docker Container starten
log_info "Starte Supabase Docker Container..."
sudo docker-compose up -d

# Warte auf Services
log_info "Warte auf Services (60 Sekunden)..."
sleep 60

# Status prüfen
log_info "Prüfe Container-Status..."
sudo docker-compose ps

# Health Check
log_info "Führe Health Check durch..."
if curl -f http://localhost:8000/health &> /dev/null; then
    log_info "✅ Supabase API ist bereit!"
else
    log_warn "⚠️  API antwortet nicht - bitte Logs prüfen"
fi

if curl -f http://localhost:3000 &> /dev/null; then
    log_info "✅ Supabase Studio ist bereit!"
else
    log_warn "⚠️  Studio antwortet nicht - bitte Logs prüfen"
fi

# Nächste Schritte anzeigen
echo ""
echo "=========================================="
log_info "✅ Installation abgeschlossen!"
echo "=========================================="
echo ""
echo "📝 Credentials wurden gespeichert in:"
echo "   $CREDS_FILE"
echo ""
echo "🌐 URLs:"
echo "   API: http://localhost:8000"
echo "   Studio: http://localhost:3000"
echo "   PostgreSQL: localhost:5432"
echo ""
echo "🔑 Dashboard Login:"
echo "   Username: supabase"
echo "   Password: $DASHBOARD_PASSWORD"
echo ""
echo "📋 Nächste Schritte:"
echo "   1. Führe Datenbank-Migration aus: ./migrate-database.sh"
echo "   2. Migriere Storage-Dateien: node migrate-storage.js"
echo "   3. Konfiguriere Nginx: sudo cp nginx.conf /etc/nginx/sites-available/supabase"
echo "   4. Richte SSL-Zertifikat ein: sudo certbot --nginx -d $DOMAIN"
echo ""
echo "🔧 Nützliche Befehle:"
echo "   Logs anzeigen: cd $INSTALL_DIR/supabase/docker && sudo docker-compose logs -f"
echo "   Services neustarten: cd $INSTALL_DIR/supabase/docker && sudo docker-compose restart"
echo "   Services stoppen: cd $INSTALL_DIR/supabase/docker && sudo docker-compose down"
echo ""
