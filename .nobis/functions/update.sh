#!/bin/bash

# Update-Funktionen für Nobis

run_update() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║                                                   ║"
    echo "║   🔄 Nobis System Update                         ║"
    echo "║                                                   ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    # 1. Pre-Update Backup
    log_step "1/7 Erstelle Sicherheits-Backup..."
    source_function "backup"
    BACKUP_FILE=$(create_backup "pre_update")
    log_success "Backup erstellt: $BACKUP_FILE"
    
    # 2. Git Pull
    log_step "2/7 Hole neueste Version..."
    cd "$SCRIPT_DIR"
    
    # Stash lokale Änderungen
    git stash save "Auto-stash before update $(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    
    # Pull neueste Version
    if git pull origin main; then
        log_success "Code aktualisiert"
    else
        log_error "Git pull fehlgeschlagen"
        log_info "Versuche Backup wiederherzustellen..."
        source_function "backup"
        restore_backup "$BACKUP_FILE"
        exit 1
    fi
    
    # 3. Dependencies aktualisieren
    log_step "3/7 Aktualisiere Dependencies..."
    
    # Node.js Dependencies
    if [ -f "package.json" ]; then
        log_info "Aktualisiere npm packages..."
        npm ci --production=false
        log_success "npm dependencies aktualisiert"
    fi
    
    # 4. Datenbank-Migrationen
    log_step "4/7 Prüfe Datenbank-Migrationen..."
    
    if [ -d "$SCRIPT_DIR/deployment/migrations" ]; then
        local migration_dir="$SCRIPT_DIR/deployment/migrations"
        local applied_migrations_file="$DATA_DIR/applied_migrations.txt"
        
        # Erstelle Migration-Tracking Datei falls nicht vorhanden
        touch "$applied_migrations_file"
        
        # Finde neue Migrationen
        local new_migrations=false
        for migration_file in $(ls -1 "$migration_dir"/*.sql 2>/dev/null | sort); do
            local migration_name=$(basename "$migration_file")
            
            if ! grep -q "$migration_name" "$applied_migrations_file"; then
                log_info "Führe Migration aus: $migration_name"
                
                if docker exec -i supabase-db psql -U postgres < "$migration_file"; then
                    echo "$migration_name" >> "$applied_migrations_file"
                    log_success "Migration erfolgreich: $migration_name"
                    new_migrations=true
                else
                    log_error "Migration fehlgeschlagen: $migration_name"
                    log_info "Versuche Rollback..."
                    source_function "backup"
                    restore_backup "$BACKUP_FILE"
                    exit 1
                fi
            fi
        done
        
        if [ "$new_migrations" = true ]; then
            log_success "Datenbank-Migrationen abgeschlossen"
        else
            log_info "Keine neuen Migrationen gefunden"
        fi
    else
        log_info "Keine Migrations-Verzeichnis gefunden, überspringe..."
    fi
    
    # 5. Frontend neu bauen
    log_step "5/7 Baue Frontend neu..."
    source_function "install"
    build_frontend
    
    # 6. Supabase Docker Images aktualisieren
    log_step "6/7 Aktualisiere Supabase..."
    
    if [ -d "$SUPABASE_DIR/docker" ]; then
        cd "$SUPABASE_DIR/docker"
        
        log_info "Hole neueste Docker Images..."
        docker-compose pull
        
        log_success "Supabase Images aktualisiert"
    else
        log_warn "Supabase nicht gefunden, überspringe..."
    fi
    
    # 7. Services neustarten
    log_step "7/7 Starte Services neu..."
    source_function "install"
    
    log_info "Stoppe Services..."
    stop_services
    
    sleep 3
    
    log_info "Starte Services..."
    start_services
    
    # Warte auf Services
    log_info "Warte auf Services..."
    sleep 10
    
    # 8. Health Checks
    log_step "Führe Health-Checks durch..."
    
    local health_check_failed=false
    
    # Check Supabase API
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        log_success "Supabase API: OK"
    else
        log_error "Supabase API: FAILED"
        health_check_failed=true
    fi
    
    # Check Database
    if docker exec supabase-db psql -U postgres -c "SELECT 1" > /dev/null 2>&1; then
        log_success "Database: OK"
    else
        log_error "Database: FAILED"
        health_check_failed=true
    fi
    
    # Check Frontend
    load_env
    if [ -n "$DOMAIN" ]; then
        if curl -sfk "https://$DOMAIN" > /dev/null 2>&1; then
            log_success "Frontend: OK"
        else
            log_error "Frontend: FAILED"
            health_check_failed=true
        fi
    fi
    
    # Rollback bei Health-Check Fehlern
    if [ "$health_check_failed" = true ]; then
        log_error "Health-Checks fehlgeschlagen!"
        log_warn "Führe automatischen Rollback durch..."
        source_function "backup"
        restore_backup "$BACKUP_FILE"
        exit 1
    fi
    
    # 9. Cleanup alter Docker Images
    log_step "Räume alte Docker Images auf..."
    docker image prune -f > /dev/null 2>&1
    
    # Erfolgs-Meldung
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   ✅ Update erfolgreich abgeschlossen!                   ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    
    # Zeige Versions-Info
    local git_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local git_date=$(git log -1 --format=%cd --date=short 2>/dev/null || echo "unknown")
    
    echo -e "${CYAN}📦 Versions-Informationen:${NC}"
    echo "   Commit: $git_commit"
    echo "   Datum: $git_date"
    echo ""
    echo -e "${CYAN}💾 Backup:${NC}"
    echo "   Pre-Update Backup: $BACKUP_FILE"
    echo ""
    echo -e "${CYAN}🔍 Status prüfen:${NC}"
    echo "   sudo ./nobis.sh status"
    echo ""
    
    log_info "Update abgeschlossen!"
}

# Schnelles Update ohne Migrationen (für kleine Änderungen)
run_quick_update() {
    log_info "Starte Quick-Update (nur Frontend)..."
    
    cd "$SCRIPT_DIR"
    git pull origin main
    
    source_function "install"
    build_frontend
    
    systemctl reload nginx
    
    log_success "Quick-Update abgeschlossen"
}
