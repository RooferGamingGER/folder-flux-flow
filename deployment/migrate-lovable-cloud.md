# API-basierte Datenmigration von Lovable Cloud

## Übersicht

Da Lovable Cloud keinen direkten PostgreSQL-Zugriff erlaubt, verwenden wir die Supabase JavaScript SDK für die Migration.

## Benötigte Credentials

### Von Lovable Cloud (Quelle):
- **API URL**: `https://oeytdfnpisbjlalpeohf.supabase.co`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9leXRkZm5waXNiamxhbHBlb2hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyOTI2MDUsImV4cCI6MjA3Nzg2ODYwNX0.H26iLdeN4c22fMz0sH7gkoXaq_djmsthQa8qgj6Hmhc`
- **Service Role Key**: (aus Lovable Cloud Settings → Backend → API Keys)

### Zur Self-Hosted Instanz (Ziel):
- **API URL**: `http://localhost:8000` (oder Ihre Domain)
- **Service Role Key**: (aus der `.env` Datei Ihrer Installation)

## Migrations-Reihenfolge

### Phase 1: Basis-Daten (keine Abhängigkeiten)
1. `organizations` - Organisationen
2. `profiles` - Benutzerprofile (Auth-Daten werden nicht migriert)
3. `user_roles` - Benutzerrollen

### Phase 2: Ordner-Struktur
4. `folders` - Ordner
5. `folder_members` - Ordner-Mitglieder

### Phase 3: Projekte
6. `projects` - Projekte
7. `project_members` - Projekt-Mitglieder
8. `project_exclusions` - Projekt-Ausschlüsse
9. `project_details` - Projekt-Details
10. `project_directories` - Projekt-Verzeichnisse

### Phase 4: Inhalte
11. `messages` - Nachrichten
12. `notes` - Notizen
13. `contacts` - Kontakte
14. `project_files` - Datei-Metadaten (Storage-Dateien separat)

### Phase 5: System-Daten (optional)
15. `sync_queue` - Sync-Warteschlange (meist leer lassen)
16. `admin_settings` - Admin-Einstellungen
17. `alerts` - System-Alerts
18. `metrics_history` - Metriken (meist überspringen)

### Phase 6: Storage
19. Storage Bucket: `project-files`
20. Storage Bucket: `project-images`

## Wichtige Hinweise

### Auth-Benutzer
- **WICHTIG**: Auth-Benutzer (`auth.users`) können NICHT per API migriert werden
- Optionen:
  1. Benutzer müssen sich neu registrieren
  2. Admin erstellt Benutzer manuell über Edge Functions
  3. CSV-Import über Supabase Dashboard (nur bei Zugriff)

### User-IDs
- Da Auth-Benutzer neu erstellt werden, ändern sich die UUIDs
- Das Migrations-Skript kopiert UUIDs 1:1 (Profile behalten ihre IDs)
- Alle Foreign Keys auf `user_id` bleiben erhalten
- **Problem**: Benutzer können sich nicht anmelden, da Auth-Einträge fehlen

### Storage-Dateien
- Dateien werden einzeln heruntergeladen und hochgeladen
- Kann bei vielen/großen Dateien lange dauern
- Metadaten bleiben erhalten (Pfade, Namen, etc.)

### RLS-Policies
- Self-Hosted Instanz muss identische RLS-Policies haben
- Migrations-Skript verwendet **Service Role** (umgeht RLS)

## Geschätzte Dauer

- **Kleine Installation** (< 100 Projekte, < 1000 Dateien): 5-15 Minuten
- **Mittlere Installation** (100-500 Projekte, 1000-5000 Dateien): 15-60 Minuten
- **Große Installation** (> 500 Projekte, > 5000 Dateien): 1-4 Stunden

## Ausführung

```bash
cd /opt/nobis/deployment
npm install @supabase/supabase-js
node migrate-lovable-cloud.js
```

## Nach der Migration

1. **Benutzer-Accounts erstellen**
   - Admin muss Benutzer manuell anlegen mit **identischen UUIDs**
   - Oder: Benutzer registrieren sich neu (dann neue UUIDs → Datenverlust)

2. **Berechtigungen prüfen**
   - Projekt-Mitglieder zuweisen
   - Ordner-Mitglieder zuweisen
   - Rollen zuweisen

3. **Daten verifizieren**
   - Projekte vorhanden?
   - Nachrichten sichtbar?
   - Dateien abrufbar?

4. **Erste Anmeldung**
   - Admin-Account funktioniert?
   - Benutzer können sich anmelden?
