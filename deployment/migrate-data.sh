#!/bin/bash
set -e

echo "📦 Datenmigration von Lovable Cloud zu Self-Hosted Supabase"
echo "============================================================"

# Farben
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Konfiguration
read -p "Lovable Cloud Host (oeytdfnpisbjlalpeohf.supabase.co): " OLD_HOST
OLD_HOST=${OLD_HOST:-oeytdfnpisbjlalpeohf.supabase.co}

read -p "Lovable Cloud DB Password: " OLD_PASSWORD
read -p "Neuer Supabase Host (localhost): " NEW_HOST
NEW_HOST=${NEW_HOST:-localhost}

read -p "Neues Supabase DB Password: " NEW_PASSWORD

# Backup-Verzeichnis erstellen
BACKUP_DIR="/tmp/supabase-migration-$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
log_info "Backup-Verzeichnis: $BACKUP_DIR"

# Tabellen die migriert werden sollen
TABLES=(
    "organizations"
    "profiles"
    "user_roles"
    "folders"
    "folder_members"
    "projects"
    "project_members"
    "project_exclusions"
    "project_details"
    "project_directories"
    "project_files"
    "messages"
    "notes"
    "contacts"
    "sync_queue"
)

# Schritt 1: Schema exportieren
log_info "Exportiere Schema von Lovable Cloud..."
PGPASSWORD=$OLD_PASSWORD pg_dump \
    -h $OLD_HOST \
    -U postgres \
    -d postgres \
    --schema-only \
    --no-owner \
    --no-privileges \
    > $BACKUP_DIR/schema.sql

if [ $? -eq 0 ]; then
    log_info "✅ Schema erfolgreich exportiert"
else
    log_error "❌ Schema-Export fehlgeschlagen"
    exit 1
fi

# Schritt 2: Daten für jede Tabelle exportieren
log_info "Exportiere Daten von Lovable Cloud..."
for table in "${TABLES[@]}"; do
    log_info "Exportiere Tabelle: $table"
    
    PGPASSWORD=$OLD_PASSWORD pg_dump \
        -h $OLD_HOST \
        -U postgres \
        -d postgres \
        --data-only \
        --no-owner \
        --no-privileges \
        -t public.$table \
        > $BACKUP_DIR/${table}_data.sql
    
    if [ $? -eq 0 ]; then
        log_info "  ✅ $table exportiert"
    else
        log_warn "  ⚠️  Fehler beim Export von $table (könnte leer sein)"
    fi
done

# Schritt 3: Auth-User exportieren
log_info "Exportiere Benutzer aus auth.users..."
PGPASSWORD=$OLD_PASSWORD pg_dump \
    -h $OLD_HOST \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    -t auth.users \
    > $BACKUP_DIR/auth_users_data.sql

# Schritt 4: Storage-Metadaten exportieren
log_info "Exportiere Storage-Metadaten..."
PGPASSWORD=$OLD_PASSWORD pg_dump \
    -h $OLD_HOST \
    -U postgres \
    -d postgres \
    --data-only \
    --no-owner \
    --no-privileges \
    -t storage.objects \
    -t storage.buckets \
    > $BACKUP_DIR/storage_metadata.sql

log_info "✅ Export abgeschlossen"

# Schritt 5: Daten in neue Datenbank importieren
echo ""
log_info "Importiere Daten in neue Supabase-Instanz..."
log_warn "ACHTUNG: Dies überschreibt existierende Daten!"
read -p "Fortfahren? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    log_warn "Import abgebrochen"
    exit 0
fi

# Auth-User importieren (muss zuerst)
log_info "Importiere auth.users..."
PGPASSWORD=$NEW_PASSWORD psql \
    -h $NEW_HOST \
    -U postgres \
    -d postgres \
    -f $BACKUP_DIR/auth_users_data.sql

# Public-Tabellen importieren
for table in "${TABLES[@]}"; do
    if [ -f "$BACKUP_DIR/${table}_data.sql" ]; then
        log_info "Importiere $table..."
        
        PGPASSWORD=$NEW_PASSWORD psql \
            -h $NEW_HOST \
            -U postgres \
            -d postgres \
            -f $BACKUP_DIR/${table}_data.sql
        
        if [ $? -eq 0 ]; then
            log_info "  ✅ $table importiert"
        else
            log_error "  ❌ Fehler beim Import von $table"
        fi
    fi
done

# Storage-Metadaten importieren
log_info "Importiere Storage-Metadaten..."
PGPASSWORD=$NEW_PASSWORD psql \
    -h $NEW_HOST \
    -U postgres \
    -d postgres \
    -f $BACKUP_DIR/storage_metadata.sql

log_info "✅ Datenimport abgeschlossen"

# Schritt 6: Sequenzen zurücksetzen
log_info "Setze Sequenzen zurück..."
PGPASSWORD=$NEW_PASSWORD psql -h $NEW_HOST -U postgres -d postgres <<EOF
SELECT setval(pg_get_serial_sequence('public.organizations', 'id'), (SELECT MAX(id) FROM public.organizations));
SELECT setval(pg_get_serial_sequence('public.user_roles', 'id'), (SELECT MAX(id) FROM public.user_roles));
EOF

# Schritt 7: Statistiken anzeigen
log_info "Migrationsstatistiken:"
PGPASSWORD=$NEW_PASSWORD psql -h $NEW_HOST -U postgres -d postgres <<EOF
SELECT 'organizations' as table_name, COUNT(*) as row_count FROM public.organizations
UNION ALL SELECT 'profiles', COUNT(*) FROM public.profiles
UNION ALL SELECT 'user_roles', COUNT(*) FROM public.user_roles
UNION ALL SELECT 'folders', COUNT(*) FROM public.folders
UNION ALL SELECT 'projects', COUNT(*) FROM public.projects
UNION ALL SELECT 'project_files', COUNT(*) FROM public.project_files
UNION ALL SELECT 'messages', COUNT(*) FROM public.messages;
EOF

echo ""
log_info "✅ Datenmigration abgeschlossen!"
log_info "Backup gespeichert in: $BACKUP_DIR"
log_info ""
log_info "Nächste Schritte:"
log_info "  1. Migriere Storage-Dateien: node migrate-storage.js"
log_info "  2. Teste die neue Instanz gründlich"
log_info "  3. Aktualisiere .env in deiner App"
echo ""
