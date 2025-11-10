#!/bin/bash

# Nobis Construction Management - Zentrales Installations- und Verwaltungs-Script
# Inspiriert von WebODM's Installation Workflow

set -eo pipefail

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Konfigurationsvariablen
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/nobis"
DATA_DIR="/var/lib/nobis"
BACKUP_DIR="/var/backups/nobis"
WEB_DIR="/var/www/nobis-app"
SUPABASE_DIR="$INSTALL_DIR/supabase"
LOG_DIR="/var/log/nobis"
LOG_FILE="$LOG_DIR/nobis.log"

# Funktions-Verzeichnis
FUNCTIONS_DIR="$SCRIPT_DIR/.nobis/functions"
TEMPLATES_DIR="$SCRIPT_DIR/.nobis/templates"

# Version
VERSION="1.0.0"

# ============================================================================
# Logging Funktionen
# ============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_step() {
    echo -e "${CYAN}[STEP]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

# ============================================================================
# Helper Funktionen
# ============================================================================

check_root() {
    if [ "$EUID" -ne 0 ]; then 
        log_error "Dieses Script muss als root ausgeführt werden (sudo)"
        exit 1
    fi
}

ensure_log_dir() {
    mkdir -p "$LOG_DIR"
    chmod 755 "$LOG_DIR"
}

load_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        set -a
        source "$INSTALL_DIR/.env"
        set +a
    fi
}

check_dependencies() {
    local deps=("curl" "git" "tar" "openssl")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Fehlende Abhängigkeit: $dep"
            return 1
        fi
    done
    return 0
}

# ============================================================================
# Haupt-Funktionen - Laden aus separaten Dateien
# ============================================================================

source_function() {
    local func_file="$FUNCTIONS_DIR/$1.sh"
    if [ -f "$func_file" ]; then
        source "$func_file"
    else
        log_error "Funktions-Datei nicht gefunden: $func_file"
        exit 1
    fi
}

# ============================================================================
# Befehls-Dispatcher
# ============================================================================

cmd_install() {
    check_root
    ensure_log_dir
    log_info "Starte Nobis Installation v$VERSION"
    source_function "install"
    run_install
}

cmd_start() {
    check_root
    log_info "Starte Nobis Services..."
    source_function "install"
    start_services
}

cmd_stop() {
    check_root
    log_info "Stoppe Nobis Services..."
    source_function "install"
    stop_services
}

cmd_restart() {
    check_root
    log_info "Starte Nobis Services neu..."
    source_function "install"
    stop_services
    sleep 3
    start_services
}

cmd_update() {
    check_root
    ensure_log_dir
    log_info "Starte Nobis Update..."
    source_function "update"
    run_update
}

cmd_backup() {
    check_root
    ensure_log_dir
    log_info "Erstelle Backup..."
    source_function "backup"
    run_backup
}

cmd_restore() {
    check_root
    ensure_log_dir
    log_info "Stelle Backup wieder her..."
    source_function "backup"
    run_restore
}

cmd_migrate() {
    check_root
    ensure_log_dir
    log_info "Starte Migrations-Wizard..."
    source_function "migrate"
    run_migration_wizard
}

cmd_status() {
    load_env
    source_function "install"
    show_status
}

cmd_logs() {
    local service="${1:-all}"
    source_function "install"
    show_logs "$service"
}

cmd_uninstall() {
    check_root
    log_warn "⚠️  ACHTUNG: Dies wird Nobis vollständig entfernen!"
    read -p "Sind Sie sicher? (yes/NO): " confirm
    if [ "$confirm" != "yes" ]; then
        log_info "Deinstallation abgebrochen"
        exit 0
    fi
    source_function "install"
    run_uninstall
}

cmd_version() {
    echo "Nobis Installation Script v$VERSION"
}

cmd_help() {
    cat << EOF
╔═══════════════════════════════════════════════════════════════╗
║          Nobis Construction Management v$VERSION               ║
║          Zentrales Installations- und Verwaltungs-Tool         ║
╚═══════════════════════════════════════════════════════════════╝

Verwendung: sudo ./nobis.sh [BEFEHL] [OPTIONEN]

VERFÜGBARE BEFEHLE:

  install           Komplette Erstinstallation von Nobis
                    - Prüft und installiert automatisch alle Dependencies
                    - Richtet Supabase Self-Hosted ein
                    - Konfiguriert Nginx und SSL
                    - Baut und deployed das Frontend

  start             Startet alle Nobis Services
                    - Supabase Docker Container
                    - Nginx Webserver
                    
  stop              Stoppt alle Nobis Services

  restart           Startet alle Services neu

  update            Aktualisiert Nobis auf die neueste Version
                    - Erstellt automatisch ein Backup
                    - Führt Git Pull aus
                    - Aktualisiert Dependencies
                    - Führt Datenbank-Migrationen aus
                    - Baut Frontend neu
                    - Startet Services neu

  backup            Erstellt ein vollständiges Backup
                    - Datenbank-Dump
                    - Storage-Dateien
                    - Konfigurationen
                    
  restore           Stellt ein Backup wieder her
                    - Interaktive Auswahl verfügbarer Backups
                    
  migrate           Migriert Daten von Lovable Cloud
                    - Interaktiver Migrations-Wizard
                    - Schema-Export
                    - Daten-Migration
                    - Storage-Migration

  status            Zeigt den Status aller Services
                    - Docker Container Status
                    - Health Checks
                    - Speicherplatz
                    - Systemressourcen

  logs [service]    Zeigt Logs an
                    - all (Standard): Alle Logs
                    - supabase: Supabase Logs
                    - nginx: Nginx Logs
                    - app: Application Logs

  uninstall         Entfernt Nobis vollständig
                    ⚠️  WARNUNG: Löscht alle Daten!

  version           Zeigt die installierte Version

  help              Zeigt diese Hilfe

BEISPIELE:

  # Erstinstallation
  sudo ./nobis.sh install

  # System updaten
  sudo ./nobis.sh update

  # Backup erstellen
  sudo ./nobis.sh backup

  # Status prüfen
  sudo ./nobis.sh status

  # Nginx Logs anzeigen
  sudo ./nobis.sh logs nginx

DOKUMENTATION:

  Vollständige Dokumentation: $INSTALL_DIR/deployment/README.md
  GitHub: https://github.com/IHR-REPO/nobis-app

SUPPORT:

  Bei Problemen: https://github.com/IHR-REPO/nobis-app/issues

EOF
}

# ============================================================================
# Hauptprogramm
# ============================================================================

main() {
    ensure_log_dir
    
    # Prüfe grundlegende Abhängigkeiten
    if ! check_dependencies; then
        log_error "Bitte installieren Sie die fehlenden Abhängigkeiten"
        exit 1
    fi
    
    # Kommando verarbeiten
    case "${1:-help}" in
        install)
            cmd_install
            ;;
        start)
            cmd_start
            ;;
        stop)
            cmd_stop
            ;;
        restart)
            cmd_restart
            ;;
        update)
            cmd_update
            ;;
        backup)
            cmd_backup
            ;;
        restore)
            cmd_restore
            ;;
        migrate)
            cmd_migrate
            ;;
        status)
            cmd_status
            ;;
        logs)
            cmd_logs "${2:-all}"
            ;;
        uninstall)
            cmd_uninstall
            ;;
        version)
            cmd_version
            ;;
        help|--help|-h)
            cmd_help
            ;;
        *)
            log_error "Unbekannter Befehl: $1"
            echo ""
            cmd_help
            exit 1
            ;;
    esac
}

# Script ausführen
main "$@"
