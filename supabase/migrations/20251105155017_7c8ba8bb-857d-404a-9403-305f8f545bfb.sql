-- Erweitere can_delete_file() Funktion um Azubi-Rolle
CREATE OR REPLACE FUNCTION public.can_delete_file(_user_id uuid, _file_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    -- Geschäftsführer und Bürokraft können alle Dateien löschen
    public.has_full_access(_user_id)
    OR
    -- Team-Projektleiter und Vorarbeiter können eigene Dateien jederzeit löschen
    EXISTS (
      SELECT 1 FROM public.project_files f
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE f.id = _file_id 
        AND f.created_by = _user_id
        AND ur.role IN ('team_projektleiter', 'vorarbeiter')
    )
    OR
    -- Mitarbeiter und Azubis können eigene Dateien innerhalb von 48 Stunden löschen
    EXISTS (
      SELECT 1 FROM public.project_files f
      JOIN public.user_roles ur ON ur.user_id = _user_id
      WHERE f.id = _file_id 
        AND f.created_by = _user_id
        AND ur.role IN ('mitarbeiter', 'azubi')
        AND f.modified > (now() - interval '48 hours')
    )
  );
$function$