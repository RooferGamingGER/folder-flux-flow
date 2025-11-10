# Nobis Construction Management - Schnell-Installation

## 🚀 Schnellstart (WebODM-Style)

Die Installation von Nobis ist so einfach wie WebODM - ein zentrales Script erledigt alles automatisch!

### Voraussetzungen

- Ubuntu 20.04 oder 22.04 Server
- Mindestens 4GB RAM, 2 CPU Cores
- Root/sudo Zugriff
- Domain mit DNS auf Server zeigend

### Installation in 3 Schritten

```bash
# 1. System aktualisieren
sudo apt-get update && sudo apt-get upgrade -y

# 2. Repository klonen
git clone https://github.com/IHR-REPO/nobis-app.git /opt/nobis
cd /opt/nobis

# 3. Installation starten
sudo ./nobis.sh install
```

Das war's! 🎉

Der Installations-Wizard wird Sie durch den Rest führen und:
- ✅ Alle Dependencies automatisch installieren (Docker, Node.js, Nginx, etc.)
- ✅ Supabase Self-Hosted aufsetzen
- ✅ SSL-Zertifikate einrichten
- ✅ Frontend bauen und deployen
- ✅ Optional: Daten von Lovable Cloud migrieren

## 📦 Verfügbare Befehle

Nach der Installation stehen folgende Befehle zur Verfügung:

```bash
sudo ./nobis.sh install    # Erstinstallation
sudo ./nobis.sh start      # System starten
sudo ./nobis.sh stop       # System stoppen
sudo ./nobis.sh restart    # System neustarten
sudo ./nobis.sh update     # System updaten
sudo ./nobis.sh backup     # Backup erstellen
sudo ./nobis.sh restore    # Backup wiederherstellen
sudo ./nobis.sh migrate    # Daten von Lovable Cloud migrieren
sudo ./nobis.sh status     # System-Status anzeigen
sudo ./nobis.sh logs       # Logs anzeigen
sudo ./nobis.sh uninstall  # System entfernen
sudo ./nobis.sh help       # Hilfe anzeigen
```

## 🔄 Updates

Updates sind genau so einfach wie bei WebODM:

```bash
cd /opt/nobis
sudo ./nobis.sh update
```

Das Update-Script:
- Erstellt automatisch ein Backup
- Holt die neueste Version von GitHub
- Führt Datenbank-Migrationen aus
- Baut das Frontend neu
- Startet Services neu
- Bei Fehlern: Automatischer Rollback zum Backup

## 📊 System überwachen

```bash
# Status aller Services
sudo ./nobis.sh status

# Logs anzeigen
sudo ./nobis.sh logs all        # Alle Logs
sudo ./nobis.sh logs supabase   # Nur Supabase
sudo ./nobis.sh logs nginx      # Nur Nginx
```

## 💾 Backups

```bash
# Manuelles Backup erstellen
sudo ./nobis.sh backup

# Backup wiederherstellen
sudo ./nobis.sh restore
```

Automatische Backups:
- Vor jedem Update
- Alte Backups werden automatisch nach 7 Tagen gelöscht

## 🔄 Migration von Lovable Cloud

Wenn Sie von Lovable Cloud migrieren möchten:

```bash
sudo ./nobis.sh migrate
```

Der Migrations-Wizard führt Sie durch:
1. Verbindung zu Lovable Cloud
2. Export von Schema und Daten
3. Migration von Storage-Dateien
4. Import in Self-Hosted Instanz
5. Verifizierung der Migration

## 🔧 Fortgeschrittene Konfiguration

### GitHub Actions Auto-Deployment

1. GitHub Secrets konfigurieren:
   - `SERVER_HOST`: Ihre Server IP
   - `SERVER_USER`: SSH Benutzer (z.B. ubuntu)
   - `SSH_PRIVATE_KEY`: Ihr SSH Private Key
   - `DOMAIN`: Ihre Domain

2. Bei jedem Push auf `main` deployed GitHub Actions automatisch

### Manuelle Konfiguration

Konfigurationsdateien:
- `/opt/nobis/.env` - Nobis Hauptkonfiguration
- `/opt/nobis/supabase/docker/.env` - Supabase Konfiguration
- `/etc/nginx/sites-available/nobis` - Nginx Konfiguration

## 🐛 Troubleshooting

### Services starten nicht

```bash
# Services prüfen
sudo ./nobis.sh status

# Logs prüfen
sudo ./nobis.sh logs

# Services neu starten
sudo ./nobis.sh restart
```

### SSL-Probleme

```bash
# Zertifikat neu anfordern
sudo certbot certonly --nginx -d ihre-domain.de
sudo ./nobis.sh restart
```

### Datenbank-Verbindung

```bash
# Prüfe ob Postgres läuft
docker ps | grep supabase-db

# Prüfe Logs
docker logs supabase-db
```

### Frontend zeigt nicht die neueste Version

```bash
# Cache leeren und neu bauen
cd /opt/nobis
sudo rm -rf dist node_modules
sudo npm ci
sudo npm run build
sudo systemctl reload nginx
```

## 📁 Verzeichnis-Struktur

```
/opt/nobis/              # Hauptverzeichnis
├── nobis.sh             # Haupt-Script
├── .nobis/              # Interne Funktionen
│   ├── functions/       # Script-Funktionen
│   └── templates/       # Konfigurations-Templates
├── deployment/          # Deployment-Dateien
├── src/                 # React Frontend
└── supabase/            # Supabase Self-Hosted

/var/lib/nobis/          # Daten-Verzeichnis
/var/backups/nobis/      # Backups
/var/www/nobis-app/      # Frontend Build
/var/log/nobis/          # Logs
```

## 🔐 Sicherheit

Das Script richtet automatisch ein:
- ✅ SSL/TLS Verschlüsselung (Let's Encrypt)
- ✅ Firewall (ufw) mit nur notwendigen Ports
- ✅ Rate Limiting in Nginx
- ✅ Security Headers
- ✅ Automatische Zertifikat-Erneuerung
- ✅ Verschlüsselte Passwörter und Secrets

### Empfohlene zusätzliche Sicherheitsmaßnahmen

```bash
# SSH Key-Only Login
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Firewall aktivieren
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Automatische Sicherheits-Updates
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## 📖 Weitere Dokumentation

- [Vollständige README](./README.md) - Detaillierte Installationsanleitung
- [GitHub Actions Workflow](./.github/workflows/auto-deploy.yml) - Auto-Deployment Konfiguration
- [Supabase Dokumentation](https://supabase.com/docs)

## 💬 Support

Bei Problemen:
1. Prüfen Sie die Logs: `sudo ./nobis.sh logs`
2. Prüfen Sie den Status: `sudo ./nobis.sh status`
3. Erstellen Sie ein Issue auf GitHub
4. Kontaktieren Sie den Support

## 🎯 Nächste Schritte nach Installation

1. ✅ Öffnen Sie https://ihre-domain.de
2. ✅ Melden Sie sich an mit Ihren Zugangsdaten
3. ✅ Richten Sie Ihr erstes Projekt ein
4. ✅ Laden Sie Team-Mitglieder ein
5. ✅ Konfigurieren Sie GitHub Actions für Auto-Deployment
6. ✅ Richten Sie regelmäßige Backups ein

Viel Erfolg mit Nobis! 🚀
