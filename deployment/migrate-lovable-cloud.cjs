#!/usr/bin/env node

/**
 * Lovable Cloud → Self-Hosted Migration Script
 * 
 * Migriert Daten von Lovable Cloud zu einer selbst-gehosteten Nobis-Instanz
 * über die Supabase JavaScript SDK.
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Farbige Console-Ausgabe
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`)
};

// Migrations-Statistiken
const stats = {
  organizations: 0,
  profiles: 0,
  user_roles: 0,
  folders: 0,
  folder_members: 0,
  projects: 0,
  project_members: 0,
  project_details: 0,
  project_directories: 0,
  messages: 0,
  notes: 0,
  contacts: 0,
  project_files: 0,
  storage_files: 0,
  errors: []
};

/**
 * Initialisiert Supabase-Clients
 */
async function initClients() {
  log.step('Schritt 1/6: Credentials eingeben\n');
  
  // Source (Lovable Cloud)
  log.info('QUELLE: Lovable Cloud');
  const sourceUrl = await question('  API URL (https://xxx.supabase.co): ');
  const sourceAnonKey = await question('  Anon Key: ');
  const sourceServiceKey = await question('  Service Role Key: ');
  
  console.log('');
  
  // Target (Self-Hosted)
  log.info('ZIEL: Self-Hosted Instanz');
  const targetUrl = await question('  API URL (http://localhost:8000): ');
  const targetServiceKey = await question('  Service Role Key: ');
  
  const sourceClient = createClient(sourceUrl, sourceServiceKey, {
    auth: { persistSession: false }
  });
  
  const targetClient = createClient(targetUrl, targetServiceKey, {
    auth: { persistSession: false }
  });
  
  return { sourceClient, targetClient };
}

/**
 * Testet Verbindungen
 */
async function testConnections(sourceClient, targetClient) {
  log.step('\nSchritt 2/6: Verbindungen testen\n');
  
  try {
    log.info('Teste Verbindung zu Lovable Cloud...');
    const { error: sourceError } = await sourceClient.from('profiles').select('count').limit(1);
    if (sourceError) throw new Error(`Source: ${sourceError.message}`);
    log.success('Lovable Cloud: OK');
    
    log.info('Teste Verbindung zu Self-Hosted...');
    const { error: targetError } = await targetClient.from('profiles').select('count').limit(1);
    if (targetError) throw new Error(`Target: ${targetError.message}`);
    log.success('Self-Hosted: OK');
    
    return true;
  } catch (error) {
    log.error(`Verbindungstest fehlgeschlagen: ${error.message}`);
    return false;
  }
}

/**
 * Migriert eine Tabelle
 */
async function migrateTable(sourceClient, targetClient, tableName, options = {}) {
  try {
    log.info(`Migriere ${tableName}...`);
    
    // Alle Daten von Source laden
    let query = sourceClient.from(tableName).select('*');
    
    // Optional: Filter für nicht-gelöschte Items
    if (options.excludeDeleted) {
      query = query.is('deleted_at', null);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    if (!data || data.length === 0) {
      log.warning(`  Keine Daten in ${tableName}`);
      return 0;
    }
    
    log.info(`  ${data.length} Einträge gefunden`);
    
    // Batch-Insert (jeweils 100 Einträge)
    const batchSize = 100;
    let inserted = 0;
    
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const { error: insertError } = await targetClient.from(tableName).upsert(batch, {
        onConflict: 'id'
      });
      
      if (insertError) {
        log.error(`  Fehler bei Batch ${i}-${i + batch.length}: ${insertError.message}`);
        stats.errors.push({ table: tableName, error: insertError.message });
      } else {
        inserted += batch.length;
      }
    }
    
    log.success(`  ${inserted}/${data.length} Einträge migriert`);
    return inserted;
    
  } catch (error) {
    log.error(`  Fehler bei ${tableName}: ${error.message}`);
    stats.errors.push({ table: tableName, error: error.message });
    return 0;
  }
}

/**
 * Migriert Storage-Bucket
 */
async function migrateBucket(sourceClient, targetClient, bucketName) {
  try {
    log.info(`Migriere Storage-Bucket: ${bucketName}...`);
    
    // Liste alle Dateien im Bucket (rekursiv)
    const allFiles = [];
    
    async function listFilesRecursive(path = '') {
      const { data: files, error: listError } = await sourceClient
        .storage
        .from(bucketName)
        .list(path, { limit: 1000 });
      
      if (listError) throw listError;
      
      for (const file of files || []) {
        if (file.id) {
          // Es ist eine Datei
          allFiles.push(path ? `${path}/${file.name}` : file.name);
        } else {
          // Es ist ein Ordner
          await listFilesRecursive(path ? `${path}/${file.name}` : file.name);
        }
      }
    }
    
    await listFilesRecursive();
    
    if (allFiles.length === 0) {
      log.warning(`  Keine Dateien in ${bucketName}`);
      return 0;
    }
    
    log.info(`  ${allFiles.length} Dateien gefunden`);
    
    let migrated = 0;
    
    for (const filePath of allFiles) {
      try {
        // Download von Source
        const { data: blob, error: downloadError } = await sourceClient
          .storage
          .from(bucketName)
          .download(filePath);
        
        if (downloadError) throw downloadError;
        
        // Upload zu Target
        const { error: uploadError } = await targetClient
          .storage
          .from(bucketName)
          .upload(filePath, blob, {
            upsert: true
          });
        
        if (uploadError) throw uploadError;
        
        migrated++;
        
        if (migrated % 10 === 0) {
          log.info(`  ${migrated}/${allFiles.length} Dateien migriert...`);
        }
        
      } catch (error) {
        log.error(`  Fehler bei Datei ${filePath}: ${error.message}`);
        stats.errors.push({ bucket: bucketName, file: filePath, error: error.message });
      }
    }
    
    log.success(`  ${migrated}/${allFiles.length} Dateien migriert`);
    return migrated;
    
  } catch (error) {
    log.error(`  Fehler bei Bucket ${bucketName}: ${error.message}`);
    stats.errors.push({ bucket: bucketName, error: error.message });
    return 0;
  }
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Lovable Cloud → Self-Hosted Migration');
  console.log('='.repeat(60) + '\n');
  
  try {
    // 1. Credentials & Clients
    const { sourceClient, targetClient } = await initClients();
    
    // 2. Verbindungstest
    const connected = await testConnections(sourceClient, targetClient);
    if (!connected) {
      process.exit(1);
    }
    
    // 3. Bestätigung
    log.step('\nSchritt 3/6: Bestätigung\n');
    log.warning('ACHTUNG: Bestehende Daten im Ziel werden überschrieben!');
    const confirm = await question('\nMigration starten? (ja/nein): ');
    
    if (confirm.toLowerCase() !== 'ja') {
      log.info('Migration abgebrochen');
      process.exit(0);
    }
    
    // 4. Daten-Migration
    log.step('\nSchritt 4/6: Daten migrieren\n');
    
    stats.organizations = await migrateTable(sourceClient, targetClient, 'organizations');
    stats.profiles = await migrateTable(sourceClient, targetClient, 'profiles');
    stats.user_roles = await migrateTable(sourceClient, targetClient, 'user_roles');
    
    stats.folders = await migrateTable(sourceClient, targetClient, 'folders', { 
      excludeDeleted: true
    });
    stats.folder_members = await migrateTable(sourceClient, targetClient, 'folder_members');
    
    stats.projects = await migrateTable(sourceClient, targetClient, 'projects', { 
      excludeDeleted: true
    });
    stats.project_members = await migrateTable(sourceClient, targetClient, 'project_members');
    stats.project_details = await migrateTable(sourceClient, targetClient, 'project_details');
    stats.project_directories = await migrateTable(sourceClient, targetClient, 'project_directories', { 
      excludeDeleted: true
    });
    
    stats.messages = await migrateTable(sourceClient, targetClient, 'messages', { 
      excludeDeleted: true
    });
    stats.notes = await migrateTable(sourceClient, targetClient, 'notes', { 
      excludeDeleted: true
    });
    stats.contacts = await migrateTable(sourceClient, targetClient, 'contacts', { 
      excludeDeleted: true
    });
    stats.project_files = await migrateTable(sourceClient, targetClient, 'project_files', { 
      excludeDeleted: true
    });
    
    // 5. Storage-Migration
    log.step('\nSchritt 5/6: Storage migrieren\n');
    log.warning('Dieser Schritt kann lange dauern bei vielen/großen Dateien!');
    const migrateStorage = await question('Storage-Dateien migrieren? (ja/nein): ');
    
    if (migrateStorage.toLowerCase() === 'ja') {
      stats.storage_files += await migrateBucket(sourceClient, targetClient, 'project-files');
      stats.storage_files += await migrateBucket(sourceClient, targetClient, 'project-images');
    }
    
    // 6. Zusammenfassung
    log.step('\nSchritt 6/6: Zusammenfassung\n');
    
    console.log('Migrierte Daten:');
    console.log('  Organizations:       ', stats.organizations);
    console.log('  Profile:             ', stats.profiles);
    console.log('  User Roles:          ', stats.user_roles);
    console.log('  Folders:             ', stats.folders);
    console.log('  Folder Members:      ', stats.folder_members);
    console.log('  Projects:            ', stats.projects);
    console.log('  Project Members:     ', stats.project_members);
    console.log('  Project Details:     ', stats.project_details);
    console.log('  Project Directories: ', stats.project_directories);
    console.log('  Messages:            ', stats.messages);
    console.log('  Notes:               ', stats.notes);
    console.log('  Contacts:            ', stats.contacts);
    console.log('  Project Files:       ', stats.project_files);
    console.log('  Storage Files:       ', stats.storage_files);
    
    if (stats.errors.length > 0) {
      console.log('\nFehler:');
      stats.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.table || err.bucket}: ${err.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    log.success('Migration abgeschlossen!');
    console.log('='.repeat(60) + '\n');
    
    log.warning('WICHTIG: Auth-Benutzer wurden NICHT migriert!');
    log.info('Nächste Schritte:');
    console.log('  1. Admin-Account manuell erstellen');
    console.log('  2. Benutzer-Accounts erstellen oder Registrierung öffnen');
    console.log('  3. Projekt-/Ordner-Mitglieder zuweisen');
    console.log('  4. Daten verifizieren\n');
    
  } catch (error) {
    log.error(`Unerwarteter Fehler: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Script ausführen
if (require.main === module) {
  main();
}
