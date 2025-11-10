#!/bin/bash

# Backup und Restore Funktionen für Nobis

create_backup() {
    local backup_type="${1:-manual}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="nobis_${backup_type}_${timestamp}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$backup_path"
    
    log_info "Erstelle Backup: $backup_name"
    
    # 1. Datenbank
    log_info "  [1/5] Sichere Datenbank..."
    if docker exec supabase-db pg_dumpall -U postgres > "$backup_path/database.sql" 2>/dev/null; then
        log_success "  Datenbank gesichert ($(du -h "$backup_path/database.sql" | cut -f1))"
    else
        log_error "  Datenbank-Backup fehlgeschlagen"
        return 1
    fi
    
    # 2. Storage Files
    log_info "  [2/5] Sichere Storage-Dateien..."
    local storage_volume=$(docker volume ls -q | grep supabase_storage 2>/dev/null)
    if [ -n "$storage_volume" ]; then
        docker run --rm -v "$storage_volume:/data" -v "$backup_path:/backup" \
            ubuntu tar czf /backup/storage.tar.gz -C /data . 2>/dev/null
        log_success "  Storage gesichert ($(du -h "$backup_path/storage.tar.gz" | cut -f1))"
    else
        log_warn "  Kein Storage Volume gefunden"
        echo "0" > "$backup_path/storage.tar.gz"
    fi
    
    # 3. Konfiguration
    log_info "  [3/5] Sichere Konfiguration..."
    if [ -f "$INSTALL_DIR/.env" ]; then
        cp "$INSTALL_DIR/.env" "$backup_path/nobis.env"
        log_success "  Nobis Config gesichert"
    fi
    
    if [ -f "$SUPABASE_DIR/docker/.env" ]; then
        cp "$SUPABASE_DIR/docker/.env" "$backup_path/supabase.env"
        log_success "  Supabase Config gesichert"
    fi
    
    # 4. Nginx Config
    if [ -f "/etc/nginx/sites-available/nobis" ]; then
        cp "/etc/nginx/sites-available/nobis" "$backup_path/nginx.conf"
        log_success "  Nginx Config gesichert"
    fi
    
    # 5. Metadata
    log_info "  [4/5] Erstelle Backup-Metadata..."
    cat > "$backup_path/metadata.json" <<EOF
{
  "backup_name": "$backup_name",
  "backup_type": "$backup_type",
  "timestamp": "$timestamp",
  "date": "$(date +%Y-%m-%d\ %H:%M:%S)",
  "hostname": "$(hostname)",
  "version": "$VERSION",
  "git_commit": "$(cd $SCRIPT_DIR && git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
}
EOF
    
    # 6. Komprimieren
    log_info "  [5/5] Komprimiere Backup..."
    cd "$BACKUP_DIR"
    tar czf "$backup_name.tar.gz" "$backup_name" 2>/dev/null
    rm -rf "$backup_name"
    
    local backup_size=$(du -h "$BACKUP_DIR/$backup_name.tar.gz" | cut -f1)
    log_success "  Backup komprimiert: $backup_size"
    
    echo "$BACKUP_DIR/$backup_name.tar.gz"
}

run_backup() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║                                                   ║"
    echo "║   📦 Nobis Backup                                ║"
    echo "║                                                   ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_file=$(create_backup "manual")
    
    # Cleanup alte Backups (behalte letzte 7 Tage manuelle Backups)
    log_info "Räume alte Backups auf..."
    find "$BACKUP_DIR" -name "nobis_manual_*.tar.gz" -mtime +7 -delete
    
    # Cleanup alte Pre-Update Backups (behalte letzte 3)
    local pre_update_backups=$(ls -t "$BACKUP_DIR"/nobis_pre_update_*.tar.gz 2>/dev/null | tail -n +4)
    if [ -n "$pre_update_backups" ]; then
        echo "$pre_update_backups" | xargs rm -f
    fi
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   ✅ Backup erfolgreich erstellt!                        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${CYAN}📦 Backup-Details:${NC}"
    echo "   Datei: $backup_file"
    echo "   Größe: $(du -h "$backup_file" | cut -f1)"
    echo ""
    echo -e "${CYAN}📊 Backup-Übersicht:${NC}"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null | awk '{print "   "$9" - "$5}' || echo "   Keine Backups gefunden"
    echo ""
    echo -e "${CYAN}🔄 Wiederherstellen:${NC}"
    echo "   sudo ./nobis.sh restore"
    echo ""
}

restore_backup() {
    local backup_file="$1"
    
    log_info "Stelle Backup wieder her: $backup_file"
    
    # Extrahiere Backup
    local temp_dir="$BACKUP_DIR/restore_temp_$$"
    mkdir -p "$temp_dir"
    tar xzf "$backup_file" -C "$temp_dir"
    
    local backup_dir=$(ls -1 "$temp_dir" | head -1)
    local restore_path="$temp_dir/$backup_dir"
    
    # Stoppe Services
    log_info "Stoppe Services..."
    source_function "install"
    stop_services
    
    # Restore Datenbank
    log_info "Stelle Datenbank wieder her..."
    start_services
    sleep 10
    
    if [ -f "$restore_path/database.sql" ]; then
        docker exec -i supabase-db psql -U postgres < "$restore_path/database.sql"
        log_success "Datenbank wiederhergestellt"
    fi
    
    # Restore Storage
    log_info "Stelle Storage wieder her..."
    if [ -f "$restore_path/storage.tar.gz" ]; then
        local storage_volume=$(docker volume ls -q | grep supabase_storage 2>/dev/null)
        if [ -n "$storage_volume" ]; then
            docker run --rm -v "$storage_volume:/data" -v "$restore_path:/backup" \
                ubuntu tar xzf /backup/storage.tar.gz -C /data
            log_success "Storage wiederhergestellt"
        fi
    fi
    
    # Restore Configs
    log_info "Stelle Konfigurationen wieder her..."
    [ -f "$restore_path/nobis.env" ] && cp "$restore_path/nobis.env" "$INSTALL_DIR/.env"
    [ -f "$restore_path/supabase.env" ] && cp "$restore_path/supabase.env" "$SUPABASE_DIR/docker/.env"
    [ -f "$restore_path/nginx.conf" ] && cp "$restore_path/nginx.conf" "/etc/nginx/sites-available/nobis"
    
    # Cleanup
    rm -rf "$temp_dir"
    
    # Starte Services
    log_info "Starte Services neu..."
    stop_services
    sleep 3
    start_services
    
    log_success "Backup wiederhergestellt"
}

run_restore() {
    echo ""
    echo "╔═══════════════════════════════════════════════════╗"
    echo "║                                                   ║"
    echo "║   🔄 Nobis Backup Wiederherstellen               ║"
    echo "║                                                   ║"
    echo "╚═══════════════════════════════════════════════════╝"
    echo ""
    
    # Liste verfügbare Backups
    log_info "Verfügbare Backups:"
    echo ""
    
    local backups=($(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        log_error "Keine Backups gefunden in $BACKUP_DIR"
        exit 1
    fi
    
    # Zeige Backups mit Details
    local i=1
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local backup_size=$(du -h "$backup" | cut -f1)
        local backup_date=$(stat -c %y "$backup" | cut -d. -f1)
        
        echo "  [$i] $backup_name"
        echo "      Größe: $backup_size | Datum: $backup_date"
        echo ""
        i=$((i + 1))
    done
    
    # Auswahl
    read -p "Backup-Nummer zum Wiederherstellen [1-${#backups[@]}]: " backup_num
    
    if ! [[ "$backup_num" =~ ^[0-9]+$ ]] || [ "$backup_num" -lt 1 ] || [ "$backup_num" -gt ${#backups[@]} ]; then
        log_error "Ungültige Auswahl"
        exit 1
    fi
    
    local selected_backup="${backups[$((backup_num - 1))]}"
    
    # Bestätigung
    echo ""
    log_warn "⚠️  WARNUNG: Dies wird alle aktuellen Daten überschreiben!"
    echo "   Backup: $(basename "$selected_backup")"
    echo ""
    read -p "Fortfahren? (yes/NO): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Wiederherstellung abgebrochen"
        exit 0
    fi
    
    # Erstelle Sicherheits-Backup vor Restore
    log_info "Erstelle Sicherheits-Backup der aktuellen Daten..."
    create_backup "pre_restore"
    
    # Restore
    restore_backup "$selected_backup"
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   ✅ Backup erfolgreich wiederhergestellt!               ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo -e "${CYAN}🔍 Status prüfen:${NC}"
    echo "   sudo ./nobis.sh status"
    echo ""
}

# Liste alle Backups
list_backups() {
    log_info "Verfügbare Backups in $BACKUP_DIR:"
    echo ""
    
    local backups=($(ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null))
    
    if [ ${#backups[@]} -eq 0 ]; then
        echo "  Keine Backups gefunden"
        return
    fi
    
    local total_size=0
    for backup in "${backups[@]}"; do
        local backup_name=$(basename "$backup")
        local backup_size=$(du -b "$backup" | cut -f1)
        local backup_size_h=$(du -h "$backup" | cut -f1)
        local backup_date=$(stat -c %y "$backup" | cut -d. -f1)
        
        echo "  📦 $backup_name"
        echo "     Größe: $backup_size_h | Datum: $backup_date"
        echo ""
        
        total_size=$((total_size + backup_size))
    done
    
    local total_size_h=$(echo "$total_size" | awk '{sum=$1; hum[1024**3]="GB"; hum[1024**2]="MB"; hum[1024]="KB"; for (x=1024**3; x>=1024; x/=1024){ if (sum>=x) { printf "%.2f %s\n",sum/x,hum[x]; break }}}')
    
    echo "  Gesamt: ${#backups[@]} Backups, $total_size_h"
}
