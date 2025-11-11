import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        return await analyzeScope(params.apiKey);
      
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

async function analyzeScope(apiKey: string) {
  try {
    // Craftnote API ohne Limit aufrufen, um 'total' zu erhalten
    const projectsResponse = await fetch(
      'https://europe-west1-craftnote-live.cloudfunctions.net/api/v1/projects',
      {
        headers: {
          'X-CN-API-KEY': apiKey.trim(),
          'Content-Type': 'application/json'
        }
      }
    );

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      throw new Error(`Craftnote API Fehler: ${projectsResponse.status} - ${errorText}`);
    }

    const projectsData = await projectsResponse.json();
    
    // Craftnote API gibt 'total' für die Gesamtanzahl zurück
    const totalProjects = projectsData.total || projectsData.projects?.length || 0;

    console.log('Craftnote API Response:', { 
      total: projectsData.total, 
      projectsLength: projectsData.projects?.length,
      calculatedTotal: totalProjects 
    });

    const estimates = {
      projects: totalProjects,
      estimatedFiles: totalProjects * 20,
      estimatedMessages: totalProjects * 50,
      estimatedStorageMB: totalProjects * 40,
      estimatedDurationMinutes: Math.ceil(totalProjects / 20),
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

  processMigration(supabaseClient, run.id, apiKey);

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
    await supabaseClient
      .from('migration_runs')
      .update({ status: 'analyzing' })
      .eq('id', runId);

    const usersData = await fetchCraftnoteAPI(apiKey, '/users');
    const users = usersData.users || usersData || [];

    await supabaseClient
      .from('migration_runs')
      .update({ 
        total_items: { users: users.length },
        progress: { users: 0 }
      })
      .eq('id', runId);

    await supabaseClient
      .from('migration_runs')
      .update({ status: 'migrating', phase: 'users' })
      .eq('id', runId);

    for (let i = 0; i < users.length; i++) {
      await migrateUser(supabaseClient, users[i], runId);
      
      await supabaseClient
        .from('migration_runs')
        .update({ progress: { users: i + 1 } })
        .eq('id', runId);
    }

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
