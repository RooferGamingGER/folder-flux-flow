-- Migration Runs Tracking
CREATE TABLE migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('pending', 'analyzing', 'migrating', 'completed', 'failed', 'cancelled')),
  phase TEXT,
  progress JSONB DEFAULT '{}'::jsonb,
  total_items JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  started_by UUID REFERENCES profiles(id),
  craftnote_api_key TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Migration Errors
CREATE TABLE migration_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_run_id UUID REFERENCES migration_runs(id) ON DELETE CASCADE,
  error_type TEXT,
  error_message TEXT,
  data JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_errors ENABLE ROW LEVEL SECURITY;

-- RLS Policies (nur Admins)
CREATE POLICY "Admins can view migration runs" ON migration_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
    )
  );

CREATE POLICY "Admins can create migration runs" ON migration_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
    )
  );

CREATE POLICY "Admins can update migration runs" ON migration_runs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
    )
  );

CREATE POLICY "Admins can view migration errors" ON migration_errors
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
    )
  );

CREATE POLICY "System can insert migration errors" ON migration_errors
  FOR INSERT TO authenticated
  WITH CHECK (true);