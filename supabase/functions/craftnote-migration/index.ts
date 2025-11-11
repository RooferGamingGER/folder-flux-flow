import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: EdgeRuntime is available in Supabase Edge Functions
declare const EdgeRuntime: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Auth-Check: User muss authentifiziert sein
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Nicht authentifiziert' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // User-Rolle prüfen
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Ungültige Authentifizierung' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'geschaeftsfuehrer') {
      return new Response(
        JSON.stringify({ error: 'Keine Berechtigung - nur für Geschäftsführer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'test-connection':
        return await testConnection(params.apiKey);
      
      case 'analyze':
        return await analyzeScope(params.apiKey, supabaseClient);
      
      case 'start-migration':
        return await startMigration(supabaseClient, params);
      
      case 'get-status':
        return await getStatus(supabaseClient, params.runId);
      
      case 'cancel':
        return await cancelMigration(supabaseClient, params.runId);
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function testConnection(apiKey: string) {
  try {
    const response = await fetch(
      'https://europe-west1-craftnote-live.cloudfunctions.net/api/v1/projects?limit=1',
      {
        headers: {
          'X-CN-API-KEY': apiKey.trim(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API-Verbindung fehlgeschlagen: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
  
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verbindung erfolgreich',
        projectCount: data.total || data.projects?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Craftnote API Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function analyzeScope(apiKey: string, supabaseClient: any) {
  try {
    // Hole ALLE Projekte mit Pagination
    const allProjects = await fetchAllCraftnoteProjects(apiKey);
    
    // Prüfe, welche Projekte bereits existieren
    const { data: existingDetails } = await supabaseClient
      .from('project_details')
      .select('auftragsnummer');

    const existingAuftragsnummern = new Set(
      (existingDetails || [])
        .map((d: any) => d.auftragsnummer)
        .filter(Boolean)
    );

    // Filtere bereits migrierte Projekte heraus
    const newProjects = allProjects.filter((p: any) => {
      const auftragsnummer = p.auftragsnummer || p.projectNumber || p.id;
      return auftragsnummer && !existingAuftragsnummern.has(auftragsnummer);
    });

    const totalProjects = allProjects.length;
    const newProjectsCount = newProjects.length;
    const skippedCount = totalProjects - newProjectsCount;

    console.log('Analyze Scope:', { 
      totalProjects, 
      newProjectsCount, 
      skippedCount,
      alreadyMigrated: existingAuftragsnummern.size
    });

    const estimates = {
      projects: totalProjects,
      newProjects: newProjectsCount,
      skippedProjects: skippedCount,
      estimatedFiles: newProjectsCount * 20,
      estimatedMessages: newProjectsCount * 50,
      estimatedStorageMB: newProjectsCount * 40,
      estimatedDurationMinutes: Math.ceil(newProjectsCount / 20),
    };

    return new Response(
      JSON.stringify({ success: true, estimates }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('analyzeScope Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function startMigration(supabaseClient: any, params: any) {
  const { apiKey, userId } = params;

  const { data: run, error } = await supabaseClient
    .from('migration_runs')
    .insert({
      status: 'pending',
      started_by: userId,
      craftnote_api_key: apiKey,
      metadata: { source: 'ui' }
    })
    .select()
    .single();

  if (error) throw error;

  // Starte Migration als Background-Task
  EdgeRuntime.waitUntil(
    processMigration(supabaseClient, run.id, apiKey)
      .catch(err => {
        console.error('Background migration error:', err);
      })
  );

  return new Response(
    JSON.stringify({ success: true, runId: run.id }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getStatus(supabaseClient: any, runId: string) {
  const { data: run, error } = await supabaseClient
    .from('migration_runs')
    .select('*')
    .eq('id', runId)
    .single();

  if (error) throw error;

  const { data: errors } = await supabaseClient
    .from('migration_errors')
    .select('*')
    .eq('migration_run_id', runId)
    .order('timestamp', { ascending: false })
    .limit(10);

  return new Response(
    JSON.stringify({ success: true, run, errors: errors || [] }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function cancelMigration(supabaseClient: any, runId: string) {
  const { error } = await supabaseClient
    .from('migration_runs')
    .update({ status: 'cancelled' })
    .eq('id', runId);

  if (error) throw error;

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function processMigration(supabaseClient: any, runId: string, apiKey: string) {
  try {
    console.log(`Starting migration run: ${runId}`);
    
    await supabaseClient
      .from('migration_runs')
      .update({ status: 'analyzing' })
      .eq('id', runId);

    // Hole ALLE Projekte mit Pagination (keine Users mehr)
    console.log('Fetching all projects from Craftnote...');
    const allProjects = await fetchAllCraftnoteProjects(apiKey);
    console.log(`Found ${allProjects.length} projects total`);

    // Prüfe, welche Projekte bereits existieren oder aktualisiert werden müssen
    const { data: existingDetails } = await supabaseClient
      .from('project_details')
      .select('auftragsnummer, updated_at, project_id');

    const existingProjectsMap = new Map<string, { updated_at: string; project_id: string }>(
      (existingDetails || [])
        .filter((d: any) => d.auftragsnummer)
        .map((d: any) => [d.auftragsnummer, { updated_at: d.updated_at, project_id: d.project_id }])
    );

    // Kategorisiere Projekte: neu vs. update
    const newProjects: any[] = [];
    const updateProjects: any[] = [];

    for (const cnProject of allProjects) {
      const auftragsnummer = cnProject.auftragsnummer || cnProject.projectNumber || cnProject.id;
      if (!auftragsnummer) continue;

      const existing = existingProjectsMap.get(auftragsnummer);
      
      if (!existing) {
        // Komplett neues Projekt
        newProjects.push(cnProject);
      } else {
        // Prüfe ob Update nötig (wenn Craftnote updated_at neuer ist)
        const cnUpdated = cnProject.updatedAt || cnProject.updated_at;
        if (cnUpdated && new Date(cnUpdated) > new Date(existing.updated_at)) {
          updateProjects.push({ ...cnProject, existingProjectId: existing.project_id });
        }
      }
    }

    console.log(`${newProjects.length} neue Projekte, ${updateProjects.length} zu aktualisierende Projekte, ${allProjects.length - newProjects.length - updateProjects.length} unverändert`);

    await supabaseClient
      .from('migration_runs')
      .update({ 
        total_items: { 
          new_projects: newProjects.length,
          update_projects: updateProjects.length,
          unchanged: allProjects.length - newProjects.length - updateProjects.length
        },
        progress: { new_projects: 0, update_projects: 0 }
      })
      .eq('id', runId);

    await supabaseClient
      .from('migration_runs')
      .update({ status: 'migrating', phase: 'new_projects' })
      .eq('id', runId);

    // Phase 1: Neue Projekte migrieren
    for (let i = 0; i < newProjects.length; i++) {
      await migrateProject(supabaseClient, newProjects[i], runId, false);
      
      await supabaseClient
        .from('migration_runs')
        .update({ 
          progress: { 
            new_projects: i + 1, 
            update_projects: 0 
          } 
        })
        .eq('id', runId);
    }

    // Phase 2: Bestehende Projekte aktualisieren
    await supabaseClient
      .from('migration_runs')
      .update({ phase: 'update_projects' })
      .eq('id', runId);

    for (let i = 0; i < updateProjects.length; i++) {
      await migrateProject(supabaseClient, updateProjects[i], runId, true);
      
      await supabaseClient
        .from('migration_runs')
        .update({ 
          progress: { 
            new_projects: newProjects.length, 
            update_projects: i + 1 
          } 
        })
        .eq('id', runId);
    }

    console.log('Migration completed successfully');
    
    await supabaseClient
      .from('migration_runs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);

  } catch (error: any) {
    console.error('Migration error:', error);
    await supabaseClient
      .from('migration_runs')
      .update({ 
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', runId);
  }
}

async function fetchCraftnoteAPI(apiKey: string, endpoint: string) {
  const response = await fetch(
    `https://europe-west1-craftnote-live.cloudfunctions.net/api/v1${endpoint}`,
    {
      headers: {
        'X-CN-API-KEY': apiKey.trim(),
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return await response.json();
}

// Alle Projekte mit Pagination laden
async function fetchAllCraftnoteProjects(apiKey: string): Promise<any[]> {
  const allProjects: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching projects page ${page}...`);
    
    const data = await fetchCraftnoteAPI(apiKey, `/projects?page=${page}&limit=100`);
    
    const projects = data.projects || data || [];
    allProjects.push(...projects);

    // Prüfe ob weitere Seiten existieren
    const total = data.total || 0;
    hasMore = allProjects.length < total;
    page++;

    // Sicherheits-Limit: Maximal 50 Seiten (5000 Projekte)
    if (page > 50) {
      console.warn('Reached maximum page limit (50)');
      break;
    }
  }

  console.log(`Loaded total of ${allProjects.length} projects from Craftnote`);
  return allProjects;
}

async function migrateProject(supabaseClient: any, cnProject: any, runId: string, isUpdate: boolean = false) {
  try {
    const auftragsnummer = cnProject.auftragsnummer || cnProject.projectNumber || cnProject.id;
    
    if (isUpdate && cnProject.existingProjectId) {
      // Update bestehendes Projekt
      console.log(`Updating project: ${auftragsnummer}`);
      
      await supabaseClient
        .from('projects')
        .update({
          title: cnProject.name || cnProject.title || 'Unbenanntes Projekt',
          updated_at: new Date().toISOString()
        })
        .eq('id', cnProject.existingProjectId);

      // Update Project Details
      await supabaseClient
        .from('project_details')
        .update({
          projektname: cnProject.name || cnProject.title,
          projektstatus: cnProject.status || 'aktiv',
          ansprechpartner: cnProject.contact?.name || cnProject.contactName,
          strasse: cnProject.address?.street || cnProject.street,
          plz: cnProject.address?.zipCode || cnProject.zipCode,
          stadt: cnProject.address?.city || cnProject.city,
          startdatum: cnProject.startDate,
          enddatum: cnProject.endDate,
          notiz: cnProject.description || cnProject.notes,
          updated_at: new Date().toISOString()
        })
        .eq('project_id', cnProject.existingProjectId);

    } else {
      // Erstelle neues Projekt
      console.log(`Creating new project: ${auftragsnummer}`);
      
      const projectId = crypto.randomUUID();

      const { error: projectError } = await supabaseClient
        .from('projects')
        .insert({
          id: projectId,
          title: cnProject.name || cnProject.title || 'Unbenanntes Projekt',
          user_id: (await supabaseClient.auth.getUser()).data.user?.id,
          created_at: cnProject.createdAt || new Date().toISOString()
        });

      if (projectError && projectError.code !== '23505') {
        throw projectError;
      }

      // Erstelle Project Details
      await supabaseClient
        .from('project_details')
        .insert({
          project_id: projectId,
          projektname: cnProject.name || cnProject.title,
          auftragsnummer: auftragsnummer,
          projektstatus: cnProject.status || 'aktiv',
          ansprechpartner: cnProject.contact?.name || cnProject.contactName,
          strasse: cnProject.address?.street || cnProject.street,
          plz: cnProject.address?.zipCode || cnProject.zipCode,
          stadt: cnProject.address?.city || cnProject.city,
          startdatum: cnProject.startDate,
          enddatum: cnProject.endDate,
          notiz: cnProject.description || cnProject.notes
        });

      // Erstelle Standard-Verzeichnisse
      const directories = ['Bilder', 'Dokumente', 'Sonstiges'];
      for (let i = 0; i < directories.length; i++) {
        await supabaseClient
          .from('project_directories')
          .insert({
            project_id: projectId,
            name: directories[i],
            order_index: i,
            created_by: (await supabaseClient.auth.getUser()).data.user?.id
          });
      }
    }

  } catch (error: any) {
    console.error('Project migration error:', error);
    await supabaseClient
      .from('migration_errors')
      .insert({
        migration_run_id: runId,
        error_type: isUpdate ? 'project_update' : 'project_create',
        error_message: error.message,
        data: cnProject
      });
  }
}

async function migrateUser(supabaseClient: any, cnUser: any, runId: string) {
  try {
    const userId = crypto.randomUUID();

    const { error } = await supabaseClient
      .from('profiles')
      .insert({
        id: userId,
        first_name: cnUser.firstName || '',
        last_name: cnUser.lastName || '',
        email: cnUser.email || `user-${userId}@craftnote-import.local`,
        must_change_password: true
      });

    if (error && error.code !== '23505') {
      throw error;
    }

    await supabaseClient
      .from('user_roles')
      .insert({
        user_id: userId,
        role: mapRole(cnUser.role),
        created_by: userId
      });

  } catch (error: any) {
    await supabaseClient
      .from('migration_errors')
      .insert({
        migration_run_id: runId,
        error_type: 'user',
        error_message: error.message,
        data: cnUser
      });
  }
}

function mapRole(cnRole: string): string {
  const mapping: Record<string, string> = {
    'admin': 'geschaeftsfuehrer',
    'owner': 'geschaeftsfuehrer',
    'manager': 'team_projektleiter',
    'worker': 'mitarbeiter',
  };
  return mapping[cnRole?.toLowerCase()] || 'mitarbeiter';
}
