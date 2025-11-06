-- ============================================
-- PHASE 1: ERWEITERTE BERECHTIGUNGEN
-- ============================================

-- 1.1 Tabelle: folder_members
CREATE TABLE IF NOT EXISTS public.folder_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

ALTER TABLE public.folder_members ENABLE ROW LEVEL SECURITY;

-- 1.2 Security Definer Funktionen

-- Funktion: can_access_folder
CREATE OR REPLACE FUNCTION public.can_access_folder(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admins und Bürokräfte sehen alle Ordner
    public.has_full_access(_user_id)
    OR
    -- Ordner-Eigentümer
    EXISTS (
      SELECT 1 FROM public.folders 
      WHERE id = _folder_id AND user_id = _user_id
    )
    OR
    -- Zugewiesenes Ordner-Mitglied
    EXISTS (
      SELECT 1 FROM public.folder_members 
      WHERE folder_id = _folder_id AND user_id = _user_id
    )
  );
$$;

-- Funktion: can_manage_folder_members
CREATE OR REPLACE FUNCTION public.can_manage_folder_members(_user_id UUID, _folder_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    -- Admins, Bürokräfte und Team-/Projektleiter
    public.can_manage_projects(_user_id)
    AND
    -- Muss Zugriff auf Ordner haben
    public.can_access_folder(_user_id, _folder_id)
  );
$$;

-- Funktion: can_access_dashboard
CREATE OR REPLACE FUNCTION public.can_access_dashboard(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('geschaeftsfuehrer', 'buerokraft', 'team_projektleiter')
  );
$$;

-- 1.3 Erweiterte can_access_project Funktion (mit Ordner-Berücksichtigung)
CREATE OR REPLACE FUNCTION public.can_access_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
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
  );
$$;

-- 1.4 RLS Policies für folder_members
CREATE POLICY "Users can view folder members if they have access"
ON public.folder_members FOR SELECT
USING (public.can_access_folder(auth.uid(), folder_id));

CREATE POLICY "Authorized users can add folder members"
ON public.folder_members FOR INSERT
WITH CHECK (public.can_manage_folder_members(auth.uid(), folder_id));

CREATE POLICY "Users can leave folders or authorized users can remove"
ON public.folder_members FOR DELETE
USING (
  auth.uid() = user_id  -- Selbst verlassen
  OR
  public.can_manage_folder_members(auth.uid(), folder_id)  -- Berechtigt zum Verwalten
);

-- 1.5 RLS Policies für project_members aktualisieren
DROP POLICY IF EXISTS "Authorized users can remove project members" ON public.project_members;

CREATE POLICY "Users can leave projects or authorized users can remove"
ON public.project_members FOR DELETE
USING (
  auth.uid() = user_id  -- Selbst verlassen
  OR
  public.can_manage_project_members(auth.uid(), project_id)  -- Berechtigt zum Verwalten
);

-- 1.6 RLS Policies für folders aktualisieren
DROP POLICY IF EXISTS "Users can view accessible folders" ON public.folders;

CREATE POLICY "Users can view accessible folders"
ON public.folders FOR SELECT
USING (
  auth.uid() = user_id
  OR public.has_full_access(auth.uid())
  OR public.can_access_folder(auth.uid(), id)
);