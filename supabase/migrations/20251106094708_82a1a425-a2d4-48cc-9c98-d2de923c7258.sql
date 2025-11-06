-- Tabelle für ausgeschlossene Projekte (User will Projekt nicht sehen)
CREATE TABLE public.project_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  excluded_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Index für Performance
CREATE INDEX idx_project_exclusions_user_id ON public.project_exclusions(user_id);
CREATE INDEX idx_project_exclusions_project_id ON public.project_exclusions(project_id);

-- RLS aktivieren
ALTER TABLE public.project_exclusions ENABLE ROW LEVEL SECURITY;

-- Policy: User kann eigene Ausschlüsse sehen
CREATE POLICY "Users can view their own exclusions"
ON public.project_exclusions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: User kann Projekte ausschließen
CREATE POLICY "Users can exclude projects"
ON public.project_exclusions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: User kann Ausschlüsse entfernen (= Projekt wieder sehen)
CREATE POLICY "Users can remove exclusions"
ON public.project_exclusions FOR DELETE
USING (auth.uid() = user_id);

-- can_access_project Funktion erweitern um Ausschlüsse zu berücksichtigen
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    -- User hat Projekt NICHT ausgeschlossen
    NOT EXISTS (
      SELECT 1 FROM public.project_exclusions
      WHERE user_id = _user_id AND project_id = _project_id
    )
    AND
    (
      -- Admins und Bürokräfte sehen alle Projekte
      public.has_full_access(_user_id)
      OR
      -- Projekt-Eigentümer
      EXISTS (
        SELECT 1 FROM public.projects 
        WHERE id = _project_id AND user_id = _user_id
      )
      OR
      -- Direktes Projekt-Mitglied
      EXISTS (
        SELECT 1 FROM public.project_members 
        WHERE project_id = _project_id AND user_id = _user_id
      )
      OR
      -- Ordner-Mitglied (indirekter Zugriff über Ordner)
      EXISTS (
        SELECT 1 FROM public.projects p
        INNER JOIN public.folder_members fm ON fm.folder_id = p.folder_id
        WHERE p.id = _project_id AND fm.user_id = _user_id
      )
    )
  );
$$;