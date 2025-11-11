#!/usr/bin/env node

/**
 * Craftnote API Discovery Tool
 * 
 * Analysiert die Craftnote API-Struktur, um die exakte Datenstruktur
 * für die Migration zu verstehen.
 */

require('dotenv').config({ path: '.env.craftnote' });
const fetch = require('node-fetch');
const fs = require('fs');

const CRAFTNOTE_API_KEY = process.env.CRAFTNOTE_API_KEY;
const CRAFTNOTE_API_URL = process.env.CRAFTNOTE_API_URL;

// Farben für Console-Ausgabe
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.cyan}[STEP]${colors.reset} ${msg}`)
};

/**
 * Craftnote API-Call
 */
async function craftnoteAPI(endpoint, method = 'GET', body = null) {
  const url = `${CRAFTNOTE_API_URL}${endpoint}`;
  
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
}

/**
 * Entdecke verfügbare API-Endpunkte
 */
async function discoverEndpoints() {
  log.step('Teste Craftnote API-Endpunkte...\n');
  
  const endpoints = [
    '/projects',
    '/projects?limit=1',
    '/users',
    '/teams',
    '/folders',
    '/tasks',
    '/messages',
    '/files'
  ];
  
  const available = [];
  
  for (const endpoint of endpoints) {
    try {
      log.info(`Teste: ${endpoint}`);
      const data = await craftnoteAPI(endpoint);
      log.success(`  ✓ Verfügbar - ${JSON.stringify(data).length} bytes`);
      available.push({ endpoint, sampleData: data });
    } catch (error) {
      log.warning(`  ✗ Nicht verfügbar - ${error.message}`);
    }
  }
  
  return available;
}

/**
 * Analysiere Projekt-Struktur
 */
async function analyzeProjectStructure() {
  log.step('\nAnalysiere Projekt-Struktur...\n');
  
  try {
    // Lade die ersten 5 Projekte
    const data = await craftnoteAPI('/projects?offset=0&limit=5');
    
    log.info(`Gefunden: ${data.total || data.length} Projekte total`);
    log.info(`Sample-Größe: ${data.projects?.length || data.length} Projekte`);
    
    if (data.projects && data.projects.length > 0) {
      const sampleProject = data.projects[0];
      
      log.success('\nProjekt-Struktur (Beispiel):');
      console.log(JSON.stringify(sampleProject, null, 2));
      
      log.info('\nVerfügbare Felder:');
      Object.keys(sampleProject).forEach(key => {
        const value = sampleProject[key];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  - ${key}: ${type}`);
      });
      
      return sampleProject;
    }
    
    return null;
  } catch (error) {
    log.warning(`Fehler: ${error.message}`);
    return null;
  }
}

/**
 * Schätze Migrations-Umfang
 */
async function estimateMigrationScope() {
  log.step('\nSchätze Migrations-Umfang...\n');
  
  try {
    const projectsData = await craftnoteAPI('/projects?limit=1');
    const totalProjects = projectsData.total || projectsData.projects?.length || 0;
    
    log.info(`Projekte gesamt: ${totalProjects}`);
    
    // Schätzungen
    const estimatedFiles = totalProjects * 20; // Durchschnitt 20 Dateien/Projekt
    const estimatedMessages = totalProjects * 50; // Durchschnitt 50 Nachrichten/Projekt
    const estimatedStorage = (estimatedFiles * 2).toFixed(2); // Durchschnitt 2MB/Datei
    
    log.info(`Geschätzte Dateien: ~${estimatedFiles}`);
    log.info(`Geschätzte Nachrichten: ~${estimatedMessages}`);
    log.info(`Geschätzter Storage: ~${estimatedStorage} MB`);
    
    // Zeiten schätzen
    const timeProjects = (totalProjects / 100).toFixed(1); // 100 Projekte/Minute
    const timeFiles = (estimatedFiles / 10).toFixed(1); // 10 Dateien/Minute
    
    log.info(`\nGeschätzte Dauer:`);
    log.info(`  Projekte: ~${timeProjects} Minuten`);
    log.info(`  Dateien: ~${timeFiles} Minuten`);
    log.info(`  GESAMT: ~${(parseFloat(timeProjects) + parseFloat(timeFiles)).toFixed(1)} Minuten`);
    
  } catch (error) {
    log.warning(`Fehler: ${error.message}`);
  }
}

/**
 * Speichere Discovery-Ergebnisse
 */
function saveResults(endpoints, projectStructure) {
  const results = {
    timestamp: new Date().toISOString(),
    endpoints: endpoints,
    projectStructure: projectStructure
  };
  
  fs.writeFileSync(
    'craftnote-api-structure.json',
    JSON.stringify(results, null, 2)
  );
  
  log.success('\nErgebnisse gespeichert: craftnote-api-structure.json');
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Craftnote API Discovery Tool');
  console.log('='.repeat(60) + '\n');
  
  if (!CRAFTNOTE_API_KEY) {
    log.warning('FEHLER: CRAFTNOTE_API_KEY nicht gesetzt!');
    log.info('Erstelle deployment/.env.craftnote mit deinem API-Key');
    process.exit(1);
  }
  
  try {
    // 1. Endpunkte testen
    const endpoints = await discoverEndpoints();
    
    // 2. Projekt-Struktur analysieren
    const projectStructure = await analyzeProjectStructure();
    
    // 3. Umfang schätzen
    await estimateMigrationScope();
    
    // 4. Ergebnisse speichern
    saveResults(endpoints, projectStructure);
    
    console.log('\n' + '='.repeat(60));
    log.success('Discovery abgeschlossen!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    log.warning(`Unerwarteter Fehler: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Ausführen
if (require.main === module) {
  main();
}
