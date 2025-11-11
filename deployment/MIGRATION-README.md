# Craftnote → Nobis Migration

Vollautomatische Migration aller Craftnote-Daten über API.

## Vorbereitungen

### 1. Umgebungsvariablen einrichten

```bash
# .env.craftnote.example nach .env.craftnote kopieren
cp .env.craftnote.example .env.craftnote

# Service Key eintragen (aus Supabase Dashboard -> Settings -> API)
nano .env.craftnote
```

### 2. Dependencies installieren

```bash
cd deployment
npm install @supabase/supabase-js node-fetch dotenv
```

### 3. Skripte ausführbar machen

```bash
chmod +x craftnote-api-discover.cjs
chmod +x migrate-craftnote-api.cjs
```

## Migration durchführen

### Schritt 1: API-Discovery (Optional, aber empfohlen)

```bash
node craftnote-api-discover.cjs
```

Dies analysiert die Craftnote-API-Struktur und speichert die Ergebnisse in `craftnote-api-structure.json`.

### Schritt 2: Test-Migration (10 Projekte)

Für einen Test zuerst `BATCH_SIZE` in `migrate-craftnote-api.cjs` auf `10` setzen:

```javascript
const BATCH_SIZE = 10; // Nur 10 Projekte zum Testen
```

Dann Test-Migration starten:

```bash
node migrate-craftnote-api.cjs
```

### Schritt 3: Vollständige Migration

Nach erfolgreichem Test `BATCH_SIZE` zurück auf `100` setzen und vollständige Migration starten:

```bash
node migrate-craftnote-api.cjs
```

**Erwartete Dauer:**
- 4000 Projekte (ohne Dateien): 40-60 Minuten
- Mit Dateien: mehrere Stunden

## Was wird migriert?

✅ **Benutzer** → `profiles`, `user_roles`
✅ **Ordner** → `folders`, `folder_members`  
✅ **Projekte** → `projects`, `project_details`, `project_directories`
✅ **Projekt-Mitglieder** → `project_members`
✅ **Dateien** → `project_files`, `storage.objects`
✅ **Nachrichten** → `messages`
✅ **Notizen** → `notes`
✅ **Kontakte** → `contacts`

## Nach der Migration

1. **Daten validieren** - Prüfe Anzahl migrierter Einträge
2. **Fehler-Log prüfen** - Falls vorhanden: `migration-errors-craftnote.json`
3. **Passwörter zurücksetzen** - Alle importierten User haben `must_change_password=true`
4. **Berechtigungen prüfen** - Rolle-Mapping validieren
5. **Parallel-Betrieb** - Craftnote + Nobis für 2-4 Wochen parallel betreiben

## Validierungs-SQL

```sql
-- Anzahl Projekte
SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL;

-- Anzahl Dateien
SELECT COUNT(*) FROM project_files WHERE deleted_at IS NULL;

-- Anzahl Nachrichten
SELECT COUNT(*) FROM messages WHERE deleted_at IS NULL;

-- Projekt-Details-Vollständigkeit
SELECT 
  COUNT(DISTINCT p.id) as projects_total,
  COUNT(DISTINCT pd.project_id) as projects_with_details
FROM projects p
LEFT JOIN project_details pd ON p.id = pd.project_id;

-- Benutzer-Rollen
SELECT role, COUNT(*) 
FROM user_roles 
GROUP BY role;
```

## Rollback

```bash
# Vor Migration: Backup erstellen
pg_dump -U postgres nobis > backup-pre-craftnote-$(date +%Y%m%d).sql

# Im Notfall: Restore
psql -U postgres nobis < backup-pre-craftnote-20250111.sql
```

## Troubleshooting

### Fehler: "CRAFTNOTE_API_KEY nicht gesetzt"
→ Prüfe, ob `.env.craftnote` existiert und korrekt ist

### Fehler: "Verbindung fehlgeschlagen"
→ Prüfe `NOBIS_SUPABASE_SERVICE_KEY` (nicht Anon Key!)

### Fehler: "Admin-User nicht gefunden"
→ E-Mail-Adresse eines existierenden Admins eingeben

### Fehler bei einzelnen Projekten
→ Siehe `migration-errors-craftnote.json` für Details

## Sicherheit

⚠️ **WICHTIG:**
- `.env.craftnote` enthält sensitive Credentials
- **NIEMALS** in Git committen (bereits in `.gitignore`)
- Nach Migration API-Keys rotieren (falls möglich)
- Service Keys sicher verwahren

## Support

Bei Problemen:
1. Prüfe `migration-errors-craftnote.json`
2. Prüfe Supabase Logs
3. Teste mit kleinem Batch (`BATCH_SIZE = 10`)
