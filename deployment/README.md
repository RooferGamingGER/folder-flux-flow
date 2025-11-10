# Self-Hosting Installation Guide

Komplette Installations-Anleitung für Nobis Construction Management auf einem Ubuntu Server mit Supabase Self-Hosted.

## 📋 Voraussetzungen

### Server-Spezifikationen
- **OS**: Ubuntu 20.04 LTS oder 22.04 LTS
- **CPU**: Minimum 2 Cores (empfohlen: 4 Cores)
- **RAM**: Minimum 4 GB (empfohlen: 8 GB)
- **Disk**: Minimum 50 GB SSD (empfohlen: 100 GB)
- **Netzwerk**: Statische IP-Adresse

### Software
- Docker & Docker Compose
- Nginx
- PostgreSQL Client Tools (psql, pg_dump)
- Node.js 18.x oder höher
- Git

### Domains
- Hauptdomain: `ihre-domain.de`
- API-Subdomain: `api.ihre-domain.de`
- Studio-Subdomain (optional): `studio.ihre-domain.de`

## 🚀 Installation

### Schritt 1: Server vorbereiten

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Docker installieren
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Docker Compose installieren
sudo apt install docker-compose-plugin -y

# Nginx installieren
sudo apt install nginx -y

# PostgreSQL Client Tools installieren
sudo apt install postgresql-client -y

# Node.js installieren (über nvm empfohlen)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Git installieren
sudo apt install git -y

# Certbot für SSL installieren
sudo apt install certbot python3-certbot-nginx -y
```

### Schritt 2: Supabase Self-Hosted installieren

```bash
# Installations-Skript ausführbar machen
chmod +x deployment/install-supabase.sh

# Supabase installieren
sudo ./deployment/install-supabase.sh
```

**Das Skript fragt nach:**
- Ihrer Domain (z.B. `api.ihre-domain.de`)

**Das Skript erstellt:**
- Supabase Docker Container
- `.env` Datei mit Secrets
- Credentials-Datei: `/opt/supabase/supabase-credentials.txt`

**Wichtig:** Speichern Sie die Credentials sicher!

### Schritt 3: Datenbank migrieren

#### 3.1 Schema erstellen

```bash
# PostgreSQL-Verbindung testen
psql -h localhost -U postgres -d postgres

# Schema importieren
psql -h localhost -U postgres -d postgres -f deployment/migrate-database.sql
```

#### 3.2 Daten migrieren (falls vorhanden)

```bash
# Migrations-Skript ausführbar machen
chmod +x deployment/migrate-data.sh

# Daten von Lovable Cloud migrieren
./deployment/migrate-data.sh
```

**Das Skript fragt nach:**
- Lovable Cloud Host
- Lovable Cloud DB Password
- Neuer Supabase Host
- Neues Supabase DB Password

#### 3.3 Storage migrieren

```bash
# Node.js Dependencies installieren
cd deployment
npm init -y
npm install @supabase/supabase-js

# Storage-Migration starten
node migrate-storage.js
```

**Das Skript fragt nach:**
- Lovable Cloud URL
- Lovable Cloud Anon Key
- Neue Supabase URL
- Neue Supabase Anon Key

### Schritt 4: Nginx konfigurieren

```bash
# Nginx-Konfiguration kopieren
sudo cp deployment/nginx.conf /etc/nginx/sites-available/nobis-app

# Domain in Konfiguration anpassen
sudo nano /etc/nginx/sites-available/nobis-app
# Ersetze "ihre-domain.de" mit deiner echten Domain

# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/nobis-app /etc/nginx/sites-enabled/

# Default-Site deaktivieren (optional)
sudo rm /etc/nginx/sites-enabled/default

# Konfiguration testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

### Schritt 5: SSL-Zertifikate einrichten

```bash
# Certbot für alle Domains ausführen
sudo certbot --nginx -d ihre-domain.de -d api.ihre-domain.de -d studio.ihre-domain.de

# Automatische Erneuerung testen
sudo certbot renew --dry-run
```

### Schritt 6: Frontend deployen

#### 6.1 Repository klonen

```bash
# App-Verzeichnis erstellen
sudo mkdir -p /var/www/nobis-app
sudo chown -R $USER:$USER /var/www/nobis-app

# Repository klonen
cd /var/www/nobis-app
git clone https://github.com/IHR-REPO/nobis-app.git .
```

#### 6.2 .env erstellen

```bash
# .env Datei erstellen
cat > .env << EOF
VITE_SUPABASE_URL=https://api.ihre-domain.de
VITE_SUPABASE_PUBLISHABLE_KEY=IHRE_NEUE_ANON_KEY
VITE_SUPABASE_PROJECT_ID=IHRE_NEUE_PROJECT_ID
VITE_MAPBOX_PUBLIC_TOKEN=pk.eyJ1Ijoicm9vZmVyZ2FtaW5nIiwiYSI6ImNtOHduem92dTE0dHAya3NldWRuMHVlN2UifQ.p1DH0hDh_k_1fp9HIXoVKQ
EOF
```

**Credentials finden:**
- Anon Key: In `/opt/supabase/supabase-credentials.txt`
- Project ID: Aus Supabase Studio (http://localhost:3000)

#### 6.3 Build erstellen

```bash
# Dependencies installieren
npm install

# Production Build
npm run build

# Permissions setzen
sudo chown -R www-data:www-data /var/www/nobis-app/dist
sudo chmod -R 755 /var/www/nobis-app/dist
```

### Schritt 7: GitHub Actions einrichten

#### 7.1 GitHub Secrets konfigurieren

Gehe zu: `GitHub Repository → Settings → Secrets and variables → Actions`

Füge folgende Secrets hinzu:

```
SSH_PRIVATE_KEY          # Dein privater SSH-Schlüssel
REMOTE_HOST              # Server-IP oder Domain
REMOTE_USER              # SSH-Benutzername (z.B. ubuntu)
REMOTE_PORT              # SSH-Port (Standard: 22)
VITE_SUPABASE_URL        # https://api.ihre-domain.de
VITE_SUPABASE_PUBLISHABLE_KEY  # Anon Key
VITE_SUPABASE_PROJECT_ID       # Project ID
VITE_MAPBOX_PUBLIC_TOKEN       # Mapbox Token
```

#### 7.2 SSH-Schlüssel erstellen

```bash
# Auf deinem lokalen Rechner
ssh-keygen -t ed25519 -C "github-actions"

# Public Key auf Server kopieren
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server-ip

# Private Key in GitHub Secrets einfügen
cat ~/.ssh/id_ed25519  # Kompletten Output kopieren
```

#### 7.3 Workflow testen

```bash
# Code committen und pushen
git add .
git commit -m "Setup deployment"
git push origin main

# GitHub Actions Tab öffnen und Workflow beobachten
```

## 🔒 Sicherheit

### Firewall einrichten

```bash
# UFW installieren (falls nicht vorhanden)
sudo apt install ufw -y

# Standard-Regeln
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Benötigte Ports öffnen
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS

# Firewall aktivieren
sudo ufw enable

# Status prüfen
sudo ufw status verbose
```

### SSH absichern

```bash
# SSH-Konfiguration bearbeiten
sudo nano /etc/ssh/sshd_config

# Folgende Einstellungen anpassen:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22  # Optional: Ändere Port

# SSH neu starten
sudo systemctl restart sshd
```

### Automatische Updates

```bash
# Unattended Upgrades installieren
sudo apt install unattended-upgrades -y

# Konfigurieren
sudo dpkg-reconfigure -plow unattended-upgrades
```

### PostgreSQL absichern

```bash
# PostgreSQL sollte NUR lokal erreichbar sein
sudo nano /opt/supabase/supabase/docker/volumes/db/postgresql.conf

# Stelle sicher:
listen_addresses = 'localhost'

# pg_hba.conf prüfen
sudo nano /opt/supabase/supabase/docker/volumes/db/pg_hba.conf
```

## 📊 Monitoring & Logs

### Logs anzeigen

```bash
# Supabase Docker Logs
cd /opt/supabase/supabase/docker
sudo docker-compose logs -f

# Nginx Logs
sudo tail -f /var/log/nginx/nobis-app-access.log
sudo tail -f /var/log/nginx/nobis-app-error.log
sudo tail -f /var/log/nginx/supabase-api-access.log

# Systemlogs
sudo journalctl -u nginx -f
```

### Performance Monitoring

```bash
# htop installieren
sudo apt install htop -y

# Docker Stats
sudo docker stats

# Disk Usage
df -h
du -sh /opt/supabase/
```

## 🔄 Backup & Recovery

### Automatisches Backup einrichten

```bash
# Backup-Skript erstellen
sudo nano /usr/local/bin/backup-supabase.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/supabase"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Datenbank Backup
PGPASSWORD=your_password pg_dump \
    -h localhost \
    -U postgres \
    -d postgres \
    -F c \
    -f $BACKUP_DIR/db_backup_$DATE.dump

# Storage Backup
tar -czf $BACKUP_DIR/storage_backup_$DATE.tar.gz \
    /opt/supabase/supabase/docker/volumes/storage/

# Alte Backups löschen (älter als 7 Tage)
find $BACKUP_DIR -name "*.dump" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Ausführbar machen
sudo chmod +x /usr/local/bin/backup-supabase.sh

# Cronjob einrichten (täglich um 2 Uhr nachts)
sudo crontab -e
# Füge hinzu:
0 2 * * * /usr/local/bin/backup-supabase.sh
```

### Restore

```bash
# Datenbank restore
PGPASSWORD=your_password pg_restore \
    -h localhost \
    -U postgres \
    -d postgres \
    -c \
    /backup/supabase/db_backup_YYYYMMDD_HHMMSS.dump

# Storage restore
tar -xzf /backup/supabase/storage_backup_YYYYMMDD_HHMMSS.tar.gz -C /
```

## 🛠️ Wartung

### Supabase Updates

```bash
cd /opt/supabase/supabase
sudo git pull
cd docker
sudo docker-compose pull
sudo docker-compose up -d
```

### Nginx Updates

```bash
sudo apt update
sudo apt upgrade nginx -y
sudo systemctl restart nginx
```

### Frontend Updates

Automatisch via GitHub Actions bei jedem Push zu `main`.

Manuell:

```bash
cd /var/www/nobis-app
git pull
npm install
npm run build
sudo systemctl reload nginx
```

## 🐛 Troubleshooting

### Supabase startet nicht

```bash
# Logs prüfen
cd /opt/supabase/supabase/docker
sudo docker-compose logs

# Container neu starten
sudo docker-compose restart

# Komplett neu starten
sudo docker-compose down
sudo docker-compose up -d
```

### Nginx Fehler

```bash
# Konfiguration testen
sudo nginx -t

# Syntax-Fehler beheben
sudo nano /etc/nginx/sites-available/nobis-app

# Neu laden
sudo systemctl reload nginx
```

### SSL-Probleme

```bash
# Zertifikate erneuern
sudo certbot renew --force-renewal

# Nginx neu starten
sudo systemctl restart nginx
```

### Datenbank-Verbindungsfehler

```bash
# PostgreSQL Status
sudo docker-compose ps

# PostgreSQL Logs
sudo docker-compose logs db

# Verbindung testen
psql -h localhost -U postgres -d postgres
```

## 📞 Support

Bei Problemen:
1. Logs überprüfen (siehe oben)
2. GitHub Issues erstellen
3. Community-Forum konsultieren

## 📝 Checkliste

- [ ] Server eingerichtet (Ubuntu, Docker, Nginx)
- [ ] Domains konfiguriert (DNS)
- [ ] Supabase Self-Hosted installiert
- [ ] Datenbank-Schema migriert
- [ ] Daten migriert (falls vorhanden)
- [ ] Storage migriert (falls vorhanden)
- [ ] Nginx konfiguriert
- [ ] SSL-Zertifikate eingerichtet
- [ ] Frontend deployt
- [ ] GitHub Actions konfiguriert
- [ ] Firewall aktiviert
- [ ] SSH abgesichert
- [ ] Backup-System eingerichtet
- [ ] Monitoring eingerichtet
- [ ] Alle Features getestet

## 🎉 Fertig!

Deine Self-Hosted Nobis App läuft jetzt auf deinem eigenen Server!

**URLs:**
- Frontend: https://ihre-domain.de
- API: https://api.ihre-domain.de
- Studio: https://studio.ihre-domain.de (oder http://server-ip:3000)

**Nächste Schritte:**
1. Ersten Admin-User anlegen
2. Alle Features testen
3. Backup-Strategie verfeinern
4. Monitoring erweitern (optional: Grafana, Prometheus)
