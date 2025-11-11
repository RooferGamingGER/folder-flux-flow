#!/usr/bin/env node

/**
 * Craftnote → Nobis API-Migration
 * 
 * Migriert alle Daten von Craftnote über deren API zu Nobis (Supabase).
 * 
 * Features:
 * - Automatische Benutzer-Zuordnung
 * - Projekt- & Ordner-Migration
 * - Dateien-Download & Upload
 * - Nachrichten & Notizen
 * - Batch-Processing für Performance
 * - Fehlerbehandlung & Retry-Logik
 */

require('dotenv').config({ path: '.env.craftnote' });
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const readline = require('readline');
const crypto = require('crypto');

// Konfiguration
const CRAFTNOTE_API_KEY = process.env.CRAFTNOTE_API_KEY;
const CRAFTNOTE_API_URL = process.env.CRAFTNOTE_API_URL;
const NOBIS_SUPABASE_URL = process.env.NOBIS_SUPABASE_URL;
const NOBIS_SUPABASE_SERVICE_KEY = process.env.NOBIS_SUPABASE_SERVICE_KEY;

const BATCH_SIZE = 100; // Projekte pro Batch
const MAX_RETRIES = 3; // Max. Wiederholungsversuche
const RETRY_DELAY = 2000; // Verzögerung zwischen Retries (ms)

// Statistiken
const stats = {
  users: 0,
  folders: 0,
  projects: 0,
  project_details: 0,
  project_directories: 0,
  messages: 0,
  notes: 0,
  contacts: 0,
  project_files: 0,
  storage_files: 0,
  project_members: 0,
  folder_members: 0,
  errors: []
};

// Mappings (Craftnote ID → Nobis ID)
const userMapping = new Map();
const projectMapping = new Map();
const folderMapping = new Map();

// Console-Farben
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

// Readline Interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Craftnote API-Call mit Retry-Logik
 */
async function craftnoteAPI(endpoint, method = 'GET', body = null, retries = 0) {
  const url = `${CRAFTNOTE_API_URL}${endpoint}`;
  
  try {
    const options = {
      method,
      headers: {
        'X-CN-API-KEY': CRAFTNOTE_API_KEY,
        'Content-Type': 'application/json'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
    
  } catch (error) {
    if (retries < MAX_RETRIES) {
      log.warning(`  Retry ${retries + 1}/${MAX_RETRIES} für ${endpoint}...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return craftnoteAPI(endpoint, method, body, retries + 1);
    }
    throw error;
  }
}

/**
 * Craftnote Benutzer migrieren
 */
async function migrateUsers(supabase, adminUserId) {
  log.step('Migriere Benutzer...');
  
  try {
    const data = await craftnoteAPI('/users');
    const users = data.users || data || [];
    
    log.info(`${users.length} Benutzer gefunden`);
    
    for (const cnUser of users) {
      try {
        const userId = crypto.randomUUID();
        
        // Profile erstellen
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            first_name: cnUser.firstName || cnUser.firstname || '',
            last_name: cnUser.lastName || cnUser.lastname || '',
            email: cnUser.email || `user-${userId}@craftnote-import.local`,
            must_change_password: true
          });
        
        if (profileError) {
          // User existiert möglicherweise schon
          if (profileError.code === '23505') {
            const { data: existing } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', cnUser.email)
              .single();
            
            if (existing) {
              userMapping.set(cnUser.id || cnUser._id, existing.id);
              continue;
            }
          }
          throw profileError;
        }
        
        // User-Role zuweisen
        const role = mapCraftnoteRole(cnUser.role || cnUser.userRole);
        
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: role,
            created_by: adminUserId
          });
        
        if (roleError && roleError.code !== '23505') {
          throw roleError;
        }
        
        // Mapping speichern
        userMapping.set(cnUser.id || cnUser._id, userId);
        stats.users++;
        
      } catch (error) {
        log.error(`Fehler bei User ${cnUser.email}: ${error.message}`);
        stats.errors.push({ type: 'user', data: cnUser, error: error.message });
      }
    }
    
    log.success(`${stats.users} Benutzer migriert`);
    
  } catch (error) {
    log.error(`Fehler beim User-Abruf: ${error.message}`);
  }
}

/**
 * Craftnote-Rolle auf Nobis mappen
 */
function mapCraftnoteRole(cnRole) {
  const mapping = {
    'admin': 'geschaeftsfuehrer',
    'owner': 'geschaeftsfuehrer',
    'manager': 'team_projektleiter',
    'projektleiter': 'team_projektleiter',
    'project_manager': 'team_projektleiter',
    'foreman': 'vorarbeiter',
    'vorarbeiter': 'vorarbeiter',
    'worker': 'mitarbeiter',
    'mitarbeiter': 'mitarbeiter',
    'office': 'buerokraft',
    'buerokraft': 'buerokraft'
  };
  
  return mapping[cnRole?.toLowerCase()] || 'mitarbeiter';
}

/**
 * Craftnote Ordner migrieren
 */
async function migrateFolders(supabase, adminUserId) {
  log.step('Migriere Ordner...');
  
  try {
    const data = await craftnoteAPI('/folders');
    const folders = data.folders || data || [];
    
    if (folders.length === 0) {
      log.warning('Keine Ordner gefunden');
      return;
    }
    
    log.info(`${folders.length} Ordner gefunden`);
    
    for (const cnFolder of folders) {
      try {
        const folderId = crypto.randomUUID();
        
        const { error } = await supabase
          .from('folders')
          .insert({
            id: folderId,
            name: cnFolder.name || cnFolder.title,
            user_id: userMapping.get(cnFolder.createdBy || cnFolder.owner) || adminUserId,
            archived: cnFolder.archived || false,
            created_at: cnFolder.createdAt || cnFolder.created_at || new Date().toISOString()
          });
        
        if (error) throw error;
        
        folderMapping.set(cnFolder.id || cnFolder._id, folderId);
        stats.folders++;
        
        // Folder-Members
        if (cnFolder.members && Array.isArray(cnFolder.members)) {
          for (const memberId of cnFolder.members) {
            const nobisUserId = userMapping.get(memberId);
            if (nobisUserId) {
              await supabase.from('folder_members').insert({
                folder_id: folderId,
                user_id: nobisUserId,
                added_by: adminUserId
              });
              stats.folder_members++;
            }
          }
        }
        
      } catch (error) {
        log.error(`Fehler bei Folder ${cnFolder.name}: ${error.message}`);
        stats.errors.push({ type: 'folder', data: cnFolder, error: error.message });
      }
    }
    
    log.success(`${stats.folders} Ordner migriert`);
    
  } catch (error) {
    log.warning(`Keine Ordner-API verfügbar: ${error.message}`);
  }
}

/**
 * Craftnote Projekte migrieren (Batch-Processing)
 */
async function migrateProjects(supabase, adminUserId) {
  log.step('Migriere Projekte...');
  
  try {
    // Schritt 1: Anzahl ermitteln
    const firstPage = await craftnoteAPI('/projects?offset=0&limit=1');
    const totalProjects = firstPage.total || firstPage.projects?.length || 0;
    
    log.info(`${totalProjects} Projekte gefunden`);
    
    if (totalProjects === 0) {
      log.warning('Keine Projekte zum Migrieren');
      return;
    }
    
    // Schritt 2: Batch-Processing
    for (let offset = 0; offset < totalProjects; offset += BATCH_SIZE) {
      try {
        const data = await craftnoteAPI(`/projects?offset=${offset}&limit=${BATCH_SIZE}`);
        const projects = data.projects || data || [];
        
        log.info(`Verarbeite Batch ${offset}-${offset + projects.length}/${totalProjects}...`);
        
        for (const cnProject of projects) {
          try {
            await migrateSingleProject(supabase, cnProject, adminUserId);
          } catch (error) {
            log.error(`Fehler bei Projekt ${cnProject.name || cnProject.title}: ${error.message}`);
            stats.errors.push({ type: 'project', data: cnProject, error: error.message });
          }
        }
        
      } catch (error) {
        log.error(`Fehler bei Batch ${offset}: ${error.message}`);
        stats.errors.push({ type: 'batch', offset, error: error.message });
      }
    }
    
    log.success(`${stats.projects} Projekte migriert`);
    
  } catch (error) {
    log.error(`Fehler beim Projekt-Abruf: ${error.message}`);
  }
}

/**
 * Einzelnes Projekt migrieren
 */
async function migrateSingleProject(supabase, cnProject, adminUserId) {
  const projectId = crypto.randomUUID();
  
  // 1. Projekt erstellen
  const { error: projectError } = await supabase
    .from('projects')
    .insert({
      id: projectId,
      title: cnProject.name || cnProject.title,
      folder_id: folderMapping.get(cnProject.folderId || cnProject.folder) || null,
      user_id: userMapping.get(cnProject.createdBy || cnProject.owner) || adminUserId,
      archived: cnProject.archived || cnProject.status === 'archived',
      created_at: cnProject.createdAt || cnProject.created_at || new Date().toISOString()
    });
  
  if (projectError) throw projectError;
  
  projectMapping.set(cnProject.id || cnProject._id, projectId);
  stats.projects++;
  
  // 2. Projekt-Details
  const { error: detailsError } = await supabase
    .from('project_details')
    .insert({
      project_id: projectId,
      projektname: cnProject.name || cnProject.title,
      auftragsnummer: cnProject.projectNumber || cnProject.number || null,
      projektstatus: cnProject.status || 'In Bearbeitung',
      startdatum: cnProject.startDate || cnProject.start_date || null,
      enddatum: cnProject.endDate || cnProject.end_date || null,
      strasse: cnProject.address?.street || cnProject.street || null,
      plz: cnProject.address?.zip || cnProject.zip || null,
      stadt: cnProject.address?.city || cnProject.city || null,
      land: cnProject.address?.country || cnProject.country || 'Deutschland',
      ansprechpartner: cnProject.contactPerson || cnProject.contact || null,
      notiz: cnProject.description || cnProject.notes || null
    });
  
  if (detailsError) throw detailsError;
  stats.project_details++;
  
  // 3. Standard-Verzeichnisse
  const directories = cnProject.directories || ['Bilder', 'Dokumente', 'Pläne'];
  for (let idx = 0; idx < directories.length; idx++) {
    const dirName = typeof directories[idx] === 'string' 
      ? directories[idx] 
      : directories[idx].name;
    
    await supabase.from('project_directories').insert({
      project_id: projectId,
      name: dirName,
      order_index: idx,
      created_by: userMapping.get(cnProject.createdBy) || adminUserId
    });
    stats.project_directories++;
  }
  
  // 4. Projekt-Members
  if (cnProject.members && Array.isArray(cnProject.members)) {
    for (const memberId of cnProject.members) {
      const nobisUserId = userMapping.get(memberId);
      if (nobisUserId) {
        await supabase.from('project_members').insert({
          project_id: projectId,
          user_id: nobisUserId,
          added_by: adminUserId
        });
        stats.project_members++;
      }
    }
  }
  
  // 5. Dateien (falls im Projekt enthalten)
  if (cnProject.files && Array.isArray(cnProject.files)) {
    await migrateProjectFiles(supabase, projectId, cnProject.files, adminUserId);
  }
  
  // 6. Nachrichten
  if (cnProject.messages && Array.isArray(cnProject.messages)) {
    await migrateProjectMessages(supabase, projectId, cnProject.messages, adminUserId);
  }
  
  // 7. Notizen
  if (cnProject.notes && Array.isArray(cnProject.notes)) {
    await migrateProjectNotes(supabase, projectId, cnProject.notes);
  }
  
  // 8. Kontakte
  if (cnProject.contacts && Array.isArray(cnProject.contacts)) {
    await migrateProjectContacts(supabase, projectId, cnProject.contacts);
  }
}

/**
 * Projekt-Dateien migrieren
 */
async function migrateProjectFiles(supabase, projectId, files, userId) {
  for (const cnFile of files) {
    try {
      // Falls URL vorhanden: Datei herunterladen
      let fileBuffer = null;
      if (cnFile.url || cnFile.downloadUrl) {
        const fileUrl = cnFile.url || cnFile.downloadUrl;
        const response = await fetch(fileUrl, {
          headers: {
            'X-CN-API-KEY': CRAFTNOTE_API_KEY
          }
        });
        
        if (response.ok) {
          fileBuffer = await response.buffer();
        }
      }
      
      const fileName = cnFile.name || cnFile.filename;
      const fileExt = cnFile.extension || getFileExtension(fileName);
      const mimeType = cnFile.mimeType || getMimeType(fileExt);
      const isImage = mimeType.startsWith('image/');
      
      // Storage-Upload (falls Datei heruntergeladen wurde)
      let storagePath = null;
      if (fileBuffer) {
        const bucketName = isImage ? 'project-images' : 'project-files';
        storagePath = `${projectId}/${crypto.randomUUID()}${fileExt}`;
        
        const { error: uploadError } = await supabase
          .storage
          .from(bucketName)
          .upload(storagePath, fileBuffer, {
            contentType: mimeType,
            upsert: false
          });
        
        if (uploadError) throw uploadError;
        stats.storage_files++;
      }
      
      // Metadaten in project_files
      const { error: dbError } = await supabase
        .from('project_files')
        .insert({
          project_id: projectId,
          name: fileName,
          folder: cnFile.folder || cnFile.directory || null,
          size: formatFileSize(cnFile.size || fileBuffer?.length || 0),
          ext: fileExt,
          mime: mimeType,
          is_image: isImage,
          storage_path: storagePath,
          latitude: cnFile.latitude || cnFile.lat || null,
          longitude: cnFile.longitude || cnFile.lng || null,
          created_by: userId,
          modified: cnFile.createdAt || cnFile.modified || new Date().toISOString()
        });
      
      if (dbError) throw dbError;
      stats.project_files++;
      
    } catch (error) {
      log.error(`Fehler bei Datei ${cnFile.name}: ${error.message}`);
      stats.errors.push({ type: 'file', data: cnFile, error: error.message });
    }
  }
}

/**
 * Projekt-Nachrichten migrieren
 */
async function migrateProjectMessages(supabase, projectId, messages, userId) {
  for (const cnMsg of messages) {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          project_id: projectId,
          user_id: userMapping.get(cnMsg.userId || cnMsg.author) || userId,
          sender: cnMsg.sender || cnMsg.authorName || 'Craftnote Import',
          type: cnMsg.type || 'text',
          content: typeof cnMsg.content === 'string' 
            ? { text: cnMsg.content } 
            : cnMsg.content,
          timestamp: cnMsg.timestamp || cnMsg.createdAt || new Date().toISOString()
        });
      
      if (error) throw error;
      stats.messages++;
      
    } catch (error) {
      log.error(`Fehler bei Nachricht: ${error.message}`);
    }
  }
}

/**
 * Projekt-Notizen migrieren
 */
async function migrateProjectNotes(supabase, projectId, notes) {
  for (const cnNote of notes) {
    try {
      const { error } = await supabase
        .from('notes')
        .insert({
          project_id: projectId,
          text: cnNote.text || cnNote.content,
          created_at: cnNote.createdAt || cnNote.created_at || new Date().toISOString()
        });
      
      if (error) throw error;
      stats.notes++;
      
    } catch (error) {
      log.error(`Fehler bei Notiz: ${error.message}`);
    }
  }
}

/**
 * Projekt-Kontakte migrieren
 */
async function migrateProjectContacts(supabase, projectId, contacts) {
  for (const cnContact of contacts) {
    try {
      const { error } = await supabase
        .from('contacts')
        .insert({
          project_id: projectId,
          name: cnContact.name,
          email: cnContact.email || null,
          phone: cnContact.phone || cnContact.telephone || null,
          created_at: cnContact.createdAt || new Date().toISOString()
        });
      
      if (error) throw error;
      stats.contacts++;
      
    } catch (error) {
      log.error(`Fehler bei Kontakt: ${error.message}`);
    }
  }
}

/**
 * Helper-Funktionen
 */
function getFileExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

function getMimeType(ext) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.dwg': 'application/acad',
    '.dxf': 'application/dxf'
  };
  
  return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  Craftnote → Nobis API-Migration');
  console.log('  Automatische Migration über Craftnote API');
  console.log('='.repeat(70) + '\n');
  
  try {
    // 1. Validierung
    if (!CRAFTNOTE_API_KEY || !NOBIS_SUPABASE_URL || !NOBIS_SUPABASE_SERVICE_KEY) {
      log.error('Fehlende Umgebungsvariablen!');
      log.info('Erstelle deployment/.env.craftnote mit:');
      console.log('  CRAFTNOTE_API_KEY=dein_api_key');
      console.log('  CRAFTNOTE_API_URL=https://...');
      console.log('  NOBIS_SUPABASE_URL=https://...');
      console.log('  NOBIS_SUPABASE_SERVICE_KEY=dein_key');
      process.exit(1);
    }
    
    // 2. Supabase-Client initialisieren
    log.step('Schritt 1/8: Nobis-Verbindung\n');
    
    const supabase = createClient(NOBIS_SUPABASE_URL, NOBIS_SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
    
    // Verbindungstest
    const { error: testError } = await supabase.from('profiles').select('count').limit(1);
    if (testError) {
      log.error(`Verbindung fehlgeschlagen: ${testError.message}`);
      process.exit(1);
    }
    
    log.success('Nobis-Verbindung OK\n');
    
    // 3. Admin-User
    log.step('Schritt 2/8: Admin-User\n');
    
    const adminEmail = await question('Admin E-Mail (für Import-Einträge): ');
    
    const { data: adminProfile, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', adminEmail)
      .single();
    
    if (adminError || !adminProfile) {
      log.error('Admin-User nicht gefunden');
      process.exit(1);
    }
    
    const adminUserId = adminProfile.id;
    log.success(`Admin-User: ${adminUserId}\n`);
    
    // 4. Craftnote API testen
    log.step('Schritt 3/8: Craftnote API testen\n');
    
    try {
      const testData = await craftnoteAPI('/projects?limit=1');
      const total = testData.total || testData.projects?.length || 0;
      log.success(`Craftnote API OK - ${total} Projekte verfügbar\n`);
    } catch (error) {
      log.error(`Craftnote API-Fehler: ${error.message}`);
      process.exit(1);
    }
    
    // 5. Bestätigung
    log.step('Schritt 4/8: Bestätigung\n');
    log.warning('ACHTUNG: Diese Migration importiert ALLE Craftnote-Daten!');
    log.warning('Stelle sicher, dass genügend Speicherplatz vorhanden ist.');
    
    const confirm = await question('\nMigration starten? (ja/nein): ');
    
    if (confirm.toLowerCase() !== 'ja') {
      log.info('Migration abgebrochen');
      process.exit(0);
    }
    
    // 6. Benutzer migrieren
    log.step('\nSchritt 5/8: Benutzer migrieren\n');
    await migrateUsers(supabase, adminUserId);
    
    // 7. Ordner migrieren
    log.step('\nSchritt 6/8: Ordner migrieren\n');
    await migrateFolders(supabase, adminUserId);
    
    // 8. Projekte migrieren
    log.step('\nSchritt 7/8: Projekte migrieren\n');
    log.info('Dies kann je nach Anzahl der Projekte mehrere Minuten dauern...');
    await migrateProjects(supabase, adminUserId);
    
    // 9. Zusammenfassung
    log.step('\nSchritt 8/8: Zusammenfassung\n');
    
    console.log('Migrierte Daten:');
    console.log(`  Benutzer:            ${stats.users}`);
    console.log(`  Ordner:              ${stats.folders}`);
    console.log(`  Ordner-Mitglieder:   ${stats.folder_members}`);
    console.log(`  Projekte:            ${stats.projects}`);
    console.log(`  Projekt-Details:     ${stats.project_details}`);
    console.log(`  Projekt-Verzeichn.:  ${stats.project_directories}`);
    console.log(`  Projekt-Mitglieder:  ${stats.project_members}`);
    console.log(`  Nachrichten:         ${stats.messages}`);
    console.log(`  Notizen:             ${stats.notes}`);
    console.log(`  Kontakte:            ${stats.contacts}`);
    console.log(`  Datei-Einträge:      ${stats.project_files}`);
    console.log(`  Storage-Dateien:     ${stats.storage_files}`);
    
    if (stats.errors.length > 0) {
      console.log(`\nFehler: ${stats.errors.length}`);
      log.warning('Fehler-Log: migration-errors-craftnote.json');
      const fs = require('fs');
      fs.writeFileSync(
        'migration-errors-craftnote.json',
        JSON.stringify(stats.errors, null, 2)
      );
    }
    
    console.log('\n' + '='.repeat(70));
    log.success('Migration abgeschlossen!');
    console.log('='.repeat(70) + '\n');
    
    log.info('Nächste Schritte:');
    console.log('  1. Daten in Nobis verifizieren');
    console.log('  2. Fehlende Dateien manuell hochladen (falls nicht über API)');
    console.log('  3. Benutzer-Passwörter zurücksetzen');
    console.log('  4. Berechtigungen überprüfen');
    console.log('  5. Craftnote parallel laufen lassen bis alles OK\n');
    
  } catch (error) {
    log.error(`Kritischer Fehler: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Ausführen
if (require.main === module) {
  main();
}

module.exports = { main };
