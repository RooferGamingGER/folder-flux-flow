#!/bin/bash

# Migrations-Funktionen für Nobis - Von Lovable Cloud zu Self-Hosted

run_migration_wizard() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   🔄 Lovable Cloud → Self-Hosted Migration              ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    log_warn "Dieser Wizard migriert Ihre Daten von Lovable Cloud zu Ihrer"
    log_warn "Self-Hosted Instanz. Der Prozess kann je nach Datenmenge"
    log_warn "einige Minuten bis Stunden dauern."
    echo ""
    
    # Credentials abfragen
    log_step "Schritt 1/4: Lovable Cloud Zugangsdaten"
    echo ""
    read -p "Lovable Cloud Hostname (z.B. db.xxx.supabase.co): " OLD_HOST
    read -sp "Lovable Cloud Postgres Password: " OLD_PASSWORD
    echo ""
    echo ""
    
    # Bestätigung
    log_info "Verbindungs-Test zu Lovable Cloud..."
    if ! PGPASSWORD="$OLD_PASSWORD" psql -h "$OLD_HOST" -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; then
        log_error "Verbindung zu Lovable Cloud fehlgeschlagen!"
        log_error "Bitte überprüfen Sie Hostname und Password"
        exit 1
    fi
    log_success "Verbindung erfolgreich"
    
    # Erstelle Migration-Verzeichnis
    local migration_dir="$DATA_DIR/migration_$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$migration_dir"
    
    # Schema Export
    log_step "Schritt 2/4: Exportiere Schema und Daten"
    echo ""
    
    export_schema_and_data "$OLD_HOST" "$OLD_PASSWORD" "$migration_dir"
    
    # Storage Migration
    log_step "Schritt 3/4: Migriere Storage-Dateien"
    echo ""
    
    read -p "Möchten Sie Storage-Dateien migrieren? (y/N): " migrate_storage
    if [[ "$migrate_storage" =~ ^[Yy]$ ]]; then
        migrate_storage_files
    else
        log_info "Storage-Migration übersprungen"
    fi
    
    # Import
    log_step "Schritt 4/4: Importiere Daten in Self-Hosted Instanz"
    echo ""
    
    import_data "$migration_dir"
    
    # Cleanup
    log_info "Räume temporäre Dateien auf..."
    # rm -rf "$migration_dir"
    
    # Verifizierung
    verify_migration
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   ✅ Migration erfolgreich abgeschlossen!                ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    log_success "Ihre Daten wurden erfolgreich migriert!"
    echo ""
    echo -e "${CYAN}📊 Nächste Schritte:${NC}"
    echo "   1. Überprüfen Sie die Daten in der Anwendung"
    echo "   2. Testen Sie alle Funktionen"
    echo "   3. Aktualisieren Sie Ihre .env Datei in der Anwendung"
    echo "   4. Deaktivieren Sie die alte Lovable Cloud Instanz"
    echo ""
}

export_schema_and_data() {
    local old_host="$1"
    local old_password="$2"
    local export_dir="$3"
    
    # Tabellen definieren
    local tables=(
        "organizations"
        "profiles"
        "user_roles"
        "folders"
        "folder_members"
        "projects"
        "project_members"
        "project_details"
        "project_directories"
        "project_files"
        "contacts"
        "notes"
        "messages"
        "project_exclusions"
        "sync_queue"
    )
    
    log_info "Exportiere Schema..."
    PGPASSWORD="$old_password" pg_dump \
        -h "$old_host" \
        -U postgres \
        -d postgres \
        --schema-only \
        --no-owner \
        --no-privileges \
        > "$export_dir/schema.sql" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Schema exportiert ($(du -h "$export_dir/schema.sql" | cut -f1))"
    else
        log_error "Schema-Export fehlgeschlagen"
        return 1
    fi
    
    # Exportiere Tabellen-Daten
    log_info "Exportiere Tabellen-Daten..."
    local table_count=0
    for table in "${tables[@]}"; do
        log_info "  → $table"
        
        PGPASSWORD="$old_password" pg_dump \
            -h "$old_host" \
            -U postgres \
            -d postgres \
            --data-only \
            --table="public.$table" \
            --no-owner \
            --no-privileges \
            > "$export_dir/${table}.sql" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            local size=$(du -h "$export_dir/${table}.sql" | cut -f1)
            log_success "    $table exportiert ($size)"
            table_count=$((table_count + 1))
        else
            log_warn "    $table fehlgeschlagen oder leer"
        fi
    done
    
    log_success "$table_count von ${#tables[@]} Tabellen exportiert"
    
    # Auth Users
    log_info "Exportiere Auth-Benutzer..."
    PGPASSWORD="$old_password" pg_dump \
        -h "$old_host" \
        -U postgres \
        -d postgres \
        --data-only \
        --table="auth.users" \
        --no-owner \
        --no-privileges \
        > "$export_dir/auth_users.sql" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Auth-Benutzer exportiert"
    fi
    
    # Storage Metadata
    log_info "Exportiere Storage-Metadata..."
    PGPASSWORD="$old_password" pg_dump \
        -h "$old_host" \
        -U postgres \
        -d postgres \
        --data-only \
        --table="storage.objects" \
        --table="storage.buckets" \
        --no-owner \
        --no-privileges \
        > "$export_dir/storage_metadata.sql" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "Storage-Metadata exportiert"
    fi
}

import_data() {
    local import_dir="$1"
    
    log_warn "WARNUNG: Existierende Daten werden überschrieben!"
    read -p "Fortfahren mit Import? (yes/NO): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Import abgebrochen"
        exit 0
    fi
    
    # Auth Users zuerst
    if [ -f "$import_dir/auth_users.sql" ]; then
        log_info "Importiere Auth-Benutzer..."
        docker exec -i supabase-db psql -U postgres < "$import_dir/auth_users.sql" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_success "Auth-Benutzer importiert"
        fi
    fi
    
    # Public Schema Tabellen
    log_info "Importiere Tabellen-Daten..."
    
    local tables=(
        "organizations"
        "profiles"
        "user_roles"
        "folders"
        "folder_members"
        "projects"
        "project_members"
        "project_details"
        "project_directories"
        "project_files"
        "contacts"
        "notes"
        "messages"
        "project_exclusions"
        "sync_queue"
    )
    
    local import_count=0
    for table in "${tables[@]}"; do
        if [ -f "$import_dir/${table}.sql" ]; then
            log_info "  → $table"
            
            docker exec -i supabase-db psql -U postgres < "$import_dir/${table}.sql" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                log_success "    $table importiert"
                import_count=$((import_count + 1))
            else
                log_warn "    $table fehlgeschlagen"
            fi
        fi
    done
    
    log_success "$import_count von ${#tables[@]} Tabellen importiert"
    
    # Storage Metadata
    if [ -f "$import_dir/storage_metadata.sql" ]; then
        log_info "Importiere Storage-Metadata..."
        docker exec -i supabase-db psql -U postgres < "$import_dir/storage_metadata.sql" 2>/dev/null
        if [ $? -eq 0 ]; then
            log_success "Storage-Metadata importiert"
        fi
    fi
    
    # Reset Sequences
    log_info "Setze Sequenzen zurück..."
    docker exec -i supabase-db psql -U postgres <<EOF
SELECT setval('organizations_id_seq', COALESCE((SELECT MAX(id) FROM organizations), 1));
SELECT setval('user_roles_id_seq', COALESCE((SELECT MAX(id) FROM user_roles), 1));
EOF
    log_success "Sequenzen zurückgesetzt"
}

migrate_storage_files() {
    log_info "Storage-Migration mit Node.js Script..."
    
    # Prüfe ob migrate-storage.js existiert
    if [ ! -f "$SCRIPT_DIR/deployment/migrate-storage.js" ]; then
        log_error "migrate-storage.js nicht gefunden"
        log_info "Bitte führen Sie die Storage-Migration manuell durch"
        return 1
    fi
    
    # Installiere Dependencies falls nötig
    if ! npm list @supabase/supabase-js > /dev/null 2>&1; then
        log_info "Installiere @supabase/supabase-js..."
        npm install @supabase/supabase-js
    fi
    
    # Führe Migration aus
    log_info "Starte Storage-Migration..."
    node "$SCRIPT_DIR/deployment/migrate-storage.js"
    
    if [ $? -eq 0 ]; then
        log_success "Storage-Migration abgeschlossen"
    else
        log_error "Storage-Migration fehlgeschlagen"
        log_info "Sie können die Migration später mit folgendem Befehl wiederholen:"
        log_info "  node $SCRIPT_DIR/deployment/migrate-storage.js"
    fi
}

verify_migration() {
    log_step "Verifiziere Migration..."
    echo ""
    
    log_info "Prüfe Datenbank-Tabellen..."
    
    # Zähle Datensätze in wichtigen Tabellen
    local tables_to_check=(
        "profiles:Benutzer"
        "projects:Projekte"
        "project_files:Dateien"
        "messages:Nachrichten"
    )
    
    for entry in "${tables_to_check[@]}"; do
        IFS=':' read -r table label <<< "$entry"
        
        local count=$(docker exec supabase-db psql -U postgres -t -c "SELECT COUNT(*) FROM $table" 2>/dev/null | tr -d ' ')
        
        if [ -n "$count" ] && [ "$count" != "0" ]; then
            log_success "  ✓ $label: $count Einträge"
        else
            log_warn "  ⚠ $label: Keine Daten oder Fehler"
        fi
    done
    
    echo ""
    log_success "Migrations-Verifizierung abgeschlossen"
}
