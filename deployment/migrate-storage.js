#!/usr/bin/env node

/**
 * Storage Migration Script
 * Migriert alle Dateien von Lovable Cloud zu Self-Hosted Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Farben für Console
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Readline Interface für Benutzereingaben
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('\n📦 Storage Migration von Lovable Cloud zu Self-Hosted Supabase\n');
  console.log('============================================================\n');

  // Konfiguration sammeln
  const oldUrl = await question('Lovable Cloud URL (https://oeytdfnpisbjlalpeohf.supabase.co): ') || 
                 'https://oeytdfnpisbjlalpeohf.supabase.co';
  const oldAnonKey = await question('Lovable Cloud Anon Key: ');
  
  const newUrl = await question('Neue Supabase URL (http://localhost:8000): ') || 
                 'http://localhost:8000';
  const newAnonKey = await question('Neue Supabase Anon Key: ');

  rl.close();

  log('\n📡 Verbinde zu Lovable Cloud...', 'yellow');
  const oldSupabase = createClient(oldUrl, oldAnonKey);

  log('📡 Verbinde zu Self-Hosted Supabase...', 'yellow');
  const newSupabase = createClient(newUrl, newAnonKey);

  // Temp-Verzeichnis für Downloads
  const tempDir = path.join(__dirname, 'temp-storage-migration');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const buckets = ['project-files', 'project-images'];
  
  for (const bucketName of buckets) {
    log(`\n🪣 Migriere Bucket: ${bucketName}`, 'green');
    
    // 1. Alle Dateien im Bucket auflisten
    log('  📋 Liste Dateien auf...', 'yellow');
    const { data: files, error: listError } = await oldSupabase
      .storage
      .from(bucketName)
      .list('', {
        limit: 10000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      log(`  ❌ Fehler beim Auflisten: ${listError.message}`, 'red');
      continue;
    }

    if (!files || files.length === 0) {
      log(`  ℹ️  Keine Dateien in ${bucketName}`, 'yellow');
      continue;
    }

    log(`  ✅ ${files.length} Dateien gefunden`, 'green');

    // 2. Jede Datei herunterladen und hochladen
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file.name;
      const progress = `[${i + 1}/${files.length}]`;

      process.stdout.write(`\r  ${progress} Migriere: ${fileName}...`);

      try {
        // Download von alter Instanz
        const { data: downloadData, error: downloadError } = await oldSupabase
          .storage
          .from(bucketName)
          .download(fileName);

        if (downloadError) {
          throw downloadError;
        }

        // Temporär speichern
        const tempFilePath = path.join(tempDir, fileName);
        const arrayBuffer = await downloadData.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fs.writeFileSync(tempFilePath, buffer);

        // Upload zu neuer Instanz
        const fileContent = fs.readFileSync(tempFilePath);
        const { error: uploadError } = await newSupabase
          .storage
          .from(bucketName)
          .upload(fileName, fileContent, {
            contentType: file.metadata?.mimetype || 'application/octet-stream',
            upsert: true
          });

        if (uploadError) {
          throw uploadError;
        }

        // Temp-Datei löschen
        fs.unlinkSync(tempFilePath);
        successCount++;

      } catch (error) {
        errorCount++;
        log(`\n  ❌ Fehler bei ${fileName}: ${error.message}`, 'red');
      }
    }

    console.log(''); // Neue Zeile nach Progress
    log(`  ✅ ${successCount} erfolgreich migriert`, 'green');
    if (errorCount > 0) {
      log(`  ⚠️  ${errorCount} Fehler`, 'yellow');
    }
  }

  // Aufräumen
  try {
    fs.rmdirSync(tempDir, { recursive: true });
  } catch (e) {
    // Ignoriere Fehler beim Löschen
  }

  log('\n✅ Storage-Migration abgeschlossen!\n', 'green');
  log('Nächste Schritte:', 'yellow');
  log('  1. Verifiziere die migrierten Dateien im neuen Supabase Studio');
  log('  2. Aktualisiere .env mit neuen Supabase-Credentials');
  log('  3. Deploye die Frontend-App mit neuen Umgebungsvariablen\n');
}

// Fehlerbehandlung
main().catch((error) => {
  log(`\n❌ Fataler Fehler: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
