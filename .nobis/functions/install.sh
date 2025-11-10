#!/bin/bash

# Installations-Funktionen für Nobis

# ============================================================================
# Dependency Installation
# ============================================================================

install_docker() {
    if command -v docker &> /dev/null; then
        log_success "Docker bereits installiert: $(docker --version)"
        return 0
    fi
    
    log_step "Installiere Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker $SUDO_USER 2>/dev/null || true
    log_success "Docker installiert"
}

install_docker_compose() {
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose bereits installiert: $(docker-compose --version)"
        return 0
    fi
    
    log_step "Installiere Docker Compose..."
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d\" -f4)
    curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    log_success "Docker Compose installiert: $COMPOSE_VERSION"
}

install_nodejs() {
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        log_success "Node.js bereits installiert: $node_version"
        return 0
    fi
    
    log_step "Installiere Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    log_success "Node.js installiert: $(node --version)"
}

install_nginx() {
    if command -v nginx &> /dev/null; then
        log_success "Nginx bereits installiert: $(nginx -v 2>&1 | cut -d/ -f2)"
        return 0
    fi
    
    log_step "Installiere Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    log_success "Nginx installiert"
}

install_certbot() {
    if command -v certbot &> /dev/null; then
        log_success "Certbot bereits installiert"
        return 0
    fi
    
    log_step "Installiere Certbot für SSL..."
    apt-get install -y certbot python3-certbot-nginx
    log_success "Certbot installiert"
}

install_postgresql_client() {
    if command -v psql &> /dev/null; then
        log_success "PostgreSQL Client bereits installiert"
        return 0
    fi
    
    log_step "Installiere PostgreSQL Client Tools..."
    apt-get install -y postgresql-client
    log_success "PostgreSQL Client installiert"
}

check_and_install_all_dependencies() {
    log_info "═══════════════════════════════════════════════"
    log_info "  Prüfe und installiere System-Dependencies"
    log_info "═══════════════════════════════════════════════"
    
    # System Update
    log_step "Aktualisiere Paketlisten..."
    apt-get update -qq
    
    # Core Dependencies
    log_step "Installiere Basis-Tools..."
    apt-get install -y curl git wget gnupg2 ca-certificates lsb-release ubuntu-keyring
    
    # Install each component
    install_docker
    install_docker_compose
    install_nodejs
    install_nginx
    install_certbot
    install_postgresql_client
    
    log_success "✅ Alle Dependencies installiert!"
    echo ""
}

# ============================================================================
# Interaktive Konfiguration
# ============================================================================

interactive_setup() {
    echo ""
    echo "╔════════════════════════════════════════════════════╗"
    echo "║                                                    ║"
    echo "║     Nobis Construction Management                  ║"
    echo "║     Installations-Assistent                        ║"
    echo "║                                                    ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    
    # Domain
    while true; do
        read -p "Ihre Domain (z.B. app.ihre-firma.de): " DOMAIN
        if [[ $DOMAIN =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
            break
        else
            log_error "Ungültige Domain. Bitte erneut versuchen."
        fi
    done
    
    # Email für SSL
    while true; do
        read -p "E-Mail für SSL-Zertifikat: " EMAIL
        if [[ $EMAIL =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
            break
        else
            log_error "Ungültige E-Mail. Bitte erneut versuchen."
        fi
    done
    
    # Mapbox Token
    read -p "Mapbox Token (optional, Enter zum Überspringen): " MAPBOX_TOKEN
    
    # Migration
    echo ""
    echo "Datenquelle:"
    echo "  1) Neue Installation (leere Datenbank)"
    echo "  2) Migration von Lovable Cloud"
    read -p "Auswahl [1-2]: " MIGRATE_CHOICE
    
    # Generiere Secrets
    log_step "Generiere Sicherheits-Schlüssel..."
    POSTGRES_PASSWORD=$(openssl rand -base64 32)
    JWT_SECRET=$(openssl rand -base64 64)
    ANON_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)
    SERVICE_ROLE_KEY=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-40)
    DASHBOARD_PASSWORD=$(openssl rand -base64 16)
    
    # Speichere Konfiguration
    mkdir -p "$INSTALL_DIR"
    cat > "$INSTALL_DIR/.env" <<EOF
# Nobis Installation Configuration
# Erstellt am: $(date +%Y-%m-%d\ %H:%M:%S)

# Domain und SSL
DOMAIN="$DOMAIN"
EMAIL="$EMAIL"

# Supabase Credentials
POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
JWT_SECRET="$JWT_SECRET"
ANON_KEY="$ANON_KEY"
SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
DASHBOARD_USERNAME="supabase"
DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD"

# Mapbox (optional)
MAPBOX_TOKEN="${MAPBOX_TOKEN:-}"

# Migration
MIGRATE_FROM_CLOUD="$MIGRATE_CHOICE"

# Installation
INSTALL_DATE="$(date +%Y-%m-%d)"
VERSION="$VERSION"
EOF
    
    chmod 600 "$INSTALL_DIR/.env"
    log_success "Konfiguration gespeichert"
    
    # Zeige Credentials
    echo ""
    log_warn "⚠️  WICHTIG: Speichern Sie diese Zugangsdaten sicher!"
    echo ""
    echo "Supabase Studio Zugang:"
    echo "  URL: https://$DOMAIN:3000"
    echo "  Username: supabase"
    echo "  Password: $DASHBOARD_PASSWORD"
    echo ""
    read -p "Drücken Sie Enter zum Fortfahren..."
}

# ============================================================================
# Supabase Installation
# ============================================================================

install_supabase() {
    log_step "Installiere Supabase Self-Hosted..."
    
    mkdir -p "$SUPABASE_DIR"
    cd "$SUPABASE_DIR"
    
    # Clone Supabase
    if [ ! -d "$SUPABASE_DIR/docker" ]; then
        log_info "Clone Supabase Repository..."
        git clone --depth 1 https://github.com/supabase/supabase.git temp
        mv temp/docker .
        rm -rf temp
    fi
    
    cd docker
    
    # Lade unsere Konfiguration
    load_env
    
    # Erstelle .env Datei direkt (ohne Template)
    log_info "Erstelle Supabase .env Konfiguration..."
    cat > .env <<EOF
############
# Secrets
############
POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
JWT_SECRET="$JWT_SECRET"
ANON_KEY="$ANON_KEY"
SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

############
# Dashboard
############
DASHBOARD_USERNAME="supabase"
DASHBOARD_PASSWORD="$DASHBOARD_PASSWORD"

############
# Database - You can change these to any PostgreSQL database that has logical replication enabled.
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API Proxy - Configuration for the Kong Reverse proxy.
############
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443

############
# API - Configuration for PostgREST.
############
PGRST_DB_SCHEMAS=public,storage,graphql_public

############
# Auth - Configuration for the GoTrue authentication server.
############
SITE_URL=https://$DOMAIN
ADDITIONAL_REDIRECT_URLS=
JWT_EXPIRY=3600
DISABLE_SIGNUP=false
API_EXTERNAL_URL=https://$DOMAIN

############
# Studio - Configuration for the Dashboard
############
STUDIO_DEFAULT_ORGANIZATION=Default Organization
STUDIO_DEFAULT_PROJECT=Default Project

STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=https://$DOMAIN

############
# Functions - Configuration for Functions
############
FUNCTIONS_VERIFY_JWT=false

############
# Logs - Configuration for Logflare
############
LOGFLARE_LOGGER_BACKEND_API_KEY=your-super-secret-and-long-logflare-key

############
# Metrics - Configuration for Prometheus
############
ENABLE_METRICS=false
EOF

    log_success "Supabase .env Datei erstellt"
    
    # Starte Supabase Services
    log_info "Starte Supabase Container..."
    docker compose pull
    docker compose up -d
    
    log_success "Supabase Services gestartet"
}

setup_database_schema() {
    log_step "Richte Datenbank-Schema ein..."
    
    # Warte bis Datenbank bereit ist
    log_info "Warte auf Datenbank..."
    sleep 10
    
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec supabase-db psql -U postgres -c "SELECT 1" &> /dev/null; then
            log_success "Datenbank bereit"
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        log_error "Datenbank nicht erreichbar nach $max_attempts Versuchen"
        return 1
    fi
    
    # Führe Schema-Migration aus
    if [ -f "$SCRIPT_DIR/deployment/migrate-database.sql" ]; then
        log_info "Importiere Datenbank-Schema..."
        docker exec -i supabase-db psql -U postgres < "$SCRIPT_DIR/deployment/migrate-database.sql"
        log_success "Datenbank-Schema importiert"
    else
        log_warn "Keine Schema-Datei gefunden, überspringe..."
    fi
}

# ============================================================================
# Frontend Build
# ============================================================================

build_frontend() {
    log_step "Baue Frontend..."
    
    cd "$SCRIPT_DIR"
    
    # Install dependencies
    log_info "Installiere npm dependencies..."
    npm ci --production=false
    
    # Erstelle .env für Frontend
    load_env
    cat > "$SCRIPT_DIR/.env" <<EOF
VITE_SUPABASE_URL="http://localhost:8000"
VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY"
VITE_MAPBOX_PUBLIC_TOKEN="${MAPBOX_TOKEN:-}"
EOF
    
    # Build
    log_info "Baue Produktions-Build..."
    npm run build
    
    # Deploy
    log_info "Deploye Frontend..."
    mkdir -p "$WEB_DIR"
    rm -rf "$WEB_DIR/dist"
    cp -r dist "$WEB_DIR/"
    
    log_success "Frontend gebaut und deployed"
}

# ============================================================================
# Nginx Konfiguration
# ============================================================================

configure_nginx() {
    log_step "Konfiguriere Nginx..."
    
    load_env
    
    # Erstelle Nginx Config aus Template
    local nginx_conf="/etc/nginx/sites-available/nobis"
    cp "$TEMPLATES_DIR/nginx.conf.template" "$nginx_conf"
    
    # Ersetze Variablen
    sed -i "s|{{DOMAIN}}|$DOMAIN|g" "$nginx_conf"
    sed -i "s|{{WEB_DIR}}|$WEB_DIR|g" "$nginx_conf"
    
    # Aktiviere Site
    ln -sf "$nginx_conf" /etc/nginx/sites-enabled/nobis
    rm -f /etc/nginx/sites-enabled/default
    
    # Teste Konfiguration
    nginx -t
    
    log_success "Nginx konfiguriert"
}

setup_ssl() {
    log_step "Richte SSL-Zertifikat ein..."
    
    load_env
    
    # Stoppe Nginx temporär
    systemctl stop nginx
    
    # Hole Zertifikat
    certbot certonly --standalone -d "$DOMAIN" --email "$EMAIL" --agree-tos --non-interactive
    
    # Update Nginx Config für SSL
    local nginx_conf="/etc/nginx/sites-available/nobis"
    sed -i "s|# SSL_PLACEHOLDER|ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;|" "$nginx_conf"
    
    # Starte Nginx
    systemctl start nginx
    
    # Setup Auto-Renewal
    (crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -
    
    log_success "SSL eingerichtet"
}

# ============================================================================
# Service Management
# ============================================================================

start_services() {
    log_step "Starte Services..."
    
    # Supabase
    cd "$SUPABASE_DIR/docker"
    docker-compose up -d
    log_success "Supabase gestartet"
    
    # Nginx
    systemctl start nginx
    log_success "Nginx gestartet"
    
    echo ""
    log_success "✅ Alle Services gestartet"
}

stop_services() {
    log_step "Stoppe Services..."
    
    # Nginx
    systemctl stop nginx
    log_success "Nginx gestoppt"
    
    # Supabase
    if [ -d "$SUPABASE_DIR/docker" ]; then
        cd "$SUPABASE_DIR/docker"
        docker-compose down
        log_success "Supabase gestoppt"
    fi
    
    echo ""
    log_success "✅ Alle Services gestoppt"
}

# ============================================================================
# Status & Monitoring
# ============================================================================

show_status() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║            Nobis System Status                    ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    # Docker Services
    echo -e "${CYAN}🐳 Docker Services:${NC}"
    if [ -d "$SUPABASE_DIR/docker" ]; then
        cd "$SUPABASE_DIR/docker"
        docker-compose ps
    else
        echo "  Supabase nicht installiert"
    fi
    
    echo ""
    
    # Nginx
    echo -e "${CYAN}🌐 Nginx:${NC}"
    systemctl status nginx --no-pager -l | head -5
    
    echo ""
    
    # Disk Usage
    echo -e "${CYAN}💾 Speicherplatz:${NC}"
    df -h / /var | grep -v "tmpfs"
    
    echo ""
    
    # Health Checks
    echo -e "${CYAN}🏥 Health Checks:${NC}"
    
    # Supabase API
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Supabase API: Running"
    else
        echo -e "  ${RED}✗${NC} Supabase API: Down"
    fi
    
    # Supabase Studio
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Supabase Studio: Running"
    else
        echo -e "  ${RED}✗${NC} Supabase Studio: Down"
    fi
    
    # Frontend
    load_env
    if [ -n "$DOMAIN" ]; then
        if curl -sfk "https://$DOMAIN" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Frontend (https://$DOMAIN): Running"
        else
            echo -e "  ${RED}✗${NC} Frontend (https://$DOMAIN): Down"
        fi
    fi
    
    # Database
    if [ -d "$SUPABASE_DIR/docker" ]; then
        if docker exec supabase-db psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} Database: Connected"
        else
            echo -e "  ${RED}✗${NC} Database: Connection failed"
        fi
    fi
    
    echo ""
}

show_logs() {
    local service="$1"
    
    case "$service" in
        supabase)
            if [ -d "$SUPABASE_DIR/docker" ]; then
                cd "$SUPABASE_DIR/docker"
                docker-compose logs -f --tail=100
            else
                log_error "Supabase nicht installiert"
            fi
            ;;
        nginx)
            tail -f /var/log/nginx/error.log /var/log/nginx/access.log
            ;;
        app|nobis)
            tail -f "$LOG_FILE"
            ;;
        all|*)
            tail -f "$LOG_FILE" /var/log/nginx/error.log
            ;;
    esac
}

# ============================================================================
# Uninstall
# ============================================================================

run_uninstall() {
    log_warn "Starte Deinstallation..."
    
    # Stoppe Services
    stop_services
    
    # Entferne Nginx Config
    rm -f /etc/nginx/sites-enabled/nobis
    rm -f /etc/nginx/sites-available/nobis
    systemctl reload nginx
    
    # Entferne Docker Container
    if [ -d "$SUPABASE_DIR/docker" ]; then
        cd "$SUPABASE_DIR/docker"
        docker-compose down -v
    fi
    
    # Entferne Verzeichnisse
    log_warn "Entferne Daten..."
    rm -rf "$INSTALL_DIR"
    rm -rf "$DATA_DIR"
    rm -rf "$WEB_DIR"
    rm -rf "$SUPABASE_DIR"
    
    log_success "✅ Nobis wurde deinstalliert"
    log_info "Backups verbleiben in: $BACKUP_DIR"
}

# ============================================================================
# Haupt-Installation
# ============================================================================

run_install() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║                                                   ║"
    echo "║   🚀 Nobis Construction Management Installation  ║"
    echo "║                                                   ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    # 1. System Dependencies
    check_and_install_all_dependencies
    
    # 2. Interaktive Konfiguration
    interactive_setup
    
    # 3. Erstelle Verzeichnisse
    log_step "Erstelle Verzeichnisse..."
    mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$BACKUP_DIR" "$WEB_DIR" "$LOG_DIR"
    log_success "Verzeichnisse erstellt"
    
    # 4. Supabase
    install_supabase
    
    # 5. Starte Supabase
    start_services
    
    # 6. Datenbank-Schema
    setup_database_schema
    
    # 7. Migration (optional)
    load_env
    if [ "$MIGRATE_FROM_CLOUD" == "2" ]; then
        log_info "Migration gewählt, starte Migrations-Wizard..."
        source_function "migrate"
        run_migration_wizard
    fi
    
    # 8. Frontend bauen
    build_frontend
    
    # 9. Nginx konfigurieren
    configure_nginx
    
    # 10. SSL einrichten
    setup_ssl
    
    # 11. Services neustarten
    stop_services
    start_services
    
    # 12. Health Checks
    log_step "Führe Health-Checks durch..."
    sleep 5
    
    # 13. Erfolgs-Meldung
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ✅ Nobis wurde erfolgreich installiert!                ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    load_env
    echo -e "${GREEN}🌐 Ihre Anwendung:${NC}"
    echo "   https://$DOMAIN"
    echo ""
    echo -e "${GREEN}🔑 Supabase Studio:${NC}"
    echo "   https://$DOMAIN:3000"
    echo "   Username: $DASHBOARD_USERNAME"
    echo "   Password: $DASHBOARD_PASSWORD"
    echo ""
    echo -e "${CYAN}📊 Nützliche Befehle:${NC}"
    echo "   sudo ./nobis.sh status      - System-Status anzeigen"
    echo "   sudo ./nobis.sh logs        - Logs anzeigen"
    echo "   sudo ./nobis.sh backup      - Backup erstellen"
    echo "   sudo ./nobis.sh update      - System updaten"
    echo "   sudo ./nobis.sh restart     - Services neustarten"
    echo ""
    echo -e "${CYAN}📖 Dokumentation:${NC}"
    echo "   $INSTALL_DIR/deployment/README.md"
    echo ""
    
    log_info "Installation abgeschlossen!"
}
