# Self-Hosted Nobis Setup Guide

## ⚠️ Wichtig: Von Lovable Cloud getrennt
Diese Installation ist von Lovable Cloud getrennt und läuft komplett auf Ihrem eigenen Server.

## Finales Setup (einmalig ausführen)

### 1. Email-Bestätigung deaktivieren
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
UPDATE auth.config 
SET enable_signup = true, 
    enable_email_confirmations = false
WHERE id = 'global';
"
```

### 2. Storage-Buckets öffentlich machen
```bash
docker exec -it supabase-db psql -U postgres -d postgres -c "
UPDATE storage.buckets 
SET public = true 
WHERE id IN ('project-files', 'project-images');
"
```

### 3. Ersten Admin-Account anlegen
1. Öffnen Sie https://nobis-overdick.digital
2. Registrieren Sie sich mit Ihrer Email
3. Dieser erste Nutzer wird automatisch zum Admin (`geschaeftsfuehrer`)

### 4. Frontend deployen
```bash
cd /opt/nobis
chmod +x scripts/build-and-deploy.sh
./scripts/build-and-deploy.sh
```

## Workflow für zukünftige Updates

### Code-Änderungen deployen
```bash
cd /opt/nobis
npm run build
./scripts/build-and-deploy.sh
```

### Datenbank-Schema ändern
1. SQL-Migration erstellen in `supabase/migrations/`
2. Migration ausführen:
   ```bash
   docker exec -it supabase-db psql -U postgres -d postgres -f /pfad/zur/migration.sql
   ```
3. TypeScript-Typen aktualisieren:
   ```bash
   ./scripts/update-supabase-types.sh
   ```
4. Frontend neu bauen und deployen:
   ```bash
   npm run build
   ./scripts/build-and-deploy.sh
   ```

## Architektur

### Backend (Self-Hosted Supabase)
- **URL**: https://nobis-overdick.digital/api
- **Postgres**: localhost:5432
- **Studio**: http://localhost:3000
- **Anon Key**: WlfcSIeL2PrnArmA0y4sqy8jLHMRYg8BAJLbvUIg

### Frontend
- **URL**: https://nobis-overdick.digital
- **Build-Output**: `/var/www/nobis-app/`
- **Webserver**: Nginx

### Wichtige Dateien
- `src/integrations/supabase/client.ts` - ⚠️ Manuell gepatcht für Self-Hosted
- `.env` - Lokale Supabase-URLs und Keys
- `scripts/build-and-deploy.sh` - Deployment-Script
- `scripts/update-supabase-types.sh` - Typen-Generator

## Troubleshooting

### Frontend zeigt Login-Fehler
1. Browser-Cache löschen (Strg+Shift+Delete)
2. Überprüfen ob Supabase läuft:
   ```bash
   docker compose -f /opt/supabase-stack/docker-compose.yml ps
   ```
3. Nginx-Logs prüfen:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

### Datenbank-Verbindung fehlschlägt
```bash
# Supabase-Logs anzeigen
docker logs supabase-db
docker logs supabase-kong

# Neustart falls nötig
cd /opt/supabase-stack
docker compose restart
```

### Upload schlägt fehl
```bash
# Storage-Bucket-Permissions prüfen
docker exec -it supabase-db psql -U postgres -d postgres -c "
SELECT * FROM storage.buckets WHERE id IN ('project-files', 'project-images');
"
# public sollte true sein
```

## Backup & Wartung

### Datenbank-Backup
```bash
docker exec supabase-db pg_dump -U postgres postgres > backup-$(date +%Y%m%d).sql
```

### Datenbank wiederherstellen
```bash
docker exec -i supabase-db psql -U postgres postgres < backup-20250101.sql
```

### Storage-Backup
```bash
# Storage liegt in Docker-Volume
docker run --rm -v supabase_storage_data:/data -v $(pwd):/backup ubuntu tar czf /backup/storage-backup.tar.gz /data
```
