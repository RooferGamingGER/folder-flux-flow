-- Monitoring & Alerting System Tables

-- 1. Alerts Tabelle für System-Benachrichtigungen
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metrics JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Check Constraint für resolved-Felder
ALTER TABLE alerts ADD CONSTRAINT valid_resolved CHECK (
  (resolved = false AND resolved_at IS NULL AND resolved_by IS NULL) OR
  (resolved = true AND resolved_at IS NOT NULL)
);

CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_level ON alerts(level);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);

-- RLS Policies für alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. Metrics History Tabelle für historische Daten
CREATE TABLE metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collected_at TIMESTAMPTZ DEFAULT now(),
  
  -- Storage Metrics
  storage_total_bytes BIGINT,
  storage_used_bytes BIGINT,
  storage_usage_percent NUMERIC(5,2),
  storage_files_count INTEGER,
  
  -- Database Metrics
  db_active_connections INTEGER,
  db_total_connections INTEGER,
  db_slow_queries INTEGER,
  db_avg_query_time_ms NUMERIC(10,2),
  
  -- API Metrics
  api_requests_per_minute INTEGER,
  api_error_rate NUMERIC(5,2),
  api_avg_response_time_ms NUMERIC(10,2),
  
  -- System Metrics
  system_cpu_percent NUMERIC(5,2),
  system_memory_percent NUMERIC(5,2),
  system_disk_percent NUMERIC(5,2),
  
  -- Raw JSON für Flexibilität
  raw_metrics JSONB
);

CREATE INDEX idx_metrics_collected_at ON metrics_history(collected_at DESC);

-- RLS Policies für metrics_history
ALTER TABLE metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view metrics"
  ON metrics_history FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role can insert metrics"
  ON metrics_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Cleanup-Funktion für alte Metriken (>90 Tage)
CREATE OR REPLACE FUNCTION cleanup_old_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM metrics_history 
  WHERE collected_at < now() - INTERVAL '90 days';
END;
$$;

-- 3. Admin Settings Tabelle
CREATE TABLE admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- RLS Policies für admin_settings
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage settings"
  ON admin_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Standard-Einstellungen einfügen
INSERT INTO admin_settings (key, value) VALUES
  ('alert_thresholds', '{
    "storage_warning": 85,
    "storage_critical": 95,
    "error_rate_warning": 5,
    "error_rate_critical": 10,
    "slow_query_threshold_ms": 1000
  }'::jsonb),
  ('alert_emails', '["admin@ihre-firma.de"]'::jsonb),
  ('grafana_url', '"http://localhost:3001"'::jsonb),
  ('monitoring_enabled', 'true'::jsonb);

-- Trigger für updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();